#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 0 ]]; then
  echo "No arguments accepted. Run from the target repo directory." >&2
  exit 1
fi

TARGET_DIR="$PWD"
REPO_OWNER_REPO="${REPO_OWNER_REPO:-HGZahn/agentic-coding}"
REPO_REF="${REPO_REF:-master}"

TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"
TMP_DIR="$(mktemp -d)"
ARCHIVE_PATH="${TMP_DIR}/repo.tgz"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

confirm_replace() {
  local target_name="$1"
  local answer

  if ! exec 3<>/dev/tty; then
    echo "${target_name} already exists. No interactive terminal available; skipping." >&2
    return 1
  fi

  if ! read -r -p "${target_name} already exists. Replace it? [y/N] " answer <&3; then
    exec 3<&-
    exec 3>&-
    echo "${target_name} already exists. No interactive terminal available; skipping." >&2
    return 1
  fi

  exec 3<&-
  exec 3>&-
  [[ "$answer" == "y" || "$answer" == "Y" ]]
}

copy_dir_with_prompt() {
  local source_path="$1"
  local target_path="$2"
  local target_name="$3"

  if [[ -e "$target_path" ]]; then
    if ! confirm_replace "$target_name"; then
      echo "Skipped ${target_name}."
      return 0
    fi
    echo "Replacing ${target_name}."
    rm -rf "$target_path"
  fi

  cp -R "$source_path" "$target_path"
  echo "Installed ${target_name}."
}

copy_file_with_prompt() {
  local source_path="$1"
  local target_path="$2"
  local target_name="$3"

  if [[ -e "$target_path" ]]; then
    if ! confirm_replace "$target_name"; then
      echo "Skipped ${target_name}."
      return 0
    fi
    echo "Replacing ${target_name}."
  fi

  cp "$source_path" "$target_path"
  echo "Installed ${target_name}."
}

echo "Downloading shared agent config from ${REPO_OWNER_REPO}@${REPO_REF}..."
curl -fsSL "https://codeload.github.com/${REPO_OWNER_REPO}/tar.gz/${REPO_REF}" -o "$ARCHIVE_PATH"

TOP_DIR="$(tar -tzf "$ARCHIVE_PATH" | sed -n '1p' | cut -d/ -f1)"
tar -xzf "$ARCHIVE_PATH" -C "$TMP_DIR"

SRC_DIR="${TMP_DIR}/${TOP_DIR}"
if [[ ! -d "${SRC_DIR}/.agents" ]]; then
  echo "Missing .agents in downloaded source: ${SRC_DIR}" >&2
  exit 1
fi

echo "Installing shared files into ${TARGET_DIR}..."
copy_dir_with_prompt "${SRC_DIR}/.agents" "${TARGET_DIR}/.agents" ".agents"
copy_file_with_prompt "${SRC_DIR}/AGENTS.md" "${TARGET_DIR}/AGENTS.md" "AGENTS.md"
copy_file_with_prompt "${SRC_DIR}/skills-lock.json" "${TARGET_DIR}/skills-lock.json" "skills-lock.json"

if [[ -f "${TARGET_DIR}/skills-lock.json" ]]; then
  echo "Installing/updating locked skills in ${TARGET_DIR}..."
  (
    cd "$TARGET_DIR"
    npx -y skills experimental_install -y
  )
else
  echo "No skills-lock.json found in ${TARGET_DIR}; skipping skill installation."
fi

echo "Done."
