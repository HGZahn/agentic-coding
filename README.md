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
- runs `npx -y skills experimental_install -y`

If you already have a `.agents/` directory or an `AGENTS.md` file, the script will ask before overwriting them.

## Update This Repo

```bash
just update
```

What it does:
- refreshes the upstream skills listed in `skills.sources.json`
- downloads the Impeccable `i-*` bundle
- rebuilds `skills-lock.json` from the current `.agents/skills` tree

## Files To Know

- `skills.sources.json` lists where each skill comes from
- `skills-lock.json` records the current contents of each skill directory
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
