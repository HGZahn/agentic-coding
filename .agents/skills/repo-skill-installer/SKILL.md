---
name: repo-skill-installer
description: Install and update repo-local skills under `.agents/skills` in this repository, keeping `skills.sources.json` and `skills-lock.json` in sync. Use when asked to add, refresh, or verify a skill for this repo.
user-invocable: true
---

# Repo Skill Installer

Use this skill when a skill should be installed or updated in this repository only.

## Workflow

1. Resolve the upstream skill source.
   - Prefer the GitHub repo path and skill folder.
   - If given a `skills.sh` URL, resolve it to the underlying repository and skill name first.

2. Copy the skill into this repo.
   - Install into `.agents/skills/<skill-name>`.
   - Replace only the target skill directory.
   - Keep any existing files in that skill directory in sync with the source.

3. Register the source.
   - Update `skills.sources.json` with the skill's source repository and ref.
   - Use the repo's default source type unless the source requires something else.

4. Rebuild the lockfile.
   - Regenerate `skills-lock.json` using the same hash logic as the repo's update flow.
   - Verify the new lock entry matches the files now on disk.

5. Sanity-check the result.
   - Confirm only the intended skill changed.
   - Confirm the skill is local to this repo.
   - Do not touch global Codex skill directories.

## Guardrails

- Do not run the broad repo updater unless the user explicitly wants every curated skill refreshed.
- Do not modify unrelated skills.
- If the source path is ambiguous, stop and resolve it before copying files.
- If the skill contains only `SKILL.md`, do not invent extra folders.

## Output

When finished, report:
- the installed skill name
- the source repository/path
- the files changed in `.agents/skills`
- whether the lockfile hash matches
