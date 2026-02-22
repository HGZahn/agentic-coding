# justfile Language Reference

## What `just` is

- `just` is a command runner for project tasks.
- Tasks are recipes stored in a `justfile`.
- `just` is not a build system; dependency semantics are recipe-order semantics.

## File and item model

Use `justfile` (or `Justfile`). Top-level items:

- `set` statements
- variable assignments (`name := expression`)
- aliases (`alias short := target`)
- recipes
- imports (`import`) and modules (`mod`)

Minimal file:

```just
set dotenv-load

project := "api"

default:
  @just --list

build:
  echo "build {{project}}"
```

## Recipe anatomy

General form:

```just
recipe-name [params...] : [deps...] [&& subsequent-deps...]
  command line 1
  command line 2
```

Execution markers:

- `@` do not echo command
- `-` ignore failure for that line
- `-@` or `@-` combine both

Example:

```just
clean:
  -rm -rf dist
  @echo "clean complete"
```

## Default recipe, listing, and aliases

Default behavior:

- `just` with no recipe runs `[default]` recipe when present.
- Otherwise it runs the first recipe.

Alias pattern:

```just
alias b := build

build:
  cargo build
```

Useful listing commands:

```bash
just --list
just --summary
just --list --unsorted
```

## Variables, expressions, and interpolation

Assignment:

```just
name := "value"
```

Interpolation:

```just
target := "release"

show:
  echo {{target}}
```

Expression patterns:

```just
arch := "wasm"
triple := arch + "-unknown-unknown"
artifact := arch / "artifact.txt"
mode := if arch == "wasm" { "web" } else { "native" }
```

Notes:

- `+` concatenates strings.
- `/` joins paths.
- `if ... { ... } else { ... }` works in expressions.
- backticks evaluate shell command output into a value.

## Strings

- double quotes support escapes.
- single quotes are raw strings.
- multiline forms exist for both.
- shell-expanded strings and format strings are available for advanced cases.

## Parameters

Required parameter:

```just
build target:
  echo "build {{target}}"
```

Default parameter:

```just
test suite="unit":
  cargo test {{suite}}
```

Variadic parameters:

```just
lint +FLAGS='--all-targets':
  cargo clippy {{FLAGS}}

run *ARGS:
  ./bin/app {{ARGS}}
```

Export parameter:

```just
deploy $ENV:
  ./scripts/deploy.sh "$ENV"
```

## Recipe parameters advanced

Option-style parameters with attributes:

```just
[arg("target", long="target", short="t", help="Build target")]
build target:
  cargo build -p {{target}}
```

Flag-style parameter (no separate value on CLI):

```just
[arg("force", long="force", value="--force")]
deploy force="":
  ./scripts/deploy.sh {{force}}
```

Pattern-constrained parameter:

```just
[arg("env", pattern="dev|staging|prod")]
ship env:
  ./ship {{env}}
```

Dependency argument passing:

```just
default: (build "release")

build mode:
  echo {{mode}}
```

## Dependencies

Prior dependencies run before recipe body:

```just
test: build
  ./test
```

Subsequent dependencies run after recipe body:

```just
publish: build && notify
  ./publish.sh
```

Behavior:

- within one invocation, recipe with same arguments runs once.

## High-value settings

```just
set shell := ["bash", "-uc"]
set windows-shell := ["powershell.exe", "-NoLogo", "-Command"]
set dotenv-load
set export
set positional-arguments
set quiet
set fallback
set working-directory := "subdir"
set unstable
```

Semantics:

- `shell` / `windows-shell`: command interpreter.
- `dotenv-*`: `.env` loading behavior.
- `export`: export just variables to environment.
- `positional-arguments`: expose recipe args via shell positionals.
- `quiet`: global no-echo.
- `fallback`: search parent justfiles when recipe missing.
- `working-directory`: execute relative to configured directory.
- `unstable`: enable unstable features.

## High-value attributes

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

[parallel]
all-checks: lint test fmt
  @echo done

[unix]
unix-only:
  echo unix

[windows]
windows-only:
  Write-Host "windows"
```

## Functions that matter most

Use functions to avoid brittle shell parsing.

System/invocation:

- `os()`, `os_family()`, `arch()`
- `invocation_directory()`
- `justfile()`, `justfile_directory()`
- `just_executable()`, `just_pid()`

Environment:

- `env_var("NAME")`
- `env_var_or_default("NAME", "fallback")`

Path/string helpers:

- `join(...)`, `absolute_path(path)`, `clean(path)`
- `file_name(path)`, `file_stem(path)`, `parent_directory(path)`
- `extension(path)`, `without_extension(path)`
- `path_exists(path)`
- `replace`, `trim`, `uppercase`, `lowercase`

Example:

```just
root := invocation_directory()
config := join(root, "config", "app.toml")

show-config:
  echo {{config}}
```

## Shebang and script recipes

Shebang recipe:

```just
python:
  #!/usr/bin/env python3
  print("hello")
```

Script recipe:

```just
[script]
hello-script:
  echo "script mode"
```

Use shebang when interpreter must be explicit inside the recipe body. Use
`[script]` when script execution behavior is desired without embedding shebang.

## Imports and modules

Import:

```just
import "shared.just"
```

Module:

```just
mod infra
```

Invocation:

```bash
just infra::plan
```

Use modules/imports to keep large task sets isolated.

## Argument splitting and quoting

Bad:

```just
search QUERY:
  curl https://example.test?q={{QUERY}}
```

If `QUERY` has spaces, shell splits arguments unexpectedly.

Good:

```just
search QUERY:
  curl 'https://example.test?q={{QUERY}}'
```

With positional-arguments enabled, use `"$@"` carefully when forwarding args.

## Formatting, dump, and fallback behavior

Format in place:

```bash
just --fmt --unstable
```

Check-only formatting:

```bash
just --fmt --check --unstable
```

Dump canonical representation:

```bash
just --dump
just --dump --dump-format json
```

Fallback caution:

- `set fallback` can resolve missing recipes from parent justfiles.
- use only when parent fallback behavior is intentional and documented.

## Common failure patterns

1. Symptom: parser error near body.
Cause: indentation mismatch.
Fix: normalize indentation in recipe body.

2. Symptom: command arguments split unexpectedly.
Cause: unquoted interpolation.
Fix: quote argument containing interpolation.

3. Symptom: command works on Unix, fails on Windows.
Cause: shell mismatch.
Fix: configure `shell` and `windows-shell` explicitly.

4. Symptom: paths resolve unexpectedly.
Cause: implicit directory change to justfile directory.
Fix: use `[no-cd]` or explicit `working-directory`.

5. Symptom: format check fails in CI.
Cause: non-canonical formatting.
Fix: run `just --fmt --unstable`, then verify with `--check`.
