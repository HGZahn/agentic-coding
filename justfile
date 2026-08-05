verify:
    node scripts/skills.mjs verify
    test "$(readlink .opencode/skills)" = "../.pi/skills"
    test -f .pi/extensions/plan-build-mode.ts
    test -f .pi/settings.json

test: verify
    #!/usr/bin/env bash
    set -euo pipefail
    root="{{ justfile_directory() }}"
    tmpdir="$(mktemp -d)"
    trap 'rm -rf "$tmpdir"' EXIT

    target="$tmpdir/fresh"
    mkdir -p "$target"
    cd "$target"
    AGENTIC_CODING_SOURCE_DIR="$root" bash "$root/get-started.sh" --yes --no-keybindings
    test -d .pi/skills
    test -f .pi/extensions/plan-build-mode.ts
    test -f .pi/settings.json
    test -f AGENTS.md
    test "$(readlink .opencode/skills)" = "../.pi/skills"

    AGENTIC_CODING_SOURCE_DIR="$root" bash "$root/get-started.sh" --yes --no-keybindings
    test ! -e .pi/skills.bak.*

    conflict="$tmpdir/conflict"
    mkdir -p "$conflict/.opencode/skills"
    if (cd "$conflict" && AGENTIC_CODING_SOURCE_DIR="$root" bash "$root/get-started.sh" --yes --no-keybindings); then
        echo "Expected OpenCode conflict to fail" >&2
        exit 1
    fi
    test ! -e "$conflict/.pi"

    keybindings="$tmpdir/pi-agent"
    cd "$target"
    PI_CODING_AGENT_DIR="$keybindings" AGENTIC_CODING_SOURCE_DIR="$root" bash "$root/get-started.sh" --yes --keybindings
    node -e 'const k=require(process.argv[1]); if(k["app.thinking.cycle"]!=="ctrl+t" || !Array.isArray(k["app.thinking.toggle"]) || k["app.thinking.toggle"].length) process.exit(1)' "$keybindings/keybindings.json"
    PI_CODING_AGENT_DIR="$keybindings" AGENTIC_CODING_SOURCE_DIR="$root" bash "$root/get-started.sh" --yes --keybindings
    test ! -e "$keybindings"/keybindings.json.bak.*

    dry="$tmpdir/dry"
    mkdir -p "$dry"
    cd "$dry"
    AGENTIC_CODING_SOURCE_DIR="$root" bash "$root/get-started.sh" --dry-run --yes --no-keybindings
    test ! -e .pi

    echo "All tests passed."

update skill="":
    node scripts/skills.mjs update {{ skill }}
    node scripts/skills.mjs verify

update-skill skill:
    node scripts/skills.mjs update {{ skill }}
    node scripts/skills.mjs verify

install target:
    cd {{ target }} && AGENTIC_CODING_SOURCE_DIR="{{ justfile_directory() }}" bash "{{ justfile_directory() }}/get-started.sh"
