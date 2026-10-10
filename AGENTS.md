# AGENTS.md (project: agentic-coding)

Curated agent-skill installer. **Skills only** — this checkout no longer ships a
`home/` dotfile mirror or a `template/project/` starter kit (removed in the `cleanup`
commit). `filePlan()` returns an empty plan when those directories are absent.

## This repo

- `skills.manifest.json` is the only skill list — profiles map to upstream sources.
- Skills fetched via `npx skills`, not vendored (except local `skills/gpt-imagegen`).
- `agentic` auto-detects personal/project scope; `--user` and `--project [dir]` override it.
- `scripts/agentic.mjs` orchestrates profiles and preferences; Vercel Skills owns skill installation and updates. Do not build a second skill manager.
- Idempotent: `doctor` / `--check` report missing selected skills offline, `--dry-run` previews without writes/fetches.
- `--no-skills`, `--apply`, and `--adopt` are accepted for backward compatibility; `--no-skills` is now a no-op and `--adopt` has nothing to back up.
- Bootstrap keeps a persistent Git checkout and runs `agentic` from it.
- Edit the manifest → `mise run setup-all`. There is no `home/` to edit.
- Verify with `node --test tests/*.test.mjs`; use temporary homes/projects, never live installs, when testing.