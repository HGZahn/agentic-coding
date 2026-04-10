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

echo "Downloading ${REPO_OWNER_REPO}@${REPO_REF}..."
curl -fsSL "https://codeload.github.com/${REPO_OWNER_REPO}/tar.gz/${REPO_REF}" -o "$ARCHIVE_PATH"

TOP_DIR="$(tar -tzf "$ARCHIVE_PATH" | sed -n '1p' | cut -d/ -f1)"
tar -xzf "$ARCHIVE_PATH" -C "$TMP_DIR"

SRC_DIR="${TMP_DIR}/${TOP_DIR}"
if [[ ! -d "${SRC_DIR}/.agents" ]]; then
  echo "Missing .agents in downloaded source: ${SRC_DIR}" >&2
  exit 1
fi

echo "Installing .agents into ${TARGET_DIR}..."
rm -rf "${TARGET_DIR}/.agents"
cp -R "${SRC_DIR}/.agents" "${TARGET_DIR}/.agents"
cp "${SRC_DIR}/AGENTS.md" "${TARGET_DIR}/AGENTS.md"
cp "${SRC_DIR}/skills-lock.json" "${TARGET_DIR}/skills-lock.json"

echo "Installing/updating locked skills in ${TARGET_DIR}..."
(
  cd "$TARGET_DIR"
  npx -y skills experimental_install -y
)

echo "Done."
