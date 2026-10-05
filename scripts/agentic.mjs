#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const home = path.resolve(process.env.HOME);
// Keep upstream flags and behavior stable. Bump after testing a new release.
const skillsCLI = 'skills@1.7.0';
const help = `Usage: agentic [command] [options]

Commands:
  install             Sync dotfiles/project template + selected skills (default)
  update              Fast-forward this installer checkout, then install
  doctor              Check local drift and prerequisites; never write or fetch
  profiles            Show the skill profiles in skills.manifest.json
  skills install      Sync selected skills only, without dotfiles/templates
  skills list         List installed skills in the selected scope
  skills update       Update installed skills using Vercel Skills
  skills add SOURCE   Add an upstream skill (ad-hoc, not added to the manifest)
  skills remove NAME  Remove an installed skill
  skills find QUERY   Search upstream skills

Options:
  --user, --global     Use your home directory
  --project [DIR]      Use DIR (default: cwd), even outside a Git repository
  --profiles X,Y       Select and remember profiles (default: base + detected stack)
  --agents X,Y         Select and remember agents (default: auto; fallback pi,opencode)
  --quiet, -q          No profile prompt and no progress output; use detected defaults
  --silent, -s, --yes, -y
                       Aliases of --quiet
  --no-skills          Install/check dotfiles or templates only
  --dry-run           Preview paths and commands without writing or fetching
  --adopt             Back up conflicting files to .bak.<timestamp> before replacing
  --check             Alias for doctor (legacy setup.sh flag)
  --apply             Apply changes (legacy setup.sh flag; already the default)
  --help, -h          Show help

Auto scope: this checkout or outside a project -> user; another project -> project root.
Saved profiles/agents win over detection; flags win over saved settings.
Interactive installs show a profile checklist; Enter keeps the detected selection.
Examples: agentic; agentic --quiet; agentic skills install --user --profiles base,creative,gamedev
          agentic --project ~/code/app; agentic doctor; agentic update --user
`;

function fail(message) { throw new Error(message); }
let quiet = false;
function log(...args) { if (!quiet) console.log(...args); }
function csv(value, label) {
  const values = value.split(',').map(v => v.trim());
  if (values.some(v => !v)) fail(`${label} cannot be empty.`);
  return [...new Set(values)];
}
function parse(args) {
  const options = { command: 'install', extra: [], skills: true };
  if (args[0] && !args[0].startsWith('-')) options.command = args.shift();
  if (options.command === 'skills') options.command = `skills ${args.shift() || 'list'}`;
  const commands = ['install', 'update', 'doctor', 'profiles', 'skills install', 'skills list', 'skills update', 'skills add', 'skills remove', 'skills find'];
  if (!commands.includes(options.command)) fail(`Unknown command: ${options.command}. Run agentic --help.`);
  function scope(value) {
    if (options.scope && options.scope !== value) fail('Choose either --user or --project, not both.');
    options.scope = value;
  }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--help': case '-h': options.help = true; break;
      case '--user': case '--global': case '-g': scope('user'); break;
      case '--project':
        scope('project');
        if (args[i + 1] && !args[i + 1].startsWith('-')) options.target = args[++i];
        break;
      case '--profiles': case '--agents':
        if (!args[i + 1] || args[i + 1].startsWith('-')) fail(`${arg} needs a value.`);
        options[arg.slice(2)] = csv(args[++i], arg);
        break;
      case '--no-skills': options.skills = false; break;
      case '--quiet': case '-q': case '--silent': case '-s': case '--yes': case '-y': options.quiet = true; break;
      case '--dry-run': options.dryRun = true; break;
      case '--adopt': options.adopt = true; break;
      case '--check': options.check = true; break;
      case '--apply': break;
      case '--': options.extra.push(...args.slice(i + 1)); i = args.length; break;
      default:
        if (options.command.startsWith('skills ') && options.command !== 'skills install') options.extra.push(arg);
        else fail(`Unknown option: ${arg}. Run agentic --help.`);
    }
  }
  if (options.check) {
    if (!['install', 'doctor'].includes(options.command)) fail('--check is only valid for install/doctor.');
    options.command = 'doctor';
  }
  if (options.extra.length && ['install', 'update', 'doctor', 'profiles', 'skills install'].includes(options.command)) fail('Unexpected arguments. Run agentic --help.');
  return options;
}
function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { fail(`Cannot read ${file}: ${error.message}`); }
}
function manifest() {
  const file = path.join(root, 'skills.manifest.json');
  const m = readJSON(file);
  if (!m.skills || !m.profiles) fail(`Invalid manifest: ${file}`);
  for (const [name, skill] of Object.entries(m.skills)) {
    if (!/^[a-z0-9-]+$/.test(name) || typeof skill.source !== 'string' || !skill.source) fail(`Invalid skill: ${name}`);
    if (skill.ref !== undefined && (typeof skill.ref !== 'string' || !skill.ref)) fail(`Invalid ref for ${name}`);
    if (skill.path !== undefined && (typeof skill.path !== 'string' || path.isAbsolute(skill.path) || skill.path.split(/[\\/]/).includes('..'))) fail(`Invalid path for ${name}`);
    if (skill.source === 'local' && (!skill.path || !fs.existsSync(path.join(root, skill.path, 'SKILL.md')))) fail(`Missing local SKILL.md for ${name}`);
  }
  for (const [name, list] of Object.entries(m.profiles)) {
    if (!Array.isArray(list) || list.some(skill => !Object.hasOwn(m.skills, skill))) fail(`Invalid profile: ${name}`);
  }
  return m;
}
function capture(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  if (result.error || result.status !== 0) fail(`${command} failed: ${result.error?.message || result.stderr.trim()}`);
  return result.stdout.trim();
}
function detectScope(options) {
  if (options.scope === 'user') return { scope: 'user', target: home };
  if (options.scope === 'project') {
    const target = path.resolve(options.target || process.cwd());
    if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) fail(`Project directory does not exist: ${target}`);
    return { scope: 'project', target: fs.realpathSync(target) };
  }
  const cwd = fs.realpathSync(process.cwd());
  if (cwd === home || cwd === root || cwd.startsWith(`${root}${path.sep}`)) return { scope: 'user', target: home };
  const git = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' });
  if (git.status === 0) return { scope: 'project', target: fs.realpathSync(git.stdout.trim()) };
  for (let dir = cwd; dir !== home && dir !== path.dirname(dir); dir = path.dirname(dir)) {
    if (['.agents/agentic.json', 'pyproject.toml', 'package.json', 'project.godot', 'hyperframes.json', 'skills-lock.json'].some(file => fs.existsSync(path.join(dir, file)))) return { scope: 'project', target: dir };
  }
  return { scope: 'user', target: home };
}
// Checklist prompt on the controlling terminal. Only runs when stdin AND stdout are a TTY
// and no --quiet/--profiles was passed; every non-interactive path (pipelines, CI, tests)
// keeps the detected defaults instead of blocking on input.
function promptProfiles(m, detected) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return detected;
  const write = text => fs.writeSync(2, text);
  try {
    const names = Object.keys(m.profiles);
    const chosen = new Set(detected);
    write('Select skill profiles to install:\n');
    for (const [index, name] of names.entries()) write(`  [${chosen.has(name) ? 'x' : ' '}] ${index + 1}) ${name} (${m.profiles[name].length} skills)\n`);
    write('Enter = keep the selection above | numbers/ranges (e.g. 1,3-4) | a = all\n');
    for (;;) {
      write('> ');
      const line = readTTYLine(0);
      if (line === null) return names.filter(name => chosen.has(name));
      const input = line.trim().toLowerCase();
      if (!input) return names.filter(name => chosen.has(name));
      if (input === 'a' || input === 'all') return names;
      const picks = new Set();
      let valid = true;
      for (const token of input.split(/[\s,]+/).filter(Boolean)) {
        const range = /^(\d+)-(\d+)$/.exec(token);
        if (range) {
          const [first, last] = [+range[1], +range[2]];
          if (first > last) { valid = false; break; }
          for (let i = first; i <= last; i++) picks.add(i);
          continue;
        }
        if (/^\d+$/.test(token)) { picks.add(+token); continue; }
        valid = false; break;
      }
      if (!valid || !picks.size || [...picks].some(i => i < 1 || i > names.length)) {
        write(`Enter numbers 1-${names.length}, comma/space separated ranges, or a for all.\n`);
        continue;
      }
      return names.filter((_, index) => picks.has(index + 1));
    }
  } catch { return detected; }
}
function readTTYLine(fd) {
  const bytes = [];
  const byte = Buffer.alloc(1);
  const decode = () => Buffer.from(bytes).toString('utf8');
  for (;;) {
    let read;
    try { read = fs.readSync(fd, byte, 0, 1, null); } catch (error) { if (error.code === 'EAGAIN') continue; throw error; }
    if (!read) return bytes.length ? decode() : null;
    if (byte[0] === 10) return decode();
    if (byte[0] === 13 || byte[0] === 8 || byte[0] === 127) continue;
    if (byte[0] === 4) return bytes.length ? decode() : null;
    bytes.push(byte[0]);
  }
}
function settings(options, target, scope, m) {
  const configHome = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
  const file = scope === 'user' ? path.join(configHome, 'agentic-coding/config.json') : path.join(target, '.agents/agentic.json');
  const saved = fs.existsSync(file) ? readJSON(file) : {};
  let profiles = options.profiles || saved.profiles;
  if (!profiles) {
    profiles = ['base'];
    if (scope === 'project') {
      if (fs.existsSync(path.join(target, 'pyproject.toml'))) profiles.push('pythondev');
      if (fs.existsSync(path.join(target, 'project.godot'))) profiles.push('gamedev');
      if (fs.existsSync(path.join(target, 'hyperframes.json'))) profiles.push('creative');
    }
  }
  // Interactive installs confirm the selection; --quiet/--yes and missing TTYs keep the defaults.
  if (!options.profiles && options.command === 'install' && !options.quiet) profiles = promptProfiles(m, profiles);
  if (!Array.isArray(profiles) || !profiles.length || profiles.some(p => typeof p !== 'string' || !Object.hasOwn(m.profiles, p))) fail(`Unknown/invalid profiles: ${JSON.stringify(profiles)}. Available: ${Object.keys(m.profiles).join(', ')}`);
  const selection = options.agents || saved.agents || ['auto'];
  if (!Array.isArray(selection) || !selection.length || selection.some(a => typeof a !== 'string' || !/^[a-z0-9-]+$/.test(a))) fail(`Invalid agents in ${file}`);
  if (selection.includes('auto') && selection.length !== 1) fail('Use --agents auto or explicit agent names, not both.');
  let agents = selection;
  if (selection[0] === 'auto') {
    const candidates = { pi: ['.pi'], opencode: [path.join(configHome, 'opencode'), '.opencode'], 'claude-code': ['.claude'], codex: ['.codex'], cursor: ['.cursor'], 'gemini-cli': ['.gemini'] };
    agents = Object.entries(candidates).filter(([, dirs]) => dirs.some(dir => fs.existsSync(path.resolve(home, dir)) || scope === 'project' && fs.existsSync(path.resolve(target, dir)))).map(([name]) => name);
    if (!agents.length) agents = ['pi', 'opencode'];
  }
  return { file, profiles: [...new Set(profiles)], agents, selection, names: [...new Set(profiles.flatMap(p => m.profiles[p]))] };
}
function executable(command) {
  return (process.env.PATH || '').split(path.delimiter).some(dir => {
    try { fs.accessSync(path.join(dir, command), fs.constants.X_OK); return true; } catch { return false; }
  });
}
function prerequisites() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  return [major < 22 || major === 22 && minor < 20 ? 'Node >=22.20.0 required; run mise install in the installer checkout.' : null, ...['npx', 'git'].filter(c => !executable(c)).map(c => `${c} required; install it and retry.`)].filter(Boolean);
}
function run(command, args, target, dryRun, buffer = quiet) {
  const quote = s => /^[a-zA-Z0-9_./:@,#=-]+$/.test(s) ? s : JSON.stringify(s);
  log(`$ ${[command, ...args].map(quote).join(' ')}`);
  if (dryRun) return;
  // Quiet sync commands buffer upstream output and only surface it when the command fails.
  // Informational subcommands (list/find) always stream: their output is the result.
  const result = spawnSync(command, args, buffer ? { cwd: target, encoding: 'utf8' } : { cwd: target, stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    const output = buffer ? [result.stdout, result.stderr].filter(Boolean).join('').trim() : '';
    fail(`${command} failed${result.error ? `: ${result.error.message}` : ` (exit ${result.status ?? result.signal})`}.${output ? `\n${output}` : ''} Fix the error above and rerun.`);
  }
}
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? files(file) : [file];
  });
}
function filePlan(scope, target) {
  const dir = path.join(root, scope === 'user' ? 'home' : 'template/project');
  return files(dir).map(src => {
    const dst = path.join(target, path.relative(dir, src));
    let stat;
    try { stat = fs.lstatSync(dst); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const current = scope === 'user' ? stat?.isSymbolicLink() && fs.readlinkSync(dst) === src : stat?.isFile() && fs.readFileSync(src).equals(fs.readFileSync(dst));
    return { src, dst, current, conflict: Boolean(stat) && !current };
  }).filter(file => !file.current);
}
function syncFiles(plan, scope, options) {
  const conflicts = plan.filter(f => f.conflict);
  if (conflicts.length && !options.adopt && !options.dryRun) fail(`Conflicts left untouched:\n${conflicts.map(f => `  ${f.dst}`).join('\n')}\nReview them, then rerun with --adopt to back them up. For skills only: agentic skills install.`);
  const stamp = `${new Date().toISOString().replace(/[-:.]/g, '')}.${process.pid}`;
  for (const { src, dst, conflict } of plan) {
    if (conflict) {
      log(`${options.adopt ? 'backup' : 'conflict (would require --adopt)'}: ${dst}`);
      if (!options.dryRun) fs.renameSync(dst, `${dst}.bak.${stamp}`);
    }
    log(`${scope === 'user' ? 'link' : 'copy'}: ${dst} <- ${src}`);
    if (!options.dryRun) {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      if (scope === 'user') fs.symlinkSync(src, dst); else fs.copyFileSync(src, dst);
    }
  }
}
function syncSkills(m, config, scope, target, dryRun) {
  const groups = new Map();
  for (const name of config.names) {
    const skill = m.skills[name];
    let source = skill.source === 'local' ? path.join(root, skill.path) : skill.source + (skill.path ? `/${skill.path}` : '') + (skill.ref ? `#${skill.ref}` : '');
    if (!groups.has(source)) groups.set(source, []);
    groups.get(source).push(name);
  }
  // One upstream fetch per source/ref/path, not one fetch per skill.
  for (const [source, names] of groups) run('npx', ['--yes', skillsCLI, 'add', source, '--skill', ...names, ...(scope === 'user' ? ['--global'] : []), '--agent', ...config.agents, '--yes'], target, dryRun);
}
function saveSettings(config) {
  const content = `${JSON.stringify({ profiles: config.profiles, agents: config.selection }, null, 2)}\n`;
  if (fs.existsSync(config.file) && fs.readFileSync(config.file, 'utf8') === content) return;
  fs.mkdirSync(path.dirname(config.file), { recursive: true });
  fs.writeFileSync(config.file, content);
  log(`preferences: ${config.file}`);
}
function main() {
  const argv = process.argv.slice(2);
  const options = parse([...argv]);
  quiet = Boolean(options.quiet);
  if (options.help) { console.log(help); return; }
  const m = manifest();
  if (options.command === 'profiles') {
    for (const [profile, names] of Object.entries(m.profiles)) console.log(`${profile} (${names.length}): ${names.join(', ')}`);
    return;
  }
  const { scope, target } = detectScope(options);
  const config = settings(options, target, scope, m);
  log(`Scope: ${scope} | Target: ${target}${options.dryRun ? ' | dry run' : ''}`);
  log(`Profiles: ${config.profiles.join(', ')} | Agents: ${config.agents.join(', ')} | Skills: ${options.skills ? config.names.length : 'skipped'}`);
  if (options.command === 'update') {
    if (!fs.existsSync(path.join(root, '.git'))) fail(`Not a Git checkout: ${root}. Reinstall with get-started.sh.`);
    if (capture('git', ['status', '--porcelain']).length) fail(`Installer checkout has local changes: ${root}. Commit or stash them before updating.`);
    run('git', ['pull', '--ff-only'], root, options.dryRun);
    run(process.execPath, [path.join(root, 'scripts/agentic.mjs'), 'install', ...argv.slice(1)], process.cwd(), options.dryRun);
    return;
  }
  const plan = ['install', 'doctor'].includes(options.command) ? filePlan(scope, target) : [];
  if (options.command === 'doctor') {
    const errors = options.skills ? prerequisites() : [];
    for (const file of plan) errors.push(`${file.conflict ? 'conflict' : 'missing'}: ${file.dst}`);
    if (options.skills) for (const name of config.names) {
      const file = path.join(target, '.agents/skills', name, 'SKILL.md');
      if (!fs.existsSync(file)) errors.push(`missing skill: ${name} (${file})`);
    }
    if (errors.length) fail(`${errors.join('\n')}\nRun agentic install${scope === 'user' ? ' --user' : ` --project ${JSON.stringify(target)}`} to sync. Doctor checks local presence, not upstream freshness.`);
    console.log('OK: local files and selected skills are in sync (no network check).');
    return;
  }
  if (options.skills && !options.dryRun) {
    const errors = prerequisites();
    if (errors.length) fail(errors.join('\n'));
  }
  if (options.command.startsWith('skills ') && options.command !== 'skills install') {
    const command = options.command.slice(7);
    if (['add', 'remove'].includes(command) && !options.extra.some(a => !a.startsWith('-'))) fail(`skills ${command} needs ${command === 'add' ? 'a source' : 'a skill name'}.`);
    const flags = command === 'find' ? [] : [...(scope === 'user' ? ['--global'] : command === 'update' ? ['--project'] : []), ...(command === 'list' ? [] : ['--yes'])];
    run('npx', ['--yes', skillsCLI, command, ...options.extra, ...flags, ...(['add', 'list'].includes(command) ? ['--agent', ...config.agents] : [])], target, options.dryRun, !['list', 'find'].includes(command));
    return;
  }
  syncFiles(plan, scope, options);
  if (options.skills) {
    syncSkills(m, config, scope, target, options.dryRun);
    if (!options.dryRun) saveSettings(config);
  }
  log(options.dryRun ? 'Preview only: nothing written or fetched.' : 'Done. Restart your coding agent to load newly installed skills.');
  if (scope === 'user' && options.command === 'install' && !(process.env.PATH || '').split(path.delimiter).includes(path.join(home, '.local/bin'))) log('To use agentic by name, add this to your shell config: export PATH="$HOME/.local/bin:$PATH"');
}
try { main(); } catch (error) { console.error(`Error: ${error.message}`); process.exitCode = 1; }
