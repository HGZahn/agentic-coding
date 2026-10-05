# AGENTS.md (project: agentic-coding)

Global behavior lives in `~/AGENTS.md` (source: `home/AGENTS.md` in this repo).

## This repo

- `home/` mirrors `$HOME`. `setup.sh --user` symlinks, never copies.
- `skills.manifest.json` is the only skill list — profiles map to upstream sources.
- Skills fetched via `npx skills`, not vendored (except local `skills/gpt-imagegen`).
- `template/project/` is what `setup.sh --project` copies.
- `agentic` auto-detects personal/project scope; `--user` and `--project [dir]` override it. `setup.sh` is the legacy shim.
- `scripts/agentic.mjs` orchestrates profiles/dotfiles/templates; Vercel Skills owns skill installation and updates. Do not build a second skill manager.
- Idempotent: `doctor` / `--check` report local drift, `--dry-run` previews without writes/fetches, `--adopt` backs up file conflicts to `.bak.<timestamp>`.
- Bootstrap keeps a persistent Git checkout. Never link dotfiles into temporary downloads.
- Edit `home/` → `mise run setup`. Edit manifest → `mise run setup-all`.
- Verify with `node --test tests/*.test.mjs`; use temporary homes/projects, never live installs, when testing.