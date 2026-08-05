# Agentic Coding for Pi

A pi-first coding setup with integrated skills, plan/build mode, and strict OpenCode compatibility.

`.pi/` is the source of truth. OpenCode reads the same skills through `.opencode/skills -> ../.pi/skills`; it never maintains a separate copy.

## Get started

Run this inside the project you want to configure:

```bash
curl -fsSL https://raw.githubusercontent.com/HGZahn/agentic-coding/master/get-started.sh | bash
```

The installer adds:

```text
.pi/
├── extensions/plan-build-mode.ts
├── settings.json
└── skills/
.opencode/skills -> ../.pi/skills
AGENTS.md
```

It asks before replacing differing managed pi files. If `.opencode/skills` already exists and is not the canonical symlink, installation stops without modifying it.

Start pi and approve project trust when prompted:

```bash
pi
```

## Plan and build modes

The included pi extension provides:

- `/plan` — inspect and plan without editing project files
- `/build` — restore full file editing
- `Shift+Tab` — toggle modes when the recommended keybindings are installed
- a persistent mode indicator in the pi footer

The installer can merge the recommended global pi bindings into `~/.pi/agent/keybindings.json`:

- `Shift+Tab` toggles plan/build through the extension
- `Ctrl+T` cycles thinking level

Existing global keybindings are preserved and backed up before a change.

## Installer options

```text
--yes             replace conflicting managed files without prompting
--force           same as --yes
--dry-run         show changes without writing
--no-opencode     skip the OpenCode symlink
--keybindings     install recommended global pi keybindings
--no-keybindings  skip the keybinding prompt
```

For automation:

```bash
curl -fsSL https://raw.githubusercontent.com/HGZahn/agentic-coding/master/get-started.sh \
  | bash -s -- --yes --no-keybindings
```

Environment overrides:

- `REPO_OWNER_REPO` — source repository, default `HGZahn/agentic-coding`
- `REPO_REF` — source branch/tag/commit, default `master`
- `AGENTIC_CODING_SOURCE_DIR` — use a local checkout instead of downloading

## Integrated skills

All skill payloads are committed under `.pi/skills` and work offline after the repository archive is downloaded. `skills-lock.json` records their upstream source, path, ref, and content hash.

Pi discovers them natively from `.pi/skills`. OpenCode sees exactly the same files through the symlink.

## Maintaining this repository

Requirements: Bash, Git, Node.js, and [just](https://github.com/casey/just).

```bash
just verify                    # validate layout, frontmatter, and hashes
just test                      # exercise fresh, repeated, conflict, and dry-run installs
just update-skill ponytail     # refresh one upstream skill
just update                    # refresh every third-party skill
just install /path/to/project  # install from this checkout
```

Repository-owned skills are edited directly in `.pi/skills`. After editing one, run:

```bash
node scripts/skills.mjs rehash
just verify
```

## Safety and recovery

- Project credentials, sessions, models, and trust state are never copied.
- Unrelated files inside `.pi/extensions` and `.opencode` are preserved.
- Replaced managed files receive a timestamped `.bak.*` sibling.
- An existing noncanonical `.opencode/skills` is never imported, backed up, or deleted; resolve it explicitly and rerun.
- Use `--dry-run` to preview an installation.

To uninstall, remove the installed managed files and the `.opencode/skills` symlink. Restore a desired `.bak.*` file by renaming it to its original path.
