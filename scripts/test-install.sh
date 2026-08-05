#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

fresh="$tmpdir/fresh"
mkdir -p "$fresh"
cd "$fresh"
printf 'y\ny\n' | AGENTIC_CODING_SOURCE_DIR="$root" bash "$root/get-started.sh"
test -d .pi/skills
test -f .pi/extensions/plan-build-mode.ts
test -f .pi/settings.json
test -f skills-lock.json
test -f AGENTS.md
test "$(readlink .opencode/skills)" = "../.pi/skills"

# declining both prompts writes nothing
declined="$tmpdir/declined"
mkdir -p "$declined"
cd "$declined"
printf 'n\nn\n' | AGENTIC_CODING_SOURCE_DIR="$root" bash "$root/get-started.sh"
test ! -e .pi
test ! -e AGENTS.md
test ! -e .opencode

# second run: already installed, no backups
cd "$fresh"
printf 'y\ny\n' | AGENTIC_CODING_SOURCE_DIR="$root" bash "$root/get-started.sh"
test ! -e .pi/skills.bak.*

# .opencode/skills conflict: fail before writing anything
conflict="$tmpdir/conflict"
mkdir -p "$conflict/.opencode/skills"
if (cd "$conflict" && printf 'y\ny\n' | AGENTIC_CODING_SOURCE_DIR="$root" bash "$root/get-started.sh"); then
  echo "Expected OpenCode conflict to fail" >&2
  exit 1
fi
test ! -e "$conflict/.pi"

echo "All installer tests passed."
