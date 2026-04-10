# Agentic Coding

Curated `.agents` configuration and skills source for personal/team bootstrap with `npx skills`.

## Get Started

### Use these skills in your own repo (recommended)

1. Copy the lock file into your repo:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/HGZahn/agentic-coding/master/skills-lock.json -o skills-lock.json
   ```
2. Install all locked skills:
   ```bash
   npx -y skills experimental_install -y
   ```

This installs the curated set (including `i-*` skills) into your repo’s `.agents/skills/`.

### Setup `.agents` scaffold in your own repo

If you also want commands/settings/rules/hooks from this repo:

```bash
git clone --depth 1 https://github.com/HGZahn/agentic-coding.git /tmp/agentic-coding
cp -R /tmp/agentic-coding/.agents ./
cp /tmp/agentic-coding/AGENTS.md ./AGENTS.md
cp /tmp/agentic-coding/skills-lock.json ./skills-lock.json
npx -y skills experimental_install -y
```

### Install directly from this repo source

```bash
npx -y skills add HGZahn/agentic-coding --skill '*' --agent codex -y
```

Use this when you want the latest skills from this repository without using the lock file.

## Maintainer Workflow

### Rebuild curated lock

After changing anything under `.agents/skills/` or `skills.sources.json`:

```bash
./scripts/rebuild-skills-lock.sh
```

### Reinstall from lock locally

```bash
./scripts/bootstrap-skills.sh
```

## Structure

```text
agentic-coding/
├── .agents/
│   ├── settings.json
│   ├── commands/
│   ├── skills/
│   ├── agents/
│   ├── hooks/
│   └── rules/
├── scripts/
│   ├── bootstrap-skills.sh
│   └── rebuild-skills-lock.sh
├── skills.sources.json
├── skills-lock.json
└── AGENTS.md
```
