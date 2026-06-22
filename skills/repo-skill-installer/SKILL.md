---
name: repo-skill-installer
description: Install and update manually hosted skills in this repository, keeping canonical skill sources under `skills/`, installed output under `.agents/skills`, and `skills-lock.json` in sync. Use when asked to add, refresh, verify, or dogfood repo-local skills for this shared agent setup.
user-invocable: true
---

# Repo Skill Installer

Use this skill when a skill should be hosted by this repository.

## Workflow

1. Resolve the skill source.
   - For third-party skills, prefer the GitHub repo path and skill name.
   - For manually hosted skills, use `skills/<skill-name>/` as the canonical source.

2. Update the canonical source.
   - Put repo-owned skills under `skills/<skill-name>/`.
   - Do not vendor third-party payloads there.
   - Keep `.agents/skills/` as installer output only.

3. Register the lock entry.
   - Use `skills-lock.json` as the only source/ref/hash metadata file.
   - For repo-owned skills, use this public repo path: `https://github.com/HGZahn/agentic-coding/tree/master/skills/<skill-name>`.

4. Rebuild installed output.
   - Install locked skills with `npx skills` for Codex and opencode.
   - Recompute `computedHash` from `.agents/skills/<skill-name>`.

5. Sanity-check the result.
   - Confirm only intended canonical skills, commands, and lock entries changed.
   - Confirm installed `.agents/skills` payloads remain ignored.

## Guardrails

- Do not run broad updates unless every locked skill should refresh.
- Do not modify unrelated commands or skills.
- If the source path is ambiguous, stop and resolve it before copying files.
- If the skill contains only `SKILL.md`, do not invent extra folders.

## Output

When finished, report:
- the skill name
- the source repository/path
- the canonical files changed under `skills/`
- whether the lockfile hash matches installed output
