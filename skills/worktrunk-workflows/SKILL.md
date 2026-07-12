---
name: worktrunk-workflows
description: Use Worktrunk (`wt`) to create, inspect, merge, and safely remove Git worktrees for parallel coding agents. Use when asked about `wt`, Worktrunk, isolated branches, parallel agent worktrees, `.config/wt.toml`, Worktrunk hooks, or worktree cleanup.
license: MIT
---

# Worktrunk Workflows

Use Worktrunk as lifecycle orchestration around Git worktrees. Prefer reversible commands and previews over manual path management.

## Build Context

Before a nontrivial operation:

1. Confirm repository state with `git status --short` and `git branch --show-current`.
2. Confirm Worktrunk is available with `wt --version`. On Windows it may be installed as `git-wt`.
3. Inspect worktrees with `wt list` or `wt list --full`.
4. Read `.config/wt.toml` when changing project behavior. Read `~/.config/worktrunk/config.toml` only when changing personal behavior.
5. Use `wt <command> --help` when flags may differ from these instructions.

## Safety

- Do not remove worktrees or branches unless the user explicitly requests cleanup.
- Show `wt list` before cleanup.
- Never use `wt remove --force`, `wt remove -D`, `wt step prune`, or `wt step relocate --clobber` without explicit intent.
- Preview bulk cleanup with `wt step prune --dry-run`.
- Remember that `wt merge <target>` merges the current branch into the target and normally removes the integrated worktree and branch.
- Use `wt merge --no-remove <target>` when the worktree must remain.
- Put personal commands, aliases, and LLM configuration in user config, not versioned project config.
- Validate hook commands against the repository's actual scripts before adding them.

## Core Commands

```bash
# Inspect worktrees and their status
wt list
wt list --full

# Create or enter a worktree by branch name
wt switch --create feature-auth
wt switch feature-auth

# Create a worktree and launch an agent there
wt switch --create --execute claude feature-auth -- 'Implement authentication'
wt switch --create --execute opencode feature-docs -- 'Improve the docs'

# Commit staged work with Worktrunk's configured message generation
wt step commit

# Merge the current branch into main and normally clean it up
wt merge main

# Remove the current or named integrated worktree
wt remove
wt remove feature-auth
```

Short flags such as `-c` and `-x` may be used interactively, but prefer long flags in automation and agent output.

## Parallel Agents

Give each independent task its own branch and worktree. Ensure task boundaries do not overlap before launching agents.

```bash
wt switch --create --execute claude feature-api -- 'Implement the API changes'
wt switch --create --execute codex feature-tests -- 'Add integration tests'
wt switch --create --execute opencode feature-docs -- 'Update documentation'
```

After launch, report each branch, agent, and worktree path from `wt list`. Do not claim an agent started successfully unless the command confirms it.

## Configuration Scope

| Behavior | File |
| --- | --- |
| Team setup, checks, and shared hooks | `.config/wt.toml` |
| Personal paths, aliases, and LLM command | `~/.config/worktrunk/config.toml` |
| Repository-specific personal override | `[projects."<identifier>"]` in user config |

Use `wt config show` to inspect effective configuration and project identifiers.

## Hook Selection

| Need | Hook |
| --- | --- |
| Blocking setup before use | `pre-start` |
| Dependency install, cache copy, or dev server | `post-start` |
| Fast formatting, lint, or type checking | `pre-commit` |
| Tests and builds | `pre-merge` |
| Stop or remove external resources | `pre-remove` or `post-remove` |
| Terminal or IDE updates | `pre-switch` or `post-switch` |

Example project configuration:

```toml
[pre-start]
env = "cp -n .env.example .env 2>/dev/null || true"

[[post-start]]
copy = "wt step copy-ignored"

[[post-start]]
install = "pnpm install"
server = "wt step tether -- pnpm dev -- --port {{ branch | hash_port }}"

[pre-commit]
check = "pnpm lint"

[pre-merge]
test = "pnpm test"
```

Adapt commands to the detected package manager and scripts. Do not paste this example without inspecting the repository.

## Validation

After changing Worktrunk configuration:

1. Run `wt config show` to validate and inspect effective config.
2. Run `wt hook show --expanded` when hooks changed.
3. Run `wt config alias dry-run <name>` when aliases changed.
4. Run `wt step copy-ignored --dry-run` when copy rules changed.
5. Mention first-run hook approval and `wt config approvals add` for noninteractive environments.
6. Find hook logs with `wt config state logs` when troubleshooting.

## Troubleshooting

- If `wt switch` does not change directories, run `wt config shell install`, then restart the shell.
- If hooks fail, inspect `wt hook show --expanded` and `wt config state logs` before changing config.
- If cleanup is blocked, inspect dirty and unpushed state instead of forcing removal.
- If behavior is uncertain, trust the installed version's `wt <command> --help` over remembered syntax.
