#!/usr/bin/env bash
# Unified launcher: user dotfiles or project bootstrap.
# Usage:
#   ./setup.sh                    # interactive prompts
#   ./setup.sh --user             # user mode (non-interactive, --apply)
#   ./setup.sh --project [dir]    # project mode (non-interactive, --apply)
#   ./setup.sh --check            # report drift (any mode)
#   ./setup.sh --adopt            # back up conflicts to .bak.<ts>
#   ./setup.sh --help             # full usage
set -euo pipefail
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
STAMP="$(date +%Y%m%d%H%M%S)"
DRIFT=0

MODE=""
ADOPT=0
SCOPE=""
TARGET_DIR="$PWD"
WITH_SKILLS=""
PROFILES="base"
AGENTS="pi,opencode"

usage() {
  sed -n '2,22p' "$0" | sed 's/^# //;s/^#$//'
  echo
  echo "Flags:"
  echo "  --user             Install user dotfiles (non-interactive)"
  echo "  --project [dir]    Init project in DIR (default: cwd)"
  echo "  --check            Report drift, exit nonzero if any"
  echo "  --apply            Apply changes (default)"
  echo "  --adopt            Back up conflicts to .bak.<STAMP>"
  echo "  --no-skills        Skip skill installs"
  echo "  --profiles X,Y     Select profiles (default: base)"
  echo "  --agents X,Y       Target agents (default: pi,opencode)"
  exit 0
}

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
    IFS= read -r -s -n 1 key || { printf "\n"; return 1; }
  elif (exec 0</dev/tty) 2>/dev/null; then
    IFS= read -r -s -n 1 key </dev/tty || { printf "\n"; return 1; }
  else
    printf "\n"
    return 1
  fi
  REPLY_KEY="$key"
  return 0
}

# --- parse flags ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --user) SCOPE="user"; MODE="${MODE:-apply}"; shift ;;
    --project) SCOPE="project"; MODE="${MODE:-apply}"; shift; [[ $# -gt 0 && "$1" != -* ]] && { TARGET_DIR="$(cd "$1" && pwd)"; shift; } ;;
    --check|--apply) MODE="$1"; shift ;;
    --adopt) ADOPT=1; shift ;;
    --no-skills) WITH_SKILLS=0; shift ;;
    --profiles) PROFILES="$2"; shift 2 ;;
    --agents) AGENTS="$2"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown: $1" >&2; usage; exit 1 ;;
  esac
done

# --- interactive scope selection ---
if [[ -z "$SCOPE" ]]; then
  echo "Agentic Coding Setup"
  echo "Install for [u]ser or [p]roject? (u/p)"
  printf "> "
  if read_key; then
    case "$REPLY_KEY" in
      u|U) SCOPE="user" ;;
      p|P) SCOPE="project" ;;
      *) echo "Invalid." >&2; exit 1 ;;
    esac
  else
    echo "No tty." >&2; exit 1
  fi
  MODE="${MODE:-apply}"
fi

echo "Scope: $SCOPE  Mode: $MODE  Adopt: $ADOPT"

# ── USER ────────────────────────────────────────────────────────────────
user_setup() {
  # link home/* -> $HOME
  link_file() {
    local src="$1" dst="$2"
    if [[ -L "$dst" && "$(readlink "$dst")" == "$src" ]]; then
      return 0
    fi
    if [[ "$MODE" == "check" ]]; then
      echo "drift: $dst"; DRIFT=1; return 0
    fi
    if [[ -e "$dst" || -L "$dst" ]]; then
      if [[ "$ADOPT" -eq 1 ]]; then
        mv "$dst" "${dst}.bak.${STAMP}"
        echo "adopt: $dst -> ${dst}.bak.${STAMP}"
      else
        echo "conflict (left untouched): $dst" >&2; DRIFT=1; return 0
      fi
    fi
    mkdir -p "$(dirname "$dst")"
    ln -s "$src" "$dst"
    echo "link: $dst -> $src"
  }

  while IFS= read -r -d '' src; do
    rel="${src#$SRC_DIR/home/}"
    link_file "$src" "$HOME/$rel"
  done < <(find "$SRC_DIR/home" -type f -print0 | sort -z)

  # interactive skills prompt
  if [[ -z "$WITH_SKILLS" ]]; then
    if confirm "Install global skills?"; then WITH_SKILLS=1; else WITH_SKILLS=0; fi
  fi

  if [[ "$WITH_SKILLS" -eq 1 ]]; then
    command -v npx >/dev/null || { echo "npx required." >&2; exit 1; }
    if [[ "$MODE" == "check" ]]; then
      echo "(skills: not checked; profiles: $PROFILES)"
      return 0
    fi
    local IFS=','; read -ra AGENT_ARR <<< "$AGENTS"; local agent_flags=()
    for a in "${AGENT_ARR[@]}"; do agent_flags+=(-a "$a"); done
    mapfile -t SKILLS < <(PROFILES="$PROFILES" node -e '
      const m = require(process.argv[1]);
      const names = new Set();
      for (const p of process.env.PROFILES.split(",").map(s => s.trim()).filter(Boolean)) {
        for (const s of (m.profiles[p] ?? [])) names.add(s);
      }
      console.log([...names].join("\n"));
    ' "$SRC_DIR/skills.manifest.json")
    for skill in "${SKILLS[@]}"; do
      [[ -z "$skill" ]] && continue
      read -r source ref path < <(node -e '
        const m = require(process.argv[2]);
        const s = m.skills[process.argv[1]] ?? {};
        console.log([s.source ?? "", s.ref ?? "", s.path ?? ""].join(" "));
      ' "$skill" "$SRC_DIR/skills.manifest.json")
      if [[ "$source" == "local" ]]; then
        echo "skill: $skill (local ./$path)"
        npx skills add "$SRC_DIR/$path" --skill "$skill" -g "${agent_flags[@]}" -y
      else
        [[ -z "$source" ]] && { echo "skill $skill: missing source" >&2; exit 1; }
        [[ -n "$ref" ]] && source="$source#$ref"
        echo "skill: $skill ($source)"
        npx skills add "$source" --skill "$skill" -g "${agent_flags[@]}" -y
      fi
    done
  fi
}

# ── PROJECT ─────────────────────────────────────────────────────────────
project_setup() {
  copy_file() {
    local src="$1" dst="$2"
    if [[ -f "$dst" && ! -L "$dst" ]] && cmp -s "$src" "$dst"; then
      return 0
    fi
    if [[ "$MODE" == "check" ]]; then
      echo "drift: $dst"; DRIFT=1; return 0
    fi
    if [[ -e "$dst" || -L "$dst" ]]; then
      if [[ "$ADOPT" -eq 1 ]]; then
        mv "$dst" "${dst}.bak.${STAMP}"
        echo "adopt: $dst -> ${dst}.bak.${STAMP}"
      else
        echo "conflict (left untouched): $dst" >&2; DRIFT=1; return 0
      fi
    else
      echo "create: $dst"
    fi
    mkdir -p "$(dirname "$dst")"
    cp "$src" "$dst"
  }

  copy_file "$SRC_DIR/template/project/.pi/settings.json" "$TARGET_DIR/.pi/settings.json"
  copy_file "$SRC_DIR/template/project/AGENTS.md" "$TARGET_DIR/AGENTS.md"

  # interactive skills prompt
  if [[ -z "$WITH_SKILLS" ]] && confirm "Install project-local skills?"; then
    WITH_SKILLS=1
  fi

  if [[ "${WITH_SKILLS:-0}" -eq 1 ]]; then
    command -v npx >/dev/null || { echo "npx required." >&2; exit 1; }
    local IFS=','; read -ra AGENT_ARR <<< "$AGENTS"; local agent_flags=()
    for a in "${AGENT_ARR[@]}"; do agent_flags+=(-a "$a"); done
    mapfile -t SKILLS < <(PROFILES="$PROFILES" node -e '
      const m = require(process.argv[1]);
      const names = new Set();
      for (const p of process.env.PROFILES.split(",").map(s => s.trim()).filter(Boolean)) {
        for (const s of (m.profiles[p] ?? [])) names.add(s);
      }
      console.log([...names].join("\n"));
    ' "$SRC_DIR/skills.manifest.json")
    for skill in "${SKILLS[@]}"; do
      [[ -z "$skill" ]] && continue
      read -r source ref path < <(node -e '
        const m = require(process.argv[2]);
        const s = m.skills[process.argv[1]] ?? {};
        console.log([s.source ?? "", s.ref ?? "", s.path ?? ""].join(" "));
      ' "$skill" "$SRC_DIR/skills.manifest.json")
      if [[ "$source" == "local" ]]; then
        (cd "$TARGET_DIR" && npx skills add "$SRC_DIR/$path" --skill "$skill" -p "${agent_flags[@]}" -y)
      else
        [[ -n "$ref" ]] && source="$source#$ref"
        (cd "$TARGET_DIR" && npx skills add "$source" --skill "$skill" -p "${agent_flags[@]}" -y)
      fi
    done
  fi
}

# ── GO ───────────────────────────────────────────────────────────────────
if [[ "$SCOPE" == "user" ]]; then
  user_setup
elif [[ "$SCOPE" == "project" ]]; then
  project_setup
else
  echo "Invalid scope: $SCOPE" >&2; exit 1
fi

if [[ "$DRIFT" -ne 0 ]]; then
  echo "Unresolved conflicts; rerun with --adopt." >&2
  exit 1
fi
echo "Done."