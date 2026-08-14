#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

installer() {
  AGENTIC_CODING_SOURCE_DIR="$root" bash "$root/get-started.sh"
}

# fresh install: base profile only (base pre-selected, Enter confirms)
fresh="$tmpdir/fresh"
mkdir -p "$fresh"
cd "$fresh"
printf 'y\ny\n\n' | installer
test -d .pi/skills/5whys
test -d .pi/skills/value-realization
test ! -e .pi/skills/ruff
test ! -e .pi/skills/uv
test -f .pi/themes/agentic.json
test -f .pi/extensions/plan-build-mode.ts
test -f .pi/settings.json
test -f skills-lock.json
test -f AGENTS.md
test "$(readlink .opencode/skills)" = "../.pi/skills"

# declining both prompts writes nothing
declined="$tmpdir/declined"
mkdir -p "$declined"
cd "$declined"
printf 'n\nn\n' | installer
test ! -e .pi
test ! -e AGENTS.md
test ! -e .opencode

# base + pythondev (toggle 2, then confirm)
py="$tmpdir/py"
mkdir -p "$py"
cd "$py"
printf 'y\ny\n2\n\n' | installer
test -d .pi/skills/ruff
test -d .pi/skills/uv
test -d .pi/skills/5whys

# deselecting everything exits nonzero without installing skills
none="$tmpdir/none"
mkdir -p "$none"
cd "$none"
if (printf 'n\ny\n1\n\n' | installer); then
  echo "Expected no-profile selection to exit nonzero" >&2
  exit 1
fi
test ! -e .pi
test ! -e .opencode

# second run: already installed, no backups
cd "$fresh"
printf 'y\ny\n\n' | installer
test ! -e .pi/skills.bak.*
test ! -e .pi/themes.bak.*

# .opencode/skills conflict: link skipped, pi install still succeeds
conflict="$tmpdir/conflict"
mkdir -p "$conflict/.opencode/skills"
cd "$conflict"
printf 'y\ny\n\n' | installer
test -d .pi/skills/5whys
test -d .opencode/skills
test ! -L .opencode/skills

echo "All installer tests passed."
