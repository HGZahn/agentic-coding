# Agentic Coding

`agentic-coding` is a curated `.agents` configuration and skills source for coding assistants.

The workflow is intentionally simple:
- **Command A:** update this repository itself (including Impeccable `i-*` skills and lock file).
- **Command B:** install/update `.agents` in any other project from this repository.

## Requirements

- `git`
- `curl`
- `node` + `npx`
- internet access (for upstream skill sources and GitHub downloads)

## Command A: Update This `agentic-coding` Repo

Run from the root of this repository:

```bash
./scripts/update-agentic-coding.sh
```

What it does:
- refreshes curated upstream skills (`agent-browser`, `justfile`, `value-realization`, `skill-creator`, `ruff`, `uv`, `systematic-debugging`)
- refreshes all skills from `pbakaus/impeccable`
- rewrites Impeccable skill names to local `i-*` naming
- removes replaced local legacy names (`i-frontend-design`, `i-teach-impeccable`)
- rebuilds `skills-lock.json` from current `.agents/skills` + `skills.sources.json`

## Command B: Install/Update `.agents` In Another Repo

Run this **inside the target project directory**:

```bash
./scripts/setup-own-repo.sh
```

What it does:
- downloads `HGZahn/agentic-coding`
- replaces local `.agents/` in the current working directory
- copies `AGENTS.md` and `skills-lock.json`
- runs `npx -y skills experimental_install -y` in the current project

### Remote one-liner (`curl | bash`)

Also run this inside the target project directory:

```bash
curl -fsSL https://raw.githubusercontent.com/HGZahn/agentic-coding/master/get-started.sh| bash
```

## Notes

- Command B is destructive for `.agents/` in the target repo (it replaces it).