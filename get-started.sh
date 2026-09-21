#!/usr/bin/env bash
# One-liner: curl -fsSL https://raw.githubusercontent.com/HGZahn/agentic-coding/master/get-started.sh | bash
set -euo pipefail
REPO="${REPO:-HGZahn/agentic-coding}"
REF="${REF:-master}"
TARGET="$(mktemp -d)"
trap 'rm -rf "$TARGET"' EXIT
command -v curl >/dev/null || { echo "curl required" >&2; exit 1; }
command -v tar >/dev/null || { echo "tar required" >&2; exit 1; }
curl -fsSL "https://codeload.github.com/$REPO/tar.gz/$REF" -o "$TARGET/repo.tgz"
top="$(tar -tzf "$TARGET/repo.tgz" | sed -n '1p' | cut -d/ -f1)"
tar -xzf "$TARGET/repo.tgz" -C "$TARGET"
cd "$TARGET/$top"
bash setup.sh