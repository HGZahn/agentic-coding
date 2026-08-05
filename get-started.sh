#!/usr/bin/env bash
set -euo pipefail

REPO_OWNER_REPO="${REPO_OWNER_REPO:-HGZahn/agentic-coding}"
REPO_REF="${REPO_REF:-master}"
TARGET_DIR="$(cd "$PWD" && pwd)"
BACKUP_STAMP="$(date +%Y%m%d%H%M%S)"

say() { printf '%s\n' "$*"; }

confirm() {
  local prompt="$1" answer
  if [[ -t 0 ]]; then
    read -r -p "$prompt [y/N] " answer || return 1
  elif (exec 0</dev/tty) 2>/dev/null; then
    read -r -p "$prompt [y/N] " answer </dev/tty || return 1
  else
    read -r -p "$prompt [y/N] " answer || return 1
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

# --- fetch source ---
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

if [[ -n "${AGENTIC_CODING_SOURCE_DIR:-}" ]]; then
  SRC_DIR="$(cd "$AGENTIC_CODING_SOURCE_DIR" && pwd)"
else
  command -v curl >/dev/null || { say "curl is required." >&2; exit 1; }
  command -v tar >/dev/null || { say "tar is required." >&2; exit 1; }
  say "Downloading ${REPO_OWNER_REPO}@${REPO_REF}..."
  curl -fsSL "https://codeload.github.com/${REPO_OWNER_REPO}/tar.gz/${REPO_REF}" -o "$TMP_DIR/repo.tgz"
  TOP_DIR="$(tar -tzf "$TMP_DIR/repo.tgz" | sed -n '1p' | cut -d/ -f1)"
  tar -xzf "$TMP_DIR/repo.tgz" -C "$TMP_DIR"
  SRC_DIR="$TMP_DIR/$TOP_DIR"
fi

for required in .pi/skills .pi/extensions .pi/settings.json skills-lock.json AGENTS.md; do
  [[ -e "${SRC_DIR}/${required}" ]] || { say "Downloaded source is missing ${required}." >&2; exit 1; }
done

# --- strict preflight: never touch a noncanonical .opencode/skills ---
link="${TARGET_DIR}/.opencode/skills"
if [[ -e "$link" || -L "$link" ]]; then
  if [[ ! -L "$link" || "$(readlink "$link")" != "../.pi/skills" ]]; then
    say ".opencode/skills exists but is not the canonical ../.pi/skills symlink; refusing to modify the project." >&2
    exit 1
  fi
fi

# --- pi config: settings + extensions + AGENTS.md ---
pi_changes=0
apply_pi() {
  local source="$1" target="$2" label="$3"
  if [[ -e "$target" || -L "$target" ]]; then
    if same_path "$source" "$target"; then
      return
    fi
    say "  replace  ${label}"
    mv "$target" "${target}.bak.${BACKUP_STAMP}"
  else
    say "  create   ${label}"
  fi
  mkdir -p "$(dirname "$target")"
  cp -R "$source" "$target"
  pi_changes=1
}

# --- skills: .pi/skills + skills-lock.json + opencode link ---
skills_changes=0
apply_skills() {
  local source="$1" target="$2" label="$3"
  if [[ -e "$target" || -L "$target" ]]; then
    if same_path "$source" "$target"; then
      return
    fi
    say "  replace  ${label}"
    mv "$target" "${target}.bak.${BACKUP_STAMP}"
  else
    say "  create   ${label}"
  fi
  mkdir -p "$(dirname "$target")"
  cp -R "$source" "$target"
  skills_changes=1
}

install_pi() {
  apply_pi "${SRC_DIR}/.pi/settings.json" "${TARGET_DIR}/.pi/settings.json" ".pi/settings.json"
  while IFS= read -r -d '' extension; do
    name="$(basename "$extension")"
    apply_pi "$extension" "${TARGET_DIR}/.pi/extensions/${name}" ".pi/extensions/${name}"
  done < <(find "${SRC_DIR}/.pi/extensions" -maxdepth 1 -type f -print0 | sort -z)
  apply_pi "${SRC_DIR}/AGENTS.md" "${TARGET_DIR}/AGENTS.md" "AGENTS.md"
}

install_skills() {
  apply_skills "${SRC_DIR}/.pi/skills" "${TARGET_DIR}/.pi/skills" ".pi/skills"
  apply_skills "${SRC_DIR}/skills-lock.json" "${TARGET_DIR}/skills-lock.json" "skills-lock.json"
  if [[ -L "$link" && "$(readlink "$link")" == "../.pi/skills" ]]; then
    say "  unchanged .opencode/skills"
  else
    mkdir -p "${TARGET_DIR}/.opencode"
    ln -s ../.pi/skills "$link"
    say "  link     .opencode/skills -> ../.pi/skills"
    skills_changes=1
  fi
}

say "Agentic coding setup"
say "Install into: ${TARGET_DIR}"

if confirm "Install pi config (settings, extensions, AGENTS.md)?"; then
  install_pi
  [[ "$pi_changes" -eq 1 ]] && say "Installed pi config."
fi

if confirm "Install skills (.pi/skills, skills-lock.json, .opencode/skills link)?"; then
  install_skills
  [[ "$skills_changes" -eq 1 ]] && say "Installed skills."
fi

say "Done. Start pi in this project and approve project trust when prompted."
