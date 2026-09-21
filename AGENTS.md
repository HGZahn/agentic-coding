# AGENTS.md (project: agentic-coding)

Global behavior lives in `~/AGENTS.md` (source: `home/AGENTS.md` in this repo).

## This repo

- `home/` mirrors `$HOME`. `setup.sh --user` symlinks, never copies.
- `skills.manifest.json` is the only skill list — profiles map to upstream sources.
- Skills fetched via `npx skills`, not vendored (except local `skills/gpt-imagegen`).
- `template/project/` is what `setup.sh --project` copies.
- `setup.sh --user` installs dotfiles; `setup.sh --project` bootstraps a repo.
- Idempotent: `--check` reports drift, `--apply` creates links/copies, `--adopt` backs up conflicts to `.bak.<timestamp>`.
- Edit `home/` → `mise run setup`. Edit manifest → `mise run setup-all`.