# Agentic Coding for Pi

A pi-first coding setup with integrated skills, plan/build mode, and strict OpenCode compatibility.

`.pi/` is the source of truth. OpenCode reads the same skills through `.opencode/skills -> ../.pi/skills`; it never maintains a separate copy.

## Install

Run inside the project you want to configure:

```bash
curl -fsSL https://raw.githubusercontent.com/HGZahn/agentic-coding/master/get-started.sh | bash
```

The installer asks two questions:

1. **Install pi config?** — adds `.pi/settings.json`, `.pi/extensions/`, and `AGENTS.md`. Differing managed files are backed up with a `.bak.<timestamp>` suffix.
2. **Install skills?** — adds `.pi/skills` and `skills-lock.json`, and links `.opencode/skills -> ../.pi/skills`.

If `.opencode/skills` already exists and is not the canonical symlink, installation stops without modifying anything.

Then start pi and approve project trust:

```bash
pi
```

## Plan and build modes

The included extension provides:

- `/plan` — inspect and plan without editing project files
- `/build` — restore full file editing
- `Shift+Tab` — toggle modes

Existing global keybindings are never modified by the installer.

## Integrated skills

All skill payloads are committed under `.pi/skills` and work offline. `skills-lock.json` records each skill's upstream source, ref, path, and content hash — the harness-neutral provenance record. Pi discovers skills from `.pi/skills`; OpenCode sees the same files through the symlink.

## Maintaining this repository

Requirements: Bash and Node.js.

Run `./menu.sh` to select a maintenance action interactively.

```bash
npx skills update                # update installed skills
node scripts/skills.mjs verify   # lock matches .pi/skills (hashes, frontmatter)
node scripts/skills.mjs rehash   # recompute hashes after editing vendored skills
bash scripts/test-install.sh     # fresh, decline, repeat, conflict installs
```

Repository-owned skills are edited directly in `.pi/skills`, then `rehash` and `verify`.

## Safety

- Project credentials, sessions, models, and trust state are never copied.
- A noncanonical `.opencode/skills` is never imported, backed up, or deleted; resolve it explicitly and rerun.
- To uninstall, remove the managed files and the `.opencode/skills` symlink; restore a `.bak.*` file by renaming it back.
