#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

select action in "Update skills" "Verify skills lock" "Rehash skills lock" "Test installer" "Quit"; do
  case $REPLY in
    1) npx skills update ;;
    2) node scripts/skills.mjs verify ;;
    3) node scripts/skills.mjs rehash ;;
    4) bash scripts/test-install.sh ;;
    5) break ;;
    *) printf 'Invalid selection.\n' >&2 ;;
  esac
done
