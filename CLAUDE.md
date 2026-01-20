# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Agentic Coding** is a configuration framework for LLM coding assistants. This is not an application with source code - it's a configuration repository that serves as a single source of truth for managing LLM agent tool settings across multiple platforms.

## Architecture

### Single Source of Truth Pattern

All configurations are defined in `.claude/` (Claude Code's canonical directory) and symlinked to other tool directories:

```
.claude/          # Canonical configuration source (edit here)
├── settings.json # Core settings with enabled plugins
├── agents/       # Agent definitions
├── commands/     # Custom slash commands
├── rules/        # Rules for LLM behavior
└── skills/       # Reusable skills

.agent/           # Generic agent tool (symlinked)
├── rules -> ../.claude/rules
├── skills -> ../.claude/skills
└── workflows -> ../.claude/commands

.codex/           # OpenAI Codex (symlinked)
├── prompts -> ../.claude/commands
├── rules -> ../.claude/rules
└── skills -> ../.claude/skills

.opencode/        # Extensible for other tools
```

**Key principle**: Claude Code is the gold standard. Other tools reference `.claude/` to ensure consistent behavior across different agentic coding environments.

## Configuration Structure

### Directory Purposes

- **`agents/`**: Define custom agent behaviors and specialized workflows
- **`commands/`**: Custom slash commands that expand to prompts (mapped as workflows/prompts in other tools)
- **`rules/`**: Behavior guidelines and constraints for LLM agents
- **`skills/`**: Reusable capabilities that can be invoked across different contexts

### Settings Management

**`.claude/settings.json`**: Controls plugin enablement and core settings.

Currently enabled plugins:
- `ralph-loop@claude-plugins-official`: Ralph Loop functionality

## Working in This Repository

### Adding New Configurations

1. Add files to the appropriate `.claude/` subdirectory:
   - New slash command → `.claude/commands/`
   - New agent definition → `.claude/agents/`
   - New behavior rule → `.claude/rules/`
   - New skill → `.claude/skills/`

2. The symlink structure automatically makes these available to other tools (Codex, Agent frameworks, etc.)

### Modifying Settings

Edit `.claude/settings.json` to enable/disable plugins or adjust core configuration.

### Multi-Tool Philosophy

Changes made in `.claude/` propagate to all supported tools through symlinks, maintaining consistency. Each tool may interpret configurations slightly differently (e.g., "commands" vs "prompts" vs "workflows"), but the content remains synchronized.

## Repository Status

This repository is in early stages with scaffold directories in place. The configuration directories are currently empty and ready to be populated with custom agents, commands, rules, and skills as needed.
