update:
    #!/usr/bin/env bash
    set -euo pipefail

    cd "{{ justfile_directory() }}"

    echo "Installing/updating locked skills..."
    node <<'NODE' | while IFS= read -r line; do
    set -- $line
    npx -y skills add "$2" --skill "$1" --agent codex opencode -y
    done
    const fs = require('node:fs');
    const lock = JSON.parse(fs.readFileSync('skills-lock.json', 'utf8'));
    for (const [name, entry] of Object.entries(lock.skills || {})) {
    console.log(`${name} ${entry.source}`);
    }
    NODE

    echo "Recomputing skills-lock.json hashes..."
    node <<'NODE'
    const fs = require('node:fs/promises');
    const path = require('node:path');
    const crypto = require('node:crypto');

    const ROOT = process.cwd();
    const SKILLS_DIR = path.join(ROOT, '.agents', 'skills');
    const LOCK_PATH = path.join(ROOT, 'skills-lock.json');

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
    const existing = JSON.parse(await fs.readFile(LOCK_PATH, 'utf8'));
    const sourceMap = existing.skills || {};
    const skills = Object.keys(sourceMap).sort((a, b) => a.localeCompare(b));
    const lock = { version: 1, skills: {} };

    for (const skill of skills) {
        const src = sourceMap[skill];
        if (!src) throw new Error(`Missing source mapping for skill: ${skill}`);
        const skillDir = path.join(SKILLS_DIR, skill);
        const computedHash = await computeSkillHash(skillDir);
        const entry = {
        ...src,
        sourceType: src.sourceType || 'github',
        computedHash
        };
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
