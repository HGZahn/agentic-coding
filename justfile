update:
    #!/usr/bin/env bash
    set -euo pipefail

    cd "{{ justfile_directory() }}"

    echo "Updating curated upstream skills..."
    npx -y skills add https://github.com/iloveitaly/ai-skills --skill justfile --agent codex -y
    npx -y skills add vercel-labs/agent-browser --skill agent-browser --agent codex -y
    npx -y skills add https://github.com/Done-0/value-realization --skill value-realization --agent codex -y
    npx -y skills add https://github.com/anthropics/skills/tree/main/skills/skill-creator --skill skill-creator --agent codex -y
    npx -y skills add https://github.com/astral-sh/claude-code-plugins/tree/main/plugins/astral/skills --skill ruff --skill uv --agent codex -y
    npx -y skills add https://github.com/ChrisWiles/claude-code-showcase/tree/main/.claude/skills/systematic-debugging --skill systematic-debugging --agent codex -y

    echo "Rebuilding skills-lock.json..."
    node <<'NODE'
    const fs = require('node:fs/promises');
    const path = require('node:path');
    const crypto = require('node:crypto');

    const ROOT = process.cwd();
    const SKILLS_DIR = path.join(ROOT, '.agents', 'skills');
    const SOURCES_PATH = path.join(ROOT, 'skills.sources.json');
    const LOCK_PATH = path.join(ROOT, 'skills-lock.json');

    async function listSkillDirs() {
    const entries = await fs.readdir(SKILLS_DIR, { withFileTypes: true });
    return entries
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort((a, b) => a.localeCompare(b));
    }

    async function collectFiles(baseDir, currentDir, out) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
        if (entry.name === '.git' || entry.name === 'node_modules') continue;
        const full = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
        await collectFiles(baseDir, full, out);
        continue;
        }
        if (!entry.isFile()) continue;
        const content = await fs.readFile(full);
        const rel = path.relative(baseDir, full).split(path.sep).join('/');
        out.push({ rel, content });
    }
    }

    async function computeSkillHash(skillDir) {
    const files = [];
    await collectFiles(skillDir, skillDir, files);
    files.sort((a, b) => a.rel.localeCompare(b.rel));
    const hash = crypto.createHash('sha256');
    for (const file of files) {
        hash.update(file.rel);
        hash.update(file.content);
    }
    return hash.digest('hex');
    }

    async function main() {
    const sources = JSON.parse(await fs.readFile(SOURCES_PATH, 'utf8'));
    const sourceMap = sources.skills || {};
    const defaultSourceType = sources.defaultSourceType || 'github';
    const skills = await listSkillDirs();
    const lock = { version: 1, skills: {} };

    for (const skill of skills) {
        const src = sourceMap[skill];
        if (!src) throw new Error(`Missing source mapping for skill: ${skill}`);
        const computedHash = await computeSkillHash(path.join(SKILLS_DIR, skill));
        const entry = {
        source: src.source,
        sourceType: src.sourceType || defaultSourceType,
        computedHash
        };
        if (src.ref) entry.ref = src.ref;
        lock.skills[skill] = entry;
    }

    await fs.writeFile(LOCK_PATH, JSON.stringify(lock, null, 2) + '\n', 'utf8');
    console.log(`Wrote ${LOCK_PATH} with ${skills.length} skills`);
    }

    main().catch((err) => {
    console.error(err.message || String(err));
    process.exit(1);
    });
    NODE

    echo "Done."
