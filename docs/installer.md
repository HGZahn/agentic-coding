# Installer design

## Decision: established skill manager, thin local launcher

Keep [Vercel Skills](https://github.com/vercel-labs/skills). It already implements agent-specific paths, canonical storage, symlinks, source parsing, lockfiles, listing, removal, search, and scoped updates. Reimplementing those would create another package manager to maintain.

The local `agentic` layer is limited to the things upstream does not know about: this repo's manifest profiles, persistent preferences, personal dotfiles, project templates, and the installer checkout itself.

## What larger projects teach us

These comparisons use upstream documentation and CLI behavior, not popularity alone:

| Project | Relevant pattern | Applied here |
|---------|------------------|--------------|
| [chezmoi](https://www.chezmoi.io/quick-start/) | One-command bootstrap, explicit preview/apply, persistent source directory, a named update command. | Keep a permanent checkout; provide dry-run/doctor and `agentic update`. |
| [Dotbot](https://github.com/anishathalye/dotbot#installing-your-dotfiles) | A small idempotent installer; Git handles version control; symlink sources must remain available. | Keep the existing `home/` layout, preflight conflicts, and link directly to the checkout. |
| [uv](https://github.com/astral-sh/uv#installation) | Discoverable verbs, a stable executable, separation between tool updates and project dependencies. | Install a PATH command; distinguish installer `update` from `skills update`. |
| [Vercel Skills](https://github.com/vercel-labs/skills#other-commands) | Established multi-agent install/update/list/remove/search commands and project/global scope flags. | Delegate skill operations; pin a tested CLI version; always bound scope explicitly. |

Why not migrate to chezmoi or Dotbot now? Neither replaces a skill manager or handles project-local skill profiles. A migration would change the existing source layout/add another tool without eliminating the orchestration needed here. Consider chezmoi later if machine-specific templating or secret management becomes necessary; neither is part of this change.

## Fixed failure modes

The old script retained `--check` literally but compared it with `check`, so the advertised check mode actually applied files. It also prompted for skills in explicitly non-interactive modes (now the checklist requires a real terminal and can be declined with quiet flags), ignored unknown profiles, and duplicated the manifest-install loop for personal/project scope.

The old curl bootstrap extracted into a temporary directory, installed symlinks into it, then removed the directory. The new bootstrap retains a Git clone and verifies its origin, branch, and clean working tree before updating it.

Checks/previews do not call upstream installers. Actual file installs preflight conflicts before writing any dotfiles/templates. `--adopt` renames conflicts into timestamped backups. Skill installs remain upstream-managed and can overwrite installed skill copies; dotfile backup behavior is not a skill-content backup mechanism.

## Scope and state boundaries

1. Explicit scope overrides detection. The bootstrap defaults to personal; the installed command detects context.
2. In the installer checkout or outside a recognized project, use personal scope. Otherwise, prefer the Git project root; without Git, walk up for supported project markers.
3. Explicit profile/agent selections override per-scope saved preferences. Stack detection applies only when no saved profile selection exists.
4. Save preferences only after a successful skill sync. The manifest remains the sole curated skill list.
5. `agentic update` pulls only the installer checkout and reloads its new code. `skills update` never pulls project Git history.

Skill reconciliation adds/refreshes the selected profiles; it does not implement destructive pruning. Ad-hoc installations are handled by upstream lockfiles, not copied into a second custom catalog. Project preferences and upstream `skills-lock.json` can be committed when sharing the setup with a team. Review upstream-generated skill files/symlinks before committing them.

## Interactive selection and quiet mode

Profiles are the selection unit; agents stay a flag (or saved preference). An install run (plain `agentic`, `agentic update`, or `agentic skills install`) that has no `--profiles` shows a numbered checklist with the saved-or-detected profiles pre-checked:

```
Select skill profiles to install (Enter keeps the current selection):
  [x] 1) base        [ ] 2) pythondev   [ ] 3) devops
  [ ] 4) gamedev     [ ] 5) creative
Numbers or ranges (1,3-4), "a" for all, Enter to accept:
```

- **Enter / EOF** keeps the pre-checked selection; `a` selects all profiles; numbers and ranges toggle explicit choices; malformed or reversed input re-prompts.
- The prompt is written to stderr and only appears when **both** stdin and stdout are terminals. This keeps CI, tests, and piped runs from hanging, and it is why `get-started.sh` reattaches `/dev/tty` to the **child** process's stdin rather than `exec`-ing it in the bootstrap shell (the rest of a `curl | bash` script still has to read from the pipe).
- `--quiet`, `-q`, `--silent`, `-s`, `--yes`, and `-y` are one behavior with several spellings: skip the checklist, accept detected defaults, and suppress `agentic`'s own progress/summary lines. Upstream output is buffered in this mode and printed only if the command fails, so quiet runs stay silent on success but still explain failures. `skills list` and `skills find` always stream their primary output; `doctor`'s result line and `--help` are never silenced.
- `--profiles` always wins and never prompts, as does a saved preference when no flag is given (Enter accepts it).

## Requested source choices

- **Explain / Logo Design:** target the exact skill directory so unrelated repository contents are not selected.
- **Godot:** keep `godot-master` and its references. Upstream [explicitly discourages installing the entire catalog](https://github.com/thedivergentai/GD-Agentic-Skills#-quick-start).
- **HyperFrames:** install its router, `hyperframes-*` domain skills, and `media-use` as one grouped source. Upstream [recommends core skills with workflows loaded on demand](https://github.com/heygen-com/hyperframes#skills). Do not include repo-internal skills or registry examples.
- **Dream Loop:** install the root skill and accompanying references. Image generation/vision still have to be supplied by the host agent.

## Verification and limits

`node --test tests/*.test.mjs` uses isolated homes/projects, a stub `npx`, and local Git remotes. It covers scope detection, profiles, batching, preference persistence, dry-run, read-only checks, conflict backups, error propagation, installed launcher resolution, persistent bootstrap/update behavior, and the quiet/checklist behavior (non-TTY detection, aliases, buffered failure output, and pty-driven Enter/number/all selections). CI runs it on Linux and macOS with Node 22.

The real `skills@1.7.0` CLI was also exercised with the local `gpt-imagegen` skill in temporary personal/project scopes: installs preserve scripts, agent symlinks resolve, listings work, and project update scope is accepted. Requested skill names/paths were checked against upstream `SKILL.md` frontmatter. This is not a security audit of third-party workflows or an end-to-end test of video/image/game generation.

`doctor` checks local file drift and selected skill-file presence, not remote freshness or every agent-specific discovery link. Skill refs such as `main` remain rolling. No cron jobs, auto-update daemon, runtime package installation, shell-RC modification, or native Windows support is added.
