# justfile Syntax Reference

## Table of Contents

1. File Structure
2. Recipes and Recipe Bodies
3. Variables and Interpolation
4. Parameters and Arguments
5. Dependencies
6. Core Settings
7. Core Attributes
8. Shebang and Script Recipes
9. CLI Inspection and Validation
10. Common Pitfalls

## File Structure

- Write automation in a `justfile` (common names: `justfile`, `Justfile`).
- Top-level items include:
  - `set` statements
  - variable assignments (`name := expression`)
  - aliases (`alias short := long-name`)
  - recipes
  - imports/modules

Minimal structure:

```just
set dotenv-load

build-dir := "dist"

build:
  mkdir -p {{build-dir}}
```

## Recipes and Recipe Bodies

Recipe header pattern:

```just
recipe-name [params...] : [prior-deps...] [&& subsequent-deps...]
  command line 1
  command line 2
```

Important behavior:

- Indentation matters in recipe bodies.
- `@` prefix: do not echo command before execution.
- `-` prefix: ignore command failure.
- `-@` or `@-`: combine both.

Example:

```just
clean:
  -rm -rf dist
  @echo "clean complete"
```

Private recipes can be hidden from list output:

```just
_helper:
  echo "internal"
```

## Variables and Interpolation

Variable assignment:

```just
project := "api"
target := project + "-service"
```

Use interpolation inside recipe bodies:

```just
show:
  echo {{target}}
```

Expression patterns used often:

```just
arch := "wasm"
triple := arch + "-unknown-unknown"
artifact := arch / "build.log"
```

String notes:

- Use double quotes when escapes are needed.
- Use single quotes for raw strings.

## Parameters and Arguments

Required parameter:

```just
build target:
  echo "building {{target}}"
```

Default parameter:

```just
test suite="unit":
  cargo test {{suite}}
```

Variadic parameters:

```just
lint +FLAGS:
  cargo clippy {{FLAGS}}

run *ARGS:
  ./app {{ARGS}}
```

Exported parameter (becomes environment variable):

```just
deploy $ENV:
  echo "env is $ENV"
```

Quote interpolations that may contain spaces:

```just
search QUERY:
  curl 'https://example.test?q={{QUERY}}'
```

## Dependencies

Prior dependencies run before the recipe:

```just
test: build
  ./test
```

Pass arguments to dependencies with parentheses:

```just
default: (build "release")

build mode:
  echo {{mode}}
```

Subsequent dependencies run after the recipe body:

```just
deploy: build && notify
  ./deploy.sh
```

## Core Settings

High-value settings to know first:

```just
set shell := ["bash", "-uc"]
set windows-shell := ["powershell.exe", "-NoLogo", "-Command"]
set dotenv-load
set export
set positional-arguments
set quiet
set working-directory := "subdir"
set fallback
set unstable
```

Guidance:

- Prefer `windows-shell` over legacy `windows-powershell`.
- Use `positional-arguments` only when recipe body expects `$1`, `$2`, etc.
- Use `fallback` intentionally to avoid surprising parent-justfile resolution.

## Core Attributes

Use attributes to adjust recipe behavior:

```just
[private]
_helper:
  echo helper

[group('lint')]
lint:
  cargo clippy

[confirm("Run production deploy?")]
deploy:
  ./deploy.sh

[no-cd]
status:
  git status

[script]
python-script:
  print("hello")

[unix]
unix-only:
  echo unix

[windows]
windows-only:
  Write-Host "windows"
```

Parameter option metadata is available through `[arg(...)]` attributes in
modern `just` versions (for example long/short option mapping and help text).

## Shebang and Script Recipes

Shebang recipe (explicit interpreter in first body line):

```just
py:
  #!/usr/bin/env python3
  print("hello")
```

Script recipe via attribute:

```just
[script]
tool:
  echo "runs as a script"
```

Use shebang when interpreter choice must be explicit per recipe. Use `[script]`
when you want script execution behavior without embedding shebang lines.

## CLI Inspection and Validation

Core commands:

```bash
just --list
just --summary
just --show <recipe>
just --variables
just --evaluate [variable]
just --dry-run <recipe>
just --dump
```

Validation flow:

```bash
scripts/validate_justfile.sh [path]
just --dry-run <recipe>
just <recipe>
```

## Common Pitfalls

- Interpolation splitting:
  - `{{VALUE}}` can split on spaces in shell. Quote when needed.
- Shell mismatch:
  - Commands that work in `bash` may fail under default shell or PowerShell.
- Directory assumptions:
  - `just` runs from justfile directory by default unless `[no-cd]` is used.
- Hidden side effects:
  - Recursive `just` calls start a new invocation context.
- Formatting drift:
  - Use `just --check` (and `--unstable` when required by your version) in CI.
