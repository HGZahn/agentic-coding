# justfile Execution Workflows

## Goal

Use this guide to operate on `justfile`s predictably:

1. inspect
2. change minimal surface area
3. validate
4. dry-run risky operations
5. execute

## Workflow A: discover and inspect first

Root discovery:

```bash
just --list
just --summary
just --groups
just --variables
```

Definition inspection:

```bash
just --show <recipe>
just --usage <recipe>
```

Module discovery:

```bash
just --list module
just --list module::submodule
just --show module::recipe
```

Inspection checklist:

- recipe contract (name, params, default behavior)
- dependency graph shape
- shell assumptions
- environment requirements (`dotenv`, exported vars)

## Workflow B: edit an existing justfile

1. Inspect existing recipe and dependencies.
2. Decide whether change is:
   - behavioral (execution changes)
   - interface (args/options) changes
   - wiring (dependency/order) changes
3. Edit with smallest safe diff.
4. Validate formatting and parseability.
5. Dry-run if command is destructive/deploy/stateful.
6. Execute targeted recipe.

Validation and run sequence:

```bash
bash scripts/validate_justfile.sh [path]
just --dry-run <recipe> [args...]
just <recipe> [args...]
```

## Workflow C: create new justfile or recipe set

Start small:

```just
set dotenv-load

default:
  @just --list
```

Then add:

- one recipe per task
- private helper recipes for shared setup
- explicit dependencies between tasks
- confirmation attributes for dangerous tasks

## Workflow D: migrate shell/Make tasks to just

1. map each make target/shell script entrypoint to a recipe.
2. move literals and repeated values into variables/functions.
3. convert CLI inputs to recipe parameters.
4. use `[arg(...)]` when option-style args are needed.
5. encode ordering with dependencies.
6. add validation recipe and CI check.

Migration pattern:

```make
build:
	cargo build
```

```just
build:
  cargo build
```

## Runtime behavior to remember

### Dependency execution and parallelism

- Dependencies run before dependent recipe body.
- A recipe with same args runs once per invocation.
- Subsequent dependencies (`&&`) run after body.
- `[parallel]` can run dependencies in parallel; use only when dependencies are independent.

### Working directory behavior

- By default, recipes execute with cwd at justfile directory.
- `[no-cd]` preserves invocation directory semantics.
- `set working-directory := ...` sets explicit execution root.

### Timestamps and observability

Use timestamps when debugging execution order and latency:

```bash
just --timestamp <recipe>
just --timestamp --timestamp-format "%H:%M:%S" <recipe>
```

### Signals and interruption

For long-running recipes, test interrupt behavior (`Ctrl-C`) and ensure scripts
exit cleanly. Prefer wrappers that handle termination explicitly in shell code.

## Workflow E: debug a failing recipe

1. Reproduce exact invocation.
2. Show recipe definition.
3. Determine if failure is parser-time or runtime.
4. Check top root causes:
   - quoting/splitting
   - missing env vars
   - shell mismatch
   - dependency ordering
   - cwd assumptions
5. Apply minimal fix to root cause.
6. Re-run validator and invocation.

Debug commands:

```bash
just --show <recipe>
just --dry-run <recipe> [args...]
just --evaluate [variable]
```

## Safety conventions

- Use `[confirm]` on destructive actions.
- Keep destructive recipes isolated (`clean-all`, `reset-db`, `deploy-prod`).
- Prefer explicit parameters over implicit ambient environment.
- Use `@` for sensitive/noisy lines.
- Avoid recursive `just` calls unless needed.

## Quick checklists

### Before change

- [ ] recipe contract understood
- [ ] dependencies and ordering understood
- [ ] shell/cwd assumptions confirmed

### Before execution

- [ ] validator passed
- [ ] dry-run reviewed for risky recipes
- [ ] required env/files present

### After execution

- [ ] expected side effects occurred
- [ ] no unintended dependency runs
- [ ] listing/show output still reflects intended interface

## CI pattern

Validation recipe:

```just
validate-justfile:
  just --fmt --check --unstable
  just --dump > /dev/null
```

CI call:

```bash
just validate-justfile
```
