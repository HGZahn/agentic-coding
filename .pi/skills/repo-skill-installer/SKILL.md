---
name: repo-skill-installer
description: Install, update, and verify skills in this repository while keeping `.pi/skills` canonical and OpenCode linked to it. Use when asked to add, refresh, verify, or dogfood skills for this shared pi setup.
---

# Repository Skill Installer

Use `.pi/skills/<skill-name>/` as the only canonical skill location.

## Workflow

1. Resolve the upstream repository, ref, and path to `SKILL.md`.
2. Put the complete skill payload under `.pi/skills/<skill-name>/`.
3. Add or update its source metadata in `skills-lock.json`.
4. Run `node scripts/skills.mjs rehash`.
5. Run `node scripts/skills.mjs verify` and confirm `.opencode/skills` still links to `../.pi/skills`.

For a normal upstream refresh:

```bash
npx skills add <source> --skill <skill-name> --agent pi -y
node scripts/skills.mjs verify
```

## Guardrails

- Never create a second skill copy under `.agents`, root `skills`, or `.opencode`.
- Never replace `.opencode/skills` with a real directory.
- Do not modify unrelated skills while updating one skill.
- Do not omit scripts, references, assets, or other files belonging to a skill.
- Stop when an upstream source path is ambiguous.

## Completion report

Report the skill name, upstream source/path, changed canonical files, and hash verification result.
