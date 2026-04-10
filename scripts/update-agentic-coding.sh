#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Updating curated upstream skills..."
npx -y skills add https://github.com/iloveitaly/ai-skills --skill justfile --agent codex -y
npx -y skills add vercel-labs/agent-browser --skill agent-browser --agent codex -y
npx -y skills add https://github.com/Done-0/value-realization --skill value-realization --agent codex -y
npx -y skills add https://github.com/anthropics/skills/tree/main/skills/skill-creator --skill skill-creator --agent codex -y
npx -y skills add https://github.com/astral-sh/claude-code-plugins/tree/main/plugins/astral/skills --skill ruff --skill uv --agent codex -y
npx -y skills add https://github.com/ChrisWiles/claude-code-showcase/tree/main/.claude/skills/systematic-debugging --skill systematic-debugging --agent codex -y

echo "Updating impeccable and converting to i-* names..."
npx -y skills add https://github.com/pbakaus/impeccable --skill '*' --agent codex -y

impeccable_skills=(
  adapt animate arrange audit bolder clarify colorize critique delight distill
  extract harden impeccable normalize onboard optimize overdrive polish quieter
  shape typeset
)

for base in "${impeccable_skills[@]}"; do
  src=".agents/skills/${base}"
  dst=".agents/skills/i-${base}"
  if [[ -d "$src" ]]; then
    rm -rf "$dst"
    mv "$src" "$dst"
  fi
done

for skill_dir in .agents/skills/i-*; do
  skill_file="${skill_dir}/SKILL.md"
  [[ -f "$skill_file" ]] || continue
  skill_name="$(basename "$skill_dir")"
  python - "$skill_file" "$skill_name" <<'PY'
import re
import sys
from pathlib import Path

skill_file = Path(sys.argv[1])
new_name = sys.argv[2]
text = skill_file.read_text(encoding="utf-8")

if text.startswith("---\n"):
    parts = text.split("---", 2)
    if len(parts) == 3:
        fm = parts[1]
        body = parts[2]
        fm2, count = re.subn(r"(?m)^name:\s*.*$", f"name: {new_name}", fm, count=1)
        if count == 0:
            fm2 = f"\nname: {new_name}\n" + fm
        skill_file.write_text(f"---{fm2}---{body}", encoding="utf-8")
PY
done

rm -rf .agents/skills/i-frontend-design .agents/skills/i-teach-impeccable

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
