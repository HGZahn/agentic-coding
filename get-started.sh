#!/usr/bin/env bash
# curl -fsSL https://raw.githubusercontent.com/HGZahn/agentic-coding/master/get-started.sh | bash
set -euo pipefail
URL="${AGENTIC_REPO_URL:-https://github.com/${REPO:-HGZahn/agentic-coding}.git}"
REF="${REF:-master}"
TARGET="${AGENTIC_HOME:-${XDG_DATA_HOME:-$HOME/.local/share}/agentic-coding}"

if [[ "${1:-}" == --help || "${1:-}" == -h ]]; then
  printf 'Usage: bash get-started.sh [installer options]\n'
  printf 'Default: personal install. Pass --project DIR for a project.\n'
  printf 'Requires Git and Node >=22.20.0 (including npx).\n'
  printf 'Persistent checkout: %s\n' "$TARGET"
  printf 'Overrides: AGENTIC_HOME, AGENTIC_REPO_URL, REPO, REF, XDG_DATA_HOME\n'
  exit 0
fi
for cmd in git node npx; do
  command -v "$cmd" >/dev/null || { echo "$cmd required. Install Git and Node >=22.20.0 (with npm), then retry." >&2; exit 1; }
done
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 22 || major === 22 && minor < 20) { console.error("Node >=22.20.0 required."); process.exit(1); }'

# Never link dotfiles to a disposable archive. Keep the clone for future updates.
if [[ ! -e "$TARGET" && ! -L "$TARGET" ]]; then
  mkdir -p "$(dirname "$TARGET")"
  git clone --branch "$REF" --single-branch "$URL" "$TARGET"
else
  [[ -d "$TARGET/.git" ]] || { echo "Not an installer checkout: $TARGET. Set AGENTIC_HOME to a new directory." >&2; exit 1; }
  [[ "$(git -C "$TARGET" remote get-url origin)" == "$URL" ]] || { echo "Different origin in $TARGET; refusing to update it. Set AGENTIC_HOME or AGENTIC_REPO_URL explicitly." >&2; exit 1; }
  [[ -z "$(git -C "$TARGET" status --porcelain)" ]] || { echo "Local changes in $TARGET. Commit or stash them before rerunning." >&2; exit 1; }
  [[ "$(git -C "$TARGET" branch --show-current)" == "$REF" ]] || { echo "Expected branch $REF in $TARGET. Switch branches explicitly before rerunning." >&2; exit 1; }
  git -C "$TARGET" pull --ff-only
fi

# The bootstrap always defaults to personal; the installed command auto-detects scope.
SCOPE=(--user)
for arg in "$@"; do
  case "$arg" in --project|--user|--global|-g) SCOPE=(); break ;; esac
done
bash "$TARGET/setup.sh" "${SCOPE[@]}" "$@"
printf '\nInstaller retained at %s\nNext: %s/.local/bin/agentic doctor\n' "$TARGET" "$HOME"
