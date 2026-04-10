#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f skills-lock.json ]]; then
  echo "skills-lock.json not found in $ROOT_DIR" >&2
  exit 1
fi

npx -y skills experimental_install -y
