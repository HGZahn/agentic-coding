# just CLI Reference (Most Used)

This is a task-oriented subset for frequent agent usage. For complete coverage,
run `just --help` or `just --man`.

## Discover and inspect

Core discovery:

```bash
just --list
just --summary
just --groups
just --variables
just --evaluate [variable]
```

Show definitions:

```bash
just --show <recipe-path>
just --usage <recipe-path>
```

Module-aware discovery:

```bash
just --list module
just --list module::submodule
just --show module::recipe
```

Listing controls:

```bash
just --list --unsorted
just --list --list-submodules
just --list --alias-style right
```

## Execute recipes

```bash
just <recipe> [args...]
just recipe-a recipe-b
```

Execution controls:

```bash
just --dry-run <recipe>
just --quiet <recipe>
just --yes <recipe>
just --no-deps <recipe>
just --one <recipe>
just --verbose <recipe>
```

## Target a specific justfile/location

```bash
just --justfile path/to/justfile --list
just --justfile path/to/justfile --working-directory path/to/dir <recipe>
just --dotenv-path .env.local <recipe>
```

Note: `--working-directory` requires `--justfile`.

## Formatting and structure checks

Format in place:

```bash
just --fmt --unstable
```

Check-only formatting:

```bash
just --fmt --check --unstable
```

Dump canonical/JSON:

```bash
just --dump
just --dump --dump-format json
```

## Runtime visibility and timing

```bash
just --timestamp <recipe>
just --timestamp --timestamp-format "%H:%M:%S" <recipe>
```

Use when diagnosing ordering, latency, or long-running tasks.

## Useful subcommands

```bash
just --init
just --completions bash
just --choose
just --command "echo hello"
just --edit
```

Notes:

- `--choose` defaults to `fzf` if configured chooser is absent.
- `--command` executes with just context (dotenv, overrides, cwd handling).

## Common option environment variables

High-frequency mappings:

- `JUST_UNSTABLE=1` -> `--unstable`
- `JUST_DRY_RUN=1` -> `--dry-run`
- `JUST_QUIET=1` -> `--quiet`
- `JUST_VERBOSE=1` -> `--verbose`
- `JUST_TIMESTAMP=1` -> `--timestamp`
- `JUST_TIMESTAMP_FORMAT=...` -> `--timestamp-format`
- `JUST_WORKING_DIRECTORY=...` -> `--working-directory`
- `JUST_JUSTFILE=...` -> `--justfile`
- `JUST_DOTENV_PATH=...` -> `--dotenv-path`
- `JUST_LIST_SUBMODULES=1` -> `--list-submodules`
- `JUST_UNSORTED=1` -> `--unsorted`

## Which flag when

Inspect available tasks:

```bash
just --list
```

Inspect one recipe definition:

```bash
just --show deploy
```

Check input contract for recipe options/args:

```bash
just --usage deploy
```

Preview run without side effects:

```bash
just --dry-run deploy prod
```

Validate in CI:

```bash
just --fmt --check --unstable
just --dump > /dev/null
```

Run recipe from another justfile:

```bash
just --justfile infra/justfile --working-directory infra plan
```
