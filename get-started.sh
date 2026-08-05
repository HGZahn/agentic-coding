#!/usr/bin/env bash
set -euo pipefail

REPO_OWNER_REPO="${REPO_OWNER_REPO:-HGZahn/agentic-coding}"
REPO_REF="${REPO_REF:-master}"
TARGET_DIR="$PWD"
ASSUME_YES=0
DRY_RUN=0
INSTALL_OPENCODE=1
KEYBINDINGS="ask"
BACKUP_STAMP="$(date +%Y%m%d%H%M%S)"

usage() {
  cat <<'EOF'
Usage: get-started.sh [options]

Options:
  --yes             Replace conflicting managed files without prompting
  --force           Same as --yes
  --dry-run         Show what would change
  --no-opencode     Do not create .opencode/skills
  --keybindings     Install the recommended global pi keybindings
  --no-keybindings  Do not offer to install global pi keybindings
  -h, --help        Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes) ASSUME_YES=1 ;;
    --force) ASSUME_YES=1 ;;
    --dry-run) DRY_RUN=1 ;;
    --no-opencode) INSTALL_OPENCODE=0 ;;
    --keybindings) KEYBINDINGS="yes" ;;
    --no-keybindings) KEYBINDINGS="no" ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

say() { printf '%s\n' "$*"; }
run() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf '+ '; printf '%q ' "$@"; printf '\n'
  else
    "$@"
  fi
}

confirm() {
  local prompt="$1" answer
  [[ "$ASSUME_YES" -eq 1 ]] && return 0
  if [[ ! -r /dev/tty ]] || ! read -r -p "$prompt [y/N] " answer </dev/tty; then
    return 1
  fi
  [[ "$answer" == "y" || "$answer" == "Y" ]]
}

same_path() {
  local source="$1" target="$2"
  if [[ -d "$source" && -d "$target" ]]; then
    diff -qr "$source" "$target" >/dev/null
  elif [[ -f "$source" && -f "$target" ]]; then
    cmp -s "$source" "$target"
  else
    return 1
  fi
}

backup_and_replace() {
  local source="$1" target="$2" label="$3"
  if [[ -e "$target" || -L "$target" ]]; then
    if same_path "$source" "$target"; then
      say "Unchanged ${label}."
      return
    fi
    if ! confirm "${label} differs. Replace it?"; then
      echo "Refusing to replace ${label}. Re-run with --yes or resolve the conflict." >&2
      exit 1
    fi
    local backup="${target}.bak.${BACKUP_STAMP}"
    say "Backing up ${label} to ${backup}."
    run mv "$target" "$backup"
  fi
  run mkdir -p "$(dirname "$target")"
  run cp -R "$source" "$target"
  say "Installed ${label}."
}

if [[ -n "${AGENTIC_CODING_SOURCE_DIR:-}" ]]; then
  SRC_DIR="$(cd "$AGENTIC_CODING_SOURCE_DIR" && pwd)"
else
  command -v curl >/dev/null || { echo "curl is required." >&2; exit 1; }
  command -v tar >/dev/null || { echo "tar is required." >&2; exit 1; }
  say "Downloading ${REPO_OWNER_REPO}@${REPO_REF}..."
  ARCHIVE_PATH="${TMP_DIR}/repo.tgz"
  curl -fsSL "https://codeload.github.com/${REPO_OWNER_REPO}/tar.gz/${REPO_REF}" -o "$ARCHIVE_PATH"
  TOP_DIR="$(tar -tzf "$ARCHIVE_PATH" | sed -n '1p' | cut -d/ -f1)"
  tar -xzf "$ARCHIVE_PATH" -C "$TMP_DIR"
  SRC_DIR="${TMP_DIR}/${TOP_DIR}"
fi

for required in .pi/skills .pi/extensions .pi/settings.json AGENTS.md; do
  [[ -e "${SRC_DIR}/${required}" ]] || { echo "Downloaded source is missing ${required}." >&2; exit 1; }
done

if [[ "$INSTALL_OPENCODE" -eq 1 ]]; then
  link="${TARGET_DIR}/.opencode/skills"
  if [[ -e "$link" || -L "$link" ]]; then
    if [[ ! -L "$link" || "$(readlink "$link")" != "../.pi/skills" ]]; then
      echo ".opencode/skills exists but is not the canonical ../.pi/skills symlink; refusing to modify the project." >&2
      exit 1
    fi
  fi
fi

say "Installing pi configuration into ${TARGET_DIR}..."
backup_and_replace "${SRC_DIR}/.pi/skills" "${TARGET_DIR}/.pi/skills" ".pi/skills"
backup_and_replace "${SRC_DIR}/.pi/settings.json" "${TARGET_DIR}/.pi/settings.json" ".pi/settings.json"
while IFS= read -r -d '' extension; do
  name="$(basename "$extension")"
  backup_and_replace "$extension" "${TARGET_DIR}/.pi/extensions/${name}" ".pi/extensions/${name}"
done < <(find "${SRC_DIR}/.pi/extensions" -maxdepth 1 -type f -print0 | sort -z)
backup_and_replace "${SRC_DIR}/AGENTS.md" "${TARGET_DIR}/AGENTS.md" "AGENTS.md"

if [[ "$INSTALL_OPENCODE" -eq 1 ]]; then
  link="${TARGET_DIR}/.opencode/skills"
  if [[ -L "$link" && "$(readlink "$link")" == "../.pi/skills" ]]; then
    say "Unchanged .opencode/skills symlink."
  else
    run mkdir -p "${TARGET_DIR}/.opencode"
    run ln -s ../.pi/skills "$link"
    say "Linked .opencode/skills to .pi/skills."
  fi
fi

if [[ "$KEYBINDINGS" == "ask" ]]; then
  if confirm "Install recommended global pi keybindings (Shift+Tab plan/build, Ctrl+T thinking)?"; then
    KEYBINDINGS="yes"
  else
    KEYBINDINGS="no"
  fi
fi

if [[ "$KEYBINDINGS" == "yes" ]]; then
  command -v node >/dev/null || { echo "node is required to merge pi keybindings." >&2; exit 1; }
  keybindings="${PI_CODING_AGENT_DIR:-${HOME}/.pi/agent}/keybindings.json"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    say "Would merge recommended bindings into ${keybindings}."
  else
    mkdir -p "$(dirname "$keybindings")"
    KEYBINDINGS_PATH="$keybindings" BACKUP_STAMP="$BACKUP_STAMP" node <<'NODE'
const fs = require("node:fs");
const path = process.env.KEYBINDINGS_PATH;
const exists = fs.existsSync(path);
let settings = exists ? JSON.parse(fs.readFileSync(path, "utf8")) : {};
const before = JSON.stringify(settings);
settings["app.thinking.cycle"] = "ctrl+t";
settings["app.thinking.toggle"] = [];
if (JSON.stringify(settings) !== before) {
  if (exists) fs.copyFileSync(path, `${path}.bak.${process.env.BACKUP_STAMP}`);
  fs.writeFileSync(path, `${JSON.stringify(settings, null, 2)}\n`);
}
NODE
    say "Installed recommended global pi keybindings."
  fi
fi

say "Done. Start pi in this project and approve project trust when prompted."
