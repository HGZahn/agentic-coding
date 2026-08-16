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

read_key() {
  local key
  if [[ -t 0 ]]; then
    IFS= read -r -s -n 1 key || { REPLY_KEY=""; return 1; }
  elif (exec 0</dev/tty) 2>/dev/null; then
    IFS= read -r -s -n 1 key </dev/tty || { REPLY_KEY=""; return 1; }
  else
    IFS= read -r -n 1 key || { REPLY_KEY=""; return 1; }
  fi
  REPLY_KEY="$key"
  return 0
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

for required in .pi/skills .pi/themes .pi/extensions .pi/settings.json skill-profiles.json skills-lock.json AGENTS.md; do
  [[ -e "${SRC_DIR}/${required}" ]] || { say "Downloaded source is missing ${required}." >&2; exit 1; }
done

# --- pi config: settings + themes + extensions + AGENTS.md ---
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

install_pi() {
  apply_pi "${SRC_DIR}/.pi/settings.json" "${TARGET_DIR}/.pi/settings.json" ".pi/settings.json"
  while IFS= read -r -d '' theme; do
    name="$(basename "$theme")"
    apply_pi "$theme" "${TARGET_DIR}/.pi/themes/${name}" ".pi/themes/${name}"
  done < <(find "${SRC_DIR}/.pi/themes" -maxdepth 1 -type f -print0 | sort -z)
  while IFS= read -r -d '' extension; do
    name="$(basename "$extension")"
    apply_pi "$extension" "${TARGET_DIR}/.pi/extensions/${name}" ".pi/extensions/${name}"
  done < <(find "${SRC_DIR}/.pi/extensions" -maxdepth 1 -type f -print0 | sort -z)
  apply_pi "${SRC_DIR}/AGENTS.md" "${TARGET_DIR}/AGENTS.md" "AGENTS.md"
}

# --- skills: profile multi-select + .pi/skills + skills-lock.json ---
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

profile_skills() {
  # $1 = skill-profiles.json, $2 = profile name; prints skill names, one per line
  awk -v prof="$2" '
    $0 ~ "^  \"" prof "\": \\[" { inarr = 1; next }
    inarr && /^  \]/ { exit }
    inarr {
      line = $0
      gsub(/[",\[\]]/, "", line)
      gsub(/^[ \t]+|[ \t]+$/, "", line)
      if (line != "") print line
    }
  ' "$1"
}

select_profiles() {
  local -a names=("$@") marks
  local -i i j count=${#names[@]}
  local key c
  for ((i = 0; i < count; i++)); do marks[$i]=" "; done
  for ((i = 0; i < count; i++)); do
    if [[ "${names[$i]}" == "base" ]]; then
      marks[$i]="x"
    fi
  done

  while :; do
    printf '\nSkill profiles (toggle 1-%d, Enter to confirm):\n' "$count"
    for ((i = 0; i < count; i++)); do
      printf '  [%s] %s\n' "${marks[$i]}" "${names[$i]}"
    done
    printf '> '
    if ! read_key; then
      printf '\n'
      break
    fi
    key="$REPLY_KEY"
    if [[ -z "$key" ]]; then
      printf '\n'
      break
    fi
    for ((j = 0; j < ${#key}; j++)); do
      c="${key:j:1}"
      if [[ "$c" =~ [1-9] ]]; then
        i=$(( c - 1 ))
        if (( i < count )); then
          [[ "${marks[$i]}" == "x" ]] && marks[$i]=" " || marks[$i]="x"
        fi
      fi
    done
  done

  SELECTED_PROFILES=()
  for ((i = 0; i < count; i++)); do
    if [[ "${marks[$i]}" == "x" ]]; then
      SELECTED_PROFILES+=("${names[$i]}")
    fi
  done
  return 0
}

install_skills() {
  local skill
  for skill in "$@"; do
    if [[ -d "${SRC_DIR}/.pi/skills/${skill}" ]]; then
      apply_skills "${SRC_DIR}/.pi/skills/${skill}" "${TARGET_DIR}/.pi/skills/${skill}" ".pi/skills/${skill}"
    else
      say "  skip     .pi/skills/${skill} (missing in source)" >&2
    fi
  done
  apply_skills "${SRC_DIR}/skills-lock.json" "${TARGET_DIR}/skills-lock.json" "skills-lock.json"

  # OpenCode compatibility (secondary): link .opencode/skills -> ../.pi/skills when possible.
  link="${TARGET_DIR}/.opencode/skills"
  if [[ -L "$link" && "$(readlink "$link")" == "../.pi/skills" ]]; then
    say "  unchanged .opencode/skills"
  elif [[ -e "$link" || -L "$link" ]]; then
    say "  skip     .opencode/skills (exists; left untouched)"
  else
    mkdir -p "${TARGET_DIR}/.opencode"
    ln -s ../.pi/skills "$link"
    say "  link     .opencode/skills -> ../.pi/skills"
    skills_changes=1
  fi
}

say "Agentic coding setup"
say "Install into: ${TARGET_DIR}"

if confirm "Install pi config (settings, themes, extensions, AGENTS.md)?"; then
  install_pi
  [[ "$pi_changes" -eq 1 ]] && say "Installed pi config."
fi

if confirm "Install skills?"; then
  PROFILE_NAMES=()
  while IFS= read -r name; do
    PROFILE_NAMES+=("$name")
  done < <(awk '
    /^  "[^"]+": \[/ {
      name = $0
      sub(/^  "/, "", name)
      sub(/": \[.*/, "", name)
      print name
    }
  ' "${SRC_DIR}/skill-profiles.json")

  select_profiles "${PROFILE_NAMES[@]}"

  if [[ "${#SELECTED_PROFILES[@]}" -eq 0 ]]; then
    say "No skill profiles selected; nothing to install." >&2
    exit 1
  fi

  SELECTED_SKILLS=()
  for profile in "${SELECTED_PROFILES[@]}"; do
    while IFS= read -r skill; do
      if [[ -z "$skill" ]]; then
        continue
      fi
      found=""
      for existing in "${SELECTED_SKILLS[@]}"; do
        if [[ "$existing" == "$skill" ]]; then
          found=1
          break
        fi
      done
      if [[ -z "$found" ]]; then
        SELECTED_SKILLS+=("$skill")
      fi
    done < <(profile_skills "${SRC_DIR}/skill-profiles.json" "$profile")
  done

  say "Installing profiles: ${SELECTED_PROFILES[*]}"
  install_skills "${SELECTED_SKILLS[@]}"
  [[ "$skills_changes" -eq 1 ]] && say "Installed skills."
fi

say "Done. Start pi in this project and approve project trust when prompted."
