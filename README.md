# Agentic Coding

This repo keeps a shared `.agents` setup and `AGENTS.md` for coding assistants.

## Get Started

Run this from inside the repo you want to configure:

```bash
curl -fsSL https://raw.githubusercontent.com/HGZahn/agentic-coding/master/get-started.sh | bash
```

What it does:
- downloads this repository
- copies `.agents/`, `AGENTS.md`, and `skills-lock.json`
- asks before replacing anything that already exists
- installs locked third-party and repo-hosted skills
- syncs skills for Codex and opencode

If you already have a `.agents/` directory or an `AGENTS.md` file, the script will ask before overwriting them.

## Update This Repo

```bash
just update
```

What it does:
- installs/updates the skills listed in `skills-lock.json`
- rebuilds `skills-lock.json` hashes from the current `.agents/skills` tree

## Files To Know

- `.agents/commands/` contains repo-hosted slash commands
- `skills/` contains manually hosted repo-owned skills
- `.agents/skills/` is ignored installer output
- `skills-lock.json` records all skill sources and content hashes
- `get-started.sh` installs this repo into another project

## Requirements

- `git`
- `curl`
- `node` and `npx`
- `unzip`
- internet access for skill downloads

## Troubleshooting

- `just: command not found` - install `just`
- `npx: command not found` - install Node.js
