#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Validate a justfile for formatting and parseability.

Usage:
  validate_justfile.sh [PATH_TO_JUSTFILE]

Behavior:
  1. Runs `just --fmt --unstable --check --justfile <path>`
  2. Runs `just --dump --justfile <path>` for parse/dump sanity
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if ! command -v just >/dev/null 2>&1; then
  echo "error: 'just' is not installed or not in PATH" >&2
  exit 127
fi

target="${1:-}"

if [[ -z "${target}" ]]; then
  for candidate in justfile Justfile .justfile .Justfile; do
    if [[ -f "${candidate}" ]]; then
      target="${candidate}"
      break
    fi
  done
fi

target="${target:-justfile}"

if [[ ! -f "${target}" ]]; then
  echo "error: justfile not found: ${target}" >&2
  exit 2
fi

echo "Validating ${target}..."

if ! just --fmt --unstable --check --justfile "${target}"; then
  echo "error: formatting check failed for ${target}" >&2
  exit 1
fi

if ! just --dump --justfile "${target}" >/dev/null; then
  echo "error: dump check failed for ${target}" >&2
  exit 1
fi

echo "OK: ${target} passed check and dump validation."
