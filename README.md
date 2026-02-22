# Agentic Coding

Config files for LLM coding assistants. `.agents/` and `AGENTS.md` are the source of truth; tool-specific locations symlink to them.

## Structure

```
agentic-coding/
├── .agents/                    # Canonical config (edit here)
│   ├── settings.json           # Plugins, permissions
│   ├── commands/               # Slash commands (/command-name)
│   │   ├── ai-refactor.md
│   │   ├── commit-push.md
│   │   └── interview-me.md
│   ├── skills/                 # Domain knowledge
│   │   ├── agent-browser/
│   │   ├── coding-guidelines/
│   │   ├── justfile/
│   │   ├── value-realization/
│   │   ├── skill-creator/
│   │   ├── systematic-debugging/
│   │   ├── ruff/
│   │   └── uv/
│   ├── agents/                 # Custom agents (empty)
│   ├── rules/                  # Behavior rules (empty)
│   ├── hooks/                  # Hook scripts (empty)
│   └── workflows -> commands   # Compatibility alias
│
├── .claude/                    # Claude compatibility symlink
│   └── -> .agents
├── .codex/                     # OpenAI Codex
│   ├── prompts -> ../.agents/commands
│   ├── rules -> ../.agents/rules
│   └── skills -> ../.agents/skills
│
├── AGENTS.md                   # Canonical project instructions
└── CLAUDE.md -> AGENTS.md      # Claude compatibility alias
```

## Quick Reference

| Commands | Skills |
|----------|--------|
| `/ai-refactor` - code review | `coding-guidelines` |
| `/commit-push` - git workflow | `systematic-debugging` |
| `/interview-me` - spec refinement | `skill-creator`, `ruff`, `uv` |

## Extending

Add to `.agents/`:
- `commands/*.md` - new slash commands
- `skills/<name>/SKILL.md` - new skills
- `agents/*.md` - agent definitions
- `rules/*.md` - behavior constraints
- `hooks/*.sh` - lifecycle scripts

See AGENTS.md for format details.
