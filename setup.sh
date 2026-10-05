#!/usr/bin/env bash
# Backward-compatible entry point; see ./agentic --help.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$ROOT/agentic" install "$@"
