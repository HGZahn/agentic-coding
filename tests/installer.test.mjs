import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const m = JSON.parse(fs.readFileSync(path.join(root, 'skills.manifest.json'), 'utf8'));
function put(file, content = '', mode) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, { mode });
}
function fixture(t) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-test-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const home = path.join(temp, 'home');
  const project = path.join(temp, 'project with spaces');
  const outside = path.join(temp, 'outside');
  for (const dir of [home, project, outside]) fs.mkdirSync(dir);
  const log = path.join(temp, 'npx.jsonl');
  const bin = path.join(temp, 'bin');
  put(path.join(bin, 'npx'), `#!${process.execPath}
import fs from 'node:fs';
import path from 'node:path';
const args = process.argv.slice(2);
fs.appendFileSync(process.env.NPX_LOG, JSON.stringify({ args, cwd: process.cwd() }) + '\\n');
if (process.env.NPX_FAIL) { console.error('simulated upstream failure'); process.exit(7); }
const command = args[2];
if (command === 'list') console.log('stub list output');
const target = args.includes('--global') ? process.env.HOME : process.cwd();
if (command === 'add') {
  const i = args.indexOf('--skill');
  const names = [];
  for (let j = i + 1; i >= 0 && j < args.length && !args[j].startsWith('-'); j++) names.push(args[j]);
  for (const name of names) {
    const dest = path.join(target, '.agents/skills', name);
    fs.mkdirSync(dest, { recursive: true });
    fs.writeFileSync(path.join(dest, 'SKILL.md'), '---\\nname: ' + name + '\\ndescription: fixture\\n---\\n');
  }
}
`, 0o755);
  const env = { ...process.env, HOME: home, XDG_CONFIG_HOME: path.join(home, '.config'), XDG_DATA_HOME: path.join(home, '.local/share'), PATH: `${bin}:${process.env.PATH}`, NPX_LOG: log, NPX_FAIL: '', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
  // npx is a shell entry point; execute the ESM fixture explicitly without a package.json.
  fs.renameSync(path.join(bin, 'npx'), path.join(bin, 'npx.mjs'));
  put(path.join(bin, 'npx'), `#!/usr/bin/env bash\nexec "${process.execPath}" "${bin}/npx.mjs" "$@"\n`, 0o755);
  function run(args = [], { cwd = root, source = root, environment = {}, entry = 'agentic' } = {}) {
    return spawnSync('bash', [path.join(source, entry), ...args], { cwd, env: { ...env, ...environment }, encoding: 'utf8', timeout: 15000 });
  }
  function calls() { return fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : []; }
  function git(args, cwd = project) {
    const result = spawnSync('git', args, { cwd, env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  }
  function checkout() {
    const source = path.join(temp, 'checkout');
    fs.mkdirSync(source);
    for (const file of ['agentic', 'setup.sh', 'get-started.sh', 'skills.manifest.json', 'scripts', 'home', 'skills', 'template']) fs.cpSync(path.join(root, file), path.join(source, file), { recursive: true });
    return source;
  }
  return { temp, home, project, outside, log, env, run, calls, git, checkout };
}
function ok(result) { assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`); }
function bad(result, pattern) { assert.notEqual(result.status, 0); assert.match(result.stderr, pattern); }
// Skills are batched one upstream call per source/ref/path, so a skill can land in any call.
const requested = (f, name) => f.calls().some(call => call.args.includes(name));

test('help is available without writes or npx', t => {
  const f = fixture(t);
  ok(f.run(['--help']));
  assert.deepEqual(fs.readdirSync(f.home), []);
  assert.equal(f.calls().length, 0);
});

test('legacy --check is read-only and reports missing links', t => {
  const f = fixture(t);
  bad(f.run(['--user', '--check', '--no-skills'], { entry: 'setup.sh' }), /missing:/);
  assert.deepEqual(fs.readdirSync(f.home), []);
  assert.equal(f.calls().length, 0);
});

test('personal install links every home file, including the working command, and is repeatable', t => {
  const f = fixture(t);
  ok(f.run(['--user', '--no-skills']));
  const installed = path.join(f.home, '.local/bin/agentic');
  assert.equal(fs.readlinkSync(installed), path.join(root, 'home/.local/bin/agentic'));
  assert.equal(fs.readlinkSync(path.join(f.home, 'AGENTS.md')), path.join(root, 'home/AGENTS.md'));
  ok(f.run(['--user', '--no-skills']));
  ok(f.run(['doctor', '--user', '--no-skills']));
  const result = spawnSync(installed, ['profiles'], { env: f.env, cwd: f.outside, encoding: 'utf8' });
  ok(result);
  assert.match(result.stdout, /creative/);
});

test('auto scope is personal in this checkout and outside projects', t => {
  const f = fixture(t);
  for (const cwd of [root, path.join(root, 'scripts'), f.home, f.outside]) {
    const result = f.run(['--dry-run', '--no-skills'], { cwd });
    ok(result);
    assert.match(result.stdout, /Scope: user/);
  }
  assert.deepEqual(fs.readdirSync(f.home), []);
});

test('auto scope finds another Git project root from a subdirectory', t => {
  const f = fixture(t);
  f.git(['init', '-q']);
  const sub = path.join(f.project, 'src/sub');
  fs.mkdirSync(sub, { recursive: true });
  const result = f.run(['--no-skills'], { cwd: sub });
  ok(result);
  assert.match(result.stdout, /Scope: project/);
  assert.ok(fs.existsSync(path.join(f.project, 'AGENTS.md')));
  assert.ok(!fs.existsSync(path.join(sub, 'AGENTS.md')));
  assert.deepEqual(fs.readdirSync(f.home), []);
});

test('explicit project scope copies templates, never symlinks, and supports --apply', t => {
  const f = fixture(t);
  ok(f.run(['--project', f.project, '--apply', '--no-skills'], { entry: 'setup.sh' }));
  const file = path.join(f.project, 'AGENTS.md');
  assert.ok(!fs.lstatSync(file).isSymbolicLink());
  assert.equal(fs.readFileSync(file, 'utf8'), fs.readFileSync(path.join(root, 'template/project/AGENTS.md'), 'utf8'));
  ok(f.run(['--project', f.project, '--no-skills']));
  ok(f.run(['--project', f.project, '--check', '--no-skills']));
});

test('explicit project without a directory uses cwd even without Git', t => {
  const f = fixture(t);
  ok(f.run(['--project', '--no-skills'], { cwd: f.project }));
  assert.ok(fs.existsSync(path.join(f.project, '.pi/settings.json')));
});

test('explicit personal scope wins inside a project', t => {
  const f = fixture(t);
  f.git(['init', '-q']);
  ok(f.run(['--user', '--no-skills'], { cwd: f.project }));
  assert.ok(fs.lstatSync(path.join(f.home, 'AGENTS.md')).isSymbolicLink());
  assert.ok(!fs.existsSync(path.join(f.project, 'AGENTS.md')));
});

test('conflicts are preflighted: nothing changes unless adoption is explicit', t => {
  const f = fixture(t);
  put(path.join(f.home, 'AGENTS.md'), 'my instructions');
  bad(f.run(['--user', '--no-skills']), /Conflicts left untouched/);
  assert.deepEqual(fs.readdirSync(f.home), ['AGENTS.md']);
  assert.equal(fs.readFileSync(path.join(f.home, 'AGENTS.md'), 'utf8'), 'my instructions');
  assert.equal(f.calls().length, 0);
});

test('adoption backs up conflicts without losing their contents', t => {
  const f = fixture(t);
  put(path.join(f.project, 'AGENTS.md'), 'custom instructions');
  ok(f.run(['--project', f.project, '--adopt', '--no-skills']));
  const backups = fs.readdirSync(f.project).filter(file => file.startsWith('AGENTS.md.bak.'));
  assert.equal(backups.length, 1);
  assert.equal(fs.readFileSync(path.join(f.project, backups[0]), 'utf8'), 'custom instructions');
  ok(f.run(['doctor', '--project', f.project, '--no-skills']));
});

test('broken symlinks are reported as conflicts, not silently overwritten', t => {
  const f = fixture(t);
  fs.symlinkSync('/missing-agentic-test-target', path.join(f.home, 'AGENTS.md'));
  bad(f.run(['--user', '--no-skills']), /Conflicts/);
  ok(f.run(['--user', '--adopt', '--no-skills']));
  assert.ok(fs.readdirSync(f.home).some(name => name.startsWith('AGENTS.md.bak.')));
});

test('dry-run previews backups and upstream commands without files, config, or npx', t => {
  const f = fixture(t);
  put(path.join(f.project, 'AGENTS.md'), 'keep me');
  const result = f.run(['--project', f.project, '--profiles', 'base,creative,gamedev', '--adopt', '--dry-run']);
  ok(result);
  assert.match(result.stdout, /backup:/);
  assert.match(result.stdout, /skills@1\.7\.0 add/);
  assert.deepEqual(fs.readdirSync(f.project), ['AGENTS.md']);
  assert.equal(fs.readFileSync(path.join(f.project, 'AGENTS.md'), 'utf8'), 'keep me');
  assert.deepEqual(fs.readdirSync(f.home), []);
  assert.equal(f.calls().length, 0);
});

for (const args of [['--oops'], ['--profiles'], ['--agents'], ['--profiles', 'base,typo'], ['--profiles', ''], ['--agents', 'auto,pi'], ['--user', '--project'], ['bogus'], ['--project', '/missing-agentic-test-dir']]) {
  test(`invalid invocation fails before writing: ${JSON.stringify(args)}`, t => {
    const f = fixture(t);
    const result = f.run(args);
    assert.notEqual(result.status, 0);
    assert.ok(result.stderr.startsWith('Error:'));
    assert.deepEqual(fs.readdirSync(f.home), []);
    assert.equal(f.calls().length, 0);
  });
}

test('unknown skills in the manifest fail before applying files', t => {
  const f = fixture(t);
  const source = f.checkout();
  const invalid = structuredClone(m);
  invalid.profiles.base.push('does-not-exist');
  put(path.join(source, 'skills.manifest.json'), JSON.stringify(invalid));
  bad(f.run(['--user', '--no-skills'], { source }), /Invalid profile/);
  assert.deepEqual(fs.readdirSync(f.home), []);
});

test('local path traversal in the manifest is rejected', t => {
  const f = fixture(t);
  const source = f.checkout();
  const invalid = structuredClone(m);
  invalid.skills.explain.path = '../outside';
  put(path.join(source, 'skills.manifest.json'), JSON.stringify(invalid));
  bad(f.run(['--dry-run'], { source }), /Invalid path/);
});

test('selected profiles deduplicate and batch skills by source/ref/path', t => {
  const f = fixture(t);
  ok(f.run(['skills', 'install', '--user', '--profiles', 'base,creative,gamedev', '--agents', 'pi,opencode']));
  const calls = f.calls();
  const hf = calls.filter(call => call.args.includes('heygen-com/hyperframes#main'));
  assert.equal(hf.length, 1);
  for (const name of m.profiles.creative.filter(name => name.startsWith('hyperframes') || name === 'media-use')) assert.ok(hf[0].args.includes(name));
  assert.equal(calls.filter(call => call.args.includes('gpt-imagegen')).length, 1);
  assert.equal(calls.filter(call => call.args.includes('dream-loop')).length, 1);
  assert.ok(calls.some(call => call.args.includes('ARYANK-08/agentic-dev-kit/skills/explain#main')));
  assert.ok(calls.some(call => call.args.includes('kaankiziltug/logo-design-skill/skills/logo-design#main')));
  assert.ok(calls.some(call => call.args.includes('thedivergentai/GD-Agentic-Skills/skills/godot-master#main')));
  for (const call of calls) {
    assert.deepEqual(call.args.slice(0, 3), ['--yes', 'skills@1.7.0', 'add']);
    assert.ok(call.args.includes('--global'));
    assert.ok(!call.args.includes('--all'));
    assert.equal(call.args.at(-1), '--yes');
    assert.equal(call.cwd, f.home);
  }
  assert.ok(!fs.existsSync(path.join(f.home, 'AGENTS.md')), 'skills-only must not install dotfiles');
});

test('project skill installs use project cwd and no unsupported -p add flag', t => {
  const f = fixture(t);
  ok(f.run(['skills', 'install', '--project', f.project, '--profiles', 'pythondev']));
  assert.equal(f.calls().length, 1);
  assert.deepEqual(f.calls()[0].args.slice(3, 8), ['astral-sh/claude-code-plugins#main', '--skill', 'ruff', 'uv', '--agent']);
  assert.equal(f.calls()[0].cwd, f.project);
  assert.ok(!f.calls()[0].args.some(arg => ['-p', '--project', '--global'].includes(arg)));
  assert.ok(fs.existsSync(path.join(f.project, '.agents/skills/uv/SKILL.md')));
  assert.ok(!fs.existsSync(path.join(f.project, 'AGENTS.md')));
});

test('profile and agent selections persist per scope; flags can override them', t => {
  const f = fixture(t);
  ok(f.run(['skills', 'install', '--user', '--profiles', 'pythondev', '--agents', 'codex']));
  const saved = JSON.parse(fs.readFileSync(path.join(f.home, '.config/agentic-coding/config.json'), 'utf8'));
  assert.deepEqual(saved, { profiles: ['pythondev'], agents: ['codex'] });
  ok(f.run(['skills', 'install', '--user']));
  assert.ok(f.calls().at(-1).args.includes('codex'));
  assert.ok(f.calls().at(-1).args.includes('uv'));
  const result = f.run(['skills', 'install', '--user', '--profiles', 'gamedev', '--dry-run']);
  ok(result);
  assert.match(result.stdout, /Profiles: gamedev/);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.home, '.config/agentic-coding/config.json'), 'utf8')), saved);
  const project = f.run(['skills', 'install', '--project', f.project, '--dry-run']);
  ok(project);
  assert.match(project.stdout, /Profiles: base/);
});

test('Python/Godot/HyperFrames markers select profiles, even from non-Git project subdirectories', t => {
  const f = fixture(t);
  put(path.join(f.project, 'pyproject.toml'));
  put(path.join(f.project, 'project.godot'));
  put(path.join(f.project, 'hyperframes.json'), '{}');
  const sub = path.join(f.project, 'src');
  fs.mkdirSync(sub);
  const result = f.run(['skills', 'install', '--dry-run'], { cwd: sub });
  ok(result);
  assert.match(result.stdout, /Profiles: base, pythondev, gamedev, creative/);
  assert.ok(result.stdout.includes(`Target: ${f.project}`));
  assert.equal(f.calls().length, 0);
});

test('agent detection uses common configs and never falls back to all upstream agents', t => {
  const f = fixture(t);
  put(path.join(f.home, '.codex/config.toml'));
  put(path.join(f.home, '.config/opencode/config.json'), '{}');
  ok(f.run(['skills', 'install', '--user', '--profiles', 'pythondev']));
  assert.deepEqual(f.calls()[0].args.slice(-4), ['--agent', 'opencode', 'codex', '--yes']);
  assert.ok(!f.calls()[0].args.includes('*'));
});

test('upstream failure propagates and does not save a successful selection', t => {
  const f = fixture(t);
  bad(f.run(['skills', 'install', '--user', '--profiles', 'pythondev'], { environment: { NPX_FAIL: '1' } }), /npx failed \(exit 7\)/);
  assert.ok(!fs.existsSync(path.join(f.home, '.config/agentic-coding/config.json')));
});

test('doctor checks selected skill presence offline, succeeds after sync, and never calls npx', t => {
  const f = fixture(t);
  ok(f.run(['--user', '--no-skills']));
  bad(f.run(['doctor', '--user', '--profiles', 'pythondev']), /missing skill: uv/);
  assert.equal(f.calls().length, 0);
  ok(f.run(['skills', 'install', '--user', '--profiles', 'pythondev']));
  const count = f.calls().length;
  ok(f.run(['doctor', '--user']));
  assert.equal(f.calls().length, count);
});

test('list/update/add/remove are delegated with a bounded scope', t => {
  const f = fixture(t);
  for (const command of ['list', 'update']) {
    ok(f.run(['skills', command, '--user']));
    assert.ok(f.calls().at(-1).args.includes('--global'));
    ok(f.run(['skills', command, '--project', f.project]));
    const call = f.calls().at(-1);
    assert.equal(call.cwd, f.project);
    assert.ok(!call.args.includes('--global'));
    if (command === 'update') assert.ok(call.args.includes('--project'));
  }
  ok(f.run(['skills', 'add', 'owner/repo', '--skill', 'demo', '--user']));
  assert.ok(f.calls().at(-1).args.includes('owner/repo'));
  ok(f.run(['skills', 'remove', 'demo', '--project', f.project]));
  assert.equal(f.calls().at(-1).args[2], 'remove');
  assert.ok(!fs.existsSync(path.join(f.home, '.config/agentic-coding/config.json')));
});

test('update refuses dirty installer checkouts instead of touching project Git history', t => {
  const f = fixture(t);
  const source = f.checkout();
  f.git(['init', '-q'], source);
  bad(f.run(['update', '--user'], { source }), /local changes/);
  assert.equal(f.calls().length, 0);
});

test('update only fast-forwards the installer, then reloads and applies its new files', t => {
  const f = fixture(t);
  const source = f.checkout();
  f.git(['init', '-q', '-b', 'master'], source);
  f.git(['add', '.'], source);
  f.git(['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'initial'], source);
  const remote = path.join(f.temp, 'remote.git');
  f.git(['clone', '-q', '--bare', source, remote]);
  const installed = path.join(f.temp, 'installed');
  f.git(['clone', '-q', remote, installed]);
  f.git(['remote', 'add', 'origin', remote], source);
  put(path.join(source, 'home/new-file'), 'new upstream file');
  f.git(['add', '.'], source);
  f.git(['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'new dotfile'], source);
  f.git(['push', '-q', 'origin', 'master'], source);
  f.git(['init', '-q'], f.project);
  const result = f.run(['update', '--user', '--no-skills'], { source: installed, cwd: f.project });
  ok(result);
  assert.equal(fs.readFileSync(path.join(f.home, 'new-file'), 'utf8'), 'new upstream file');
  assert.equal(f.git(['rev-parse', 'HEAD'], installed), f.git(['rev-parse', 'HEAD'], source));
  assert.deepEqual(fs.readdirSync(f.project), ['.git']);
});

test('bootstrap retains its checkout and usable symlinks; repeat runs are safe', t => {
  const f = fixture(t);
  const source = f.checkout();
  f.git(['init', '-q', '-b', 'master'], source);
  f.git(['add', '.'], source);
  f.git(['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'initial'], source);
  const install = path.join(f.temp, 'persistent checkout');
  const environment = { AGENTIC_REPO_URL: source, AGENTIC_HOME: install, REF: 'master' };
  ok(f.run(['--no-skills'], { entry: 'get-started.sh', cwd: f.outside, environment }));
  assert.ok(fs.existsSync(path.join(install, '.git')));
  assert.equal(fs.readFileSync(path.join(f.home, 'AGENTS.md'), 'utf8'), fs.readFileSync(path.join(root, 'home/AGENTS.md'), 'utf8'));
  assert.ok(fs.readlinkSync(path.join(f.home, 'AGENTS.md')).startsWith(install));
  const command = path.join(f.home, '.local/bin/agentic');
  ok(spawnSync(command, ['doctor', '--user', '--no-skills'], { env: f.env, cwd: f.outside, encoding: 'utf8' }));
  ok(f.run(['--no-skills'], { entry: 'get-started.sh', cwd: f.outside, environment }));
  put(path.join(install, 'dirty'), 'keep');
  bad(f.run(['--no-skills'], { entry: 'get-started.sh', cwd: f.outside, environment }), /Local changes/);
  assert.equal(fs.readFileSync(path.join(install, 'dirty'), 'utf8'), 'keep');
});

test('bootstrap never overwrites unrelated directories', t => {
  const f = fixture(t);
  const install = path.join(f.temp, 'occupied');
  put(path.join(install, 'keep'), 'keep');
  bad(f.run(['--no-skills'], { entry: 'get-started.sh', environment: { AGENTIC_HOME: install } }), /Not an installer checkout/);
  assert.equal(fs.readFileSync(path.join(install, 'keep'), 'utf8'), 'keep');
});

function shq(value) { return `'${value.replace(/'/g, `'\\''`)}'`; }
// Runs the installer behind a pseudo-terminal so the checklist reads real TTY input.
// A trailing sleep keeps the pipe open; closing stdin immediately can race the pty relay.
function ptyInstall(t, f, input, args) {
  if (process.platform !== 'linux' || spawnSync('sh', ['-c', 'command -v script'], { encoding: 'utf8' }).status !== 0) {
    t.skip('interactive checklist test needs Linux script(1)');
  }
  const command = `cd ${shq(f.home)} && bash ${shq(path.join(root, 'agentic'))} ${args.join(' ')}`;
  const inner = `{ printf '%s' "$AGT_TUI_INPUT"; sleep 1; } | script -qec ${shq(command)} /dev/null`;
  return spawnSync('bash', ['-c', inner], { env: { ...f.env, AGT_TUI_INPUT: input }, encoding: 'utf8', timeout: 20000 });
}

test('help documents the checklist and quiet flags', t => {
  const f = fixture(t);
  const result = f.run(['--help']);
  ok(result);
  assert.match(result.stdout, /--quiet, -q/);
  assert.match(result.stdout, /--silent, -s, --yes, -y/);
  assert.match(result.stdout, /profile checklist/);
});

test('quiet aliases accept detected defaults and print no progress', t => {
  const f = fixture(t);
  for (const flag of ['-q', '--silent', '-s', '--yes', '-y']) {
    const result = f.run(['skills', 'install', '--user', '--profiles', 'pythondev', flag]);
    ok(result);
    assert.equal(result.stdout, '');
    assert.ok(requested(f, 'uv'));
  }
  ok(f.run(['skills', 'list', '--user', '--quiet']));
  assert.match(f.calls().at(-1).args.join(' '), /list/);
  assert.match(f.run(['skills', 'list', '--user', '--quiet']).stdout, /stub list output/);
});

test('--quiet installs silently and still reports buffered upstream failures', t => {
  const f = fixture(t);
  ok(f.run(['--user', '--quiet', '--profiles', 'pythondev']));
  assert.equal(f.run(['--user', '--quiet', '--no-skills']).stdout, '');
  assert.equal(fs.readlinkSync(path.join(f.home, 'AGENTS.md')), path.join(root, 'home/AGENTS.md'));
  const saved = fs.readFileSync(path.join(f.home, '.config/agentic-coding/config.json'), 'utf8');
  const failure = f.run(['skills', 'install', '--user', '--profiles', 'gamedev'], { environment: { NPX_FAIL: '1' } });
  assert.notEqual(failure.status, 0);
  assert.match(failure.stderr, /npx failed \(exit 7\)/);
  assert.match(failure.stderr, /simulated upstream failure/);
  assert.equal(fs.readFileSync(path.join(f.home, '.config/agentic-coding/config.json'), 'utf8'), saved);
});

test('non-TTY installs never prompt and keep detected profiles', t => {
  const f = fixture(t);
  put(path.join(f.project, 'pyproject.toml'));
  f.git(['init', '-q']);
  const result = f.run(['--project', f.project, '--no-skills', '--dry-run']);
  ok(result);
  assert.match(result.stdout, /Profiles: base, pythondev/);
  assert.ok(!result.stdout.includes('Select skill profiles'));
});

test('interactive install shows the checklist and Enter keeps detected profiles', t => {
  const f = fixture(t);
  const result = ptyInstall(t, f, '\n', ['install', '--user', '--agents', 'pi']);
  ok(result);
  assert.match(result.stdout, /Select skill profiles to install/);
  assert.match(result.stdout, /\[x\] 1\) base/);
  assert.ok(requested(f, '5whys'));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.home, '.config/agentic-coding/config.json'), 'utf8')).profiles, ['base']);
});

test('the checklist applies typed numbers and remembers them', t => {
  const f = fixture(t);
  const result = ptyInstall(t, f, '2\n', ['install', '--user', '--agents', 'pi']);
  ok(result);
  assert.match(result.stdout, /Profiles: pythondev/);
  assert.ok(requested(f, 'uv'));
  assert.ok(!requested(f, '5whys'));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.home, '.config/agentic-coding/config.json'), 'utf8')).profiles, ['pythondev']);
});

test('the checklist supports selecting all profiles', t => {
  const f = fixture(t);
  const result = ptyInstall(t, f, 'a\n', ['install', '--user', '--agents', 'pi']);
  ok(result);
  assert.match(result.stdout, /Profiles: base, pythondev, devops, gamedev, creative/);
});

test('--quiet skips the checklist even on a TTY', t => {
  const f = fixture(t);
  const result = ptyInstall(t, f, '2\n', ['install', '--user', '--agents', 'pi', '--quiet']);
  ok(result);
  assert.ok(!result.stdout.includes('Select skill profiles'));
  assert.ok(requested(f, '5whys'));
});
