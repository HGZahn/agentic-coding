# justfile Cookbook

Copy-paste patterns for common automation tasks.

## 1. Default recipe that lists tasks

```just
default:
  @just --list
```

## 2. Basic build/test/lint pipeline

```just
lint:
  cargo clippy --all-targets --all-features -- -D warnings

test:
  cargo test

build:
  cargo build

ci: lint test build
```

## 3. Parameterized build target

```just
build target:
  cargo build -p {{target}}
```

Run:

```bash
just build api
```

## 4. Optional parameter with default

```just
test suite="unit":
  cargo test {{suite}}
```

## 5. Option-style parameter with `[arg(...)]`

```just
[arg("target", long="target", short="t", help="crate name")]
build target:
  cargo build -p {{target}}
```

Run:

```bash
just build --target api
just build -t api
```

## 6. Pattern-constrained parameter

```just
[arg("env", pattern="dev|staging|prod")]
deploy env:
  ./deploy.sh {{env}}
```

## 7. Variadic flags pass-through

```just
clippy +FLAGS='--all-targets':
  cargo clippy {{FLAGS}}
```

Run:

```bash
just clippy --all-targets --all-features
```

## 8. Exported parameter for environment-driven command

```just
deploy $ENV:
  ./scripts/deploy.sh "$ENV"
```

## 9. Dotenv-backed runtime config

```just
set dotenv-load

serve:
  ./server --db "$DATABASE_URL" --port "$PORT"
```

## 10. Safe destructive command with confirmation

```just
[confirm("Delete build artifacts?")]
clean-all:
  rm -rf build dist coverage
```

## 11. Private helper recipe

```just
[private]
_ensure-tools:
  command -v jq >/dev/null

report: _ensure-tools
  ./scripts/report.sh | jq .
```

## 12. Grouped recipes for discoverability

```just
[group('quality')]
lint:
  ruff check .

[group('quality')]
fmt:
  ruff format .
```

## 13. Cross-platform shell setup

```just
set shell := ["bash", "-uc"]
set windows-shell := ["powershell.exe", "-NoLogo", "-Command"]

hello:
  echo "hello"
```

## 14. No directory change behavior

```just
[no-cd]
status:
  git status
```

## 15. Shebang Python recipe

```just
format-json:
  #!/usr/bin/env python3
  import json, sys
  print(json.dumps(json.load(sys.stdin), indent=2))
```

## 16. Script recipe attribute

```just
[script]
hello-script:
  echo "script recipe"
```

## 17. Path-safe variable construction with functions

```just
report := join(invocation_directory(), "reports", "latest.json")

show-report-path:
  echo {{report}}
```

## 18. Import shared tasks

`justfile`:

```just
import "shared.just"

all: fmt test
```

`shared.just`:

```just
fmt:
  cargo fmt --all

test:
  cargo test
```

## 19. Module-based organization

`justfile`:

```just
mod infra
```

`infra.just`:

```just
plan:
  terraform plan
```

Run:

```bash
just infra::plan
```

## 20. Module discovery commands

```bash
just --list infra
just --show infra::plan
```

## 21. Quote-safe URL query

```just
search QUERY:
  curl 'https://www.google.com/search?q={{QUERY}}'
```

## 22. Fallback to parent justfile (intentional only)

```just
set fallback

default:
  @just --list
```

Use only when parent-task inheritance is intentional and documented.

## 23. Parallel dependency execution

```just
[parallel]
all-checks: lint test fmt
  @echo "all checks complete"

lint:
  cargo clippy

test:
  cargo test

fmt:
  cargo fmt --check
```

Use only for independent dependencies.

## 24. Timestamped run for debugging order

```bash
just --timestamp ci
just --timestamp --timestamp-format "%H:%M:%S" ci
```

## 25. Signal-aware long-running wrapper

```just
watch:
  #!/usr/bin/env bash
  set -euo pipefail
  trap 'echo "stopping"; exit 130' INT TERM
  while true; do
    cargo test
    sleep 2
  done
```

## 26. Validation recipe for CI

```just
validate-justfile:
  just --fmt --check --unstable
  just --dump > /dev/null
```
