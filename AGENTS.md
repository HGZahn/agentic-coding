# AGENTS.md

This file provides guidance to coding agents when working in this repository.

## Project Overview

**Agentic Coding** is a configuration framework for LLM coding assistants. This is not an application with source code; it is a configuration repository that serves as a single source of truth for managing LLM agent settings across multiple platforms.

## Architecture

### Single Source of Truth Pattern

All configurations are defined in `.agents/` (canonical directory) and exposed to other tools via symlinks:

```
.agents/          # Canonical configuration source (edit here)
├── settings.json # Core settings with enabled plugins
├── agents/       # Agent definitions
├── commands/     # Custom slash commands
├── hooks/        # Hook scripts
├── rules/        # Rules for LLM behavior
├── skills/       # Reusable skills
└── workflows -> commands  # Compatibility alias

.claude/          # Compatibility symlink
└── -> .agents

.codex/           # OpenAI Codex (symlinked)
├── prompts -> ../.agents/commands
├── rules -> ../.agents/rules
└── skills -> ../.agents/skills
```

**Key principle**: `.agents/` is the gold standard. Other tools reference it directly or through compatibility symlinks.

## Configuration Structure

### Directory Purposes

- **`agents/`**: Define custom agent behaviors and specialized workflows
- **`commands/`**: Custom slash commands that expand to prompts (mapped as workflows/prompts in other tools)
- **`rules/`**: Behavior guidelines and constraints for LLM agents
- **`skills/`**: Reusable capabilities that can be invoked across different contexts
- **`hooks/`**: Lifecycle and automation scripts

## Available Commands

Commands are invoked with `/command-name` in compatible tools:

| Command | Description |
|---------|-------------|
| `/ai-refactor` | Review codebase against LLM/AI coding principles, output findings to FINDINGS.md |
| `/commit-push [msg]` | Git commit and push with safety checks (secrets, broken templates) |
| `/interview-me [plan]` | Interview about a plan file to refine specs (uses Opus) |

## Available Skills

Skills are invoked with the Skill tool when relevant context is detected:

| Skill | Purpose |
|-------|---------|
| `agent-browser` | Automates browser interactions for testing and data extraction |
| `coding-guidelines` | AI-first coding principles for LLM-maintained code |
| `justfile` | Author and debug `justfile` task automation |
| `value-realization` | Analyze product ideas for discoverable user value |
| `systematic-debugging` | Four-phase debugging: root cause first, then fix |
| `skill-creator` | Guide for creating new skills with init_skill.py |
| `ruff` | Python linter/formatter usage patterns |
| `uv` | Python package/project manager workflows |

## Creating New Content

### Command Format

Commands are `.md` files in `.agents/commands/` with YAML frontmatter:

```yaml
---
description: Human-readable description (required)
argument-hint: [optional-args]        # Shown in command list
allowed-tools: Bash(git:*)            # Tool restrictions
model: haiku                          # Model override
---
```

### Skill Format

Skills are directories in `.agents/skills/` containing `SKILL.md`:

```yaml
---
name: skill-name                      # Required
description: When to use and what it provides  # Required
---
```

Skills may include optional subdirectories:
- `scripts/` - Executable code for deterministic tasks
- `references/` - Documentation loaded as needed
- `assets/` - Files used in output (templates, images)

To create a new skill, use the `skill-creator` skill or run:
```bash
.agents/skills/skill-creator/scripts/init_skill.py <name> --path .agents/skills/
```

## Settings

**`.agents/settings.json`** controls plugin enablement.

Currently enabled plugins:
- `ralph-loop@claude-plugins-official`: Ralph Loop functionality
