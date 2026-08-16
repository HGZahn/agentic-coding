# Agentic Coding for Pi

Personal dotfiles-style setup for Pi projects: integrated skills with profiles, plan/build mode, and an unobtrusive thinking display. It primarily keeps my own projects consistent; the repository is public so others can inspect or reuse the setup as-is.

`.pi/` is the source of truth. When present, OpenCode reads the same skills through `.opencode/skills -> ../.pi/skills`; it never maintains a separate copy. The defaults are intentionally opinionated rather than a general-purpose Pi configuration.

## Install

Run inside the project you want to configure:

```bash
curl -fsSL https://raw.githubusercontent.com/HGZahn/agentic-coding/master/get-started.sh | bash
```

The installer asks two questions:

1. **Install pi config?** — adds `.pi/settings.json`, `.pi/themes/`, `.pi/extensions/`, and `AGENTS.md`. Differing managed files are backed up with a `.bak.<timestamp>` suffix.
2. **Install skills?** — opens the skill-profile multi-select (below), installs the chosen profiles' skills, copies `skills-lock.json`, and links `.opencode/skills -> ../.pi/skills` when that path is free.

Then start pi and approve project trust:

```bash
pi
```

## Skill profiles

Skills are grouped into three profiles; pick any combination at install time. Each `1`–`3` keypress toggles a profile immediately; Enter confirms. Selecting none exits without installing skills.

- **base** (pre-selected) — general-purpose skills: debugging methodology, coding philosophy, meta tooling, browser automation, image generation.
- **pythondev** — Python tooling: `uv`, `ruff`.
- **devops** — debugging and productivity subset for ops work.

`skill-profiles.json` maps profiles to skills — edit it to regroup. Re-running the installer adds or updates the selected skills; it does not remove skills installed by an earlier profile selection.

## Thinking display

Thoughts are shown in full text and dimmed by the bundled `agentic` theme (`thinkingText: dimGray`) so they stay readable but unobtrusive. Tune `hideThinkingBlock` or `theme` in `.pi/settings.json`.

## Plan and build modes

The included extension provides:

- `/plan` — inspect and plan without editing project files
- `/build` — restore full file editing
- `Shift+Tab` — toggle modes

Existing global keybindings are never modified by the installer.

## Integrated skills

All skill payloads are committed under `.pi/skills` and work offline. `skills-lock.json` records each skill's upstream source, ref, path, and content hash — the harness-neutral provenance record of the whole repo; it is installed verbatim regardless of the selected profiles.

## Maintaining this repository

Requirements: Bash and Node.js.

Run `./menu.sh` to select a maintenance action interactively.

```bash
node scripts/update-pi-skills.mjs # update installed skills
node scripts/skills.mjs verify    # lock matches .pi/skills (hashes, frontmatter)
node scripts/skills.mjs rehash   # recompute hashes after editing vendored skills
bash scripts/test-install.sh     # fresh, decline, profile, repeat, conflict installs
```

Repository-owned skills are edited directly in `.pi/skills`, then `rehash` and `verify`. Profile membership is edited in `skill-profiles.json`.

## Safety

- Project credentials, sessions, models, and trust state are never copied.
- A conflicting `.opencode/skills` is never imported, backed up, or deleted; the link is simply skipped and pi installs normally.
- To uninstall, remove the managed files and the `.opencode/skills` symlink; restore a `.bak.*` file by renaming it back.
