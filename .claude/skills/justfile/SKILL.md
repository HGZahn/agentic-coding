---
name: justfile
description: Author and debug `justfile`s for the `just` task runner, including
  recipes, parameters, dependencies, variables, settings, attributes, and
  cross-platform shell behavior. Use when creating or editing `justfile`
  automation, migrating shell/Make tasks into `just`, validating syntax and
  formatting, or troubleshooting `just` command execution.
---

# justfile

Use this skill to create, refactor, and debug `justfile` task automation with
reliable syntax and validation steps.

## Workflow

1. Inspect current behavior before editing:
   - `just --list`
   - `just --summary`
   - `just --show <recipe>`
   - `just --variables`
2. Decide change type:
   - New automation: add recipe + parameters + dependencies.
   - Existing automation: preserve behavior and adjust syntax/settings.
   - Broken automation: capture failure output first, then update only root cause.
3. Write or edit recipes using `references/justfile-syntax.md`.
4. Validate with `scripts/validate_justfile.sh [PATH]`.
5. Run safely:
   - `just --dry-run <recipe>` for risky commands.
   - `just <recipe> ...` once validation and dry-run are clean.

## High-Value Commands

```bash
just --list
just --summary
just --show <recipe>
just --variables
just --evaluate [variable]
just --dry-run <recipe>
just --dump
```

Use `--justfile <path>` when operating on non-default file locations.

## Troubleshooting Rules

- Check shell assumptions first (`set shell`, `set windows-shell`).
- Check quoting when interpolations can contain spaces.
- Check working-directory behavior (`[no-cd]` vs default directory change).
- Check parameter contracts and defaults before touching dependencies.
- Prefer deterministic validation before execution.

## Resources

- Syntax and patterns: `references/justfile-syntax.md`
- Deterministic validation: `scripts/validate_justfile.sh`
- Full manual: `https://just.systems/man/en/`
