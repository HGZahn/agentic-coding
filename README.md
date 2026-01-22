# Agentic Coding

Config framework for LLM coding assistants. Claude Code is the source of truth; other tools symlink to it.

## Structure

```
agentic-coding/
├── .claude/                    # Canonical config (edit here)
│   ├── settings.json           # Plugins, permissions
│   ├── commands/               # Slash commands (/command-name)
│   │   ├── ai-refactor.md
│   │   ├── commit-push.md
│   │   └── interview-me.md
│   ├── skills/                 # Domain knowledge
│   │   ├── coding-guidelines/
│   │   ├── systematic-debugging/
│   │   ├── skill-creator/
│   │   ├── ruff/
│   │   └── uv/
│   ├── agents/                 # Custom agents (empty)
│   ├── rules/                  # Behavior rules (empty)
│   └── hooks/                  # Hook scripts (empty)
│
├── .agent/                     # Generic agent tool
│   └── [symlinks to .claude/]
├── .codex/                     # OpenAI Codex
│   └── [symlinks to .claude/]
│
├── CLAUDE.md                   # Project instructions
└── AGENTS.md -> CLAUDE.md      # Alias for other tools
```

## Quick Reference

| Commands | Skills |
|----------|--------|
| `/ai-refactor` - code review | `coding-guidelines` |
| `/commit-push` - git workflow | `systematic-debugging` |
| `/interview-me` - spec refinement | `skill-creator`, `ruff`, `uv` |

## Extending

Add to `.claude/`:
- `commands/*.md` - new slash commands
- `skills/<name>/SKILL.md` - new skills
- `agents/*.md` - agent definitions
- `rules/*.md` - behavior constraints
- `hooks/*.sh` - lifecycle scripts

See CLAUDE.md for format details.
