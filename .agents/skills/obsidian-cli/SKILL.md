---
name: obsidian-cli
description: Use the `obsidian` command to discover and run Obsidian CLI workflows, including opening or targeting vaults and files, creating or opening notes, searching content, dispatching Obsidian commands, and troubleshooting CLI registration or version drift. Use when a user explicitly mentions `obsidian`, `obsidian-cli`, vault automation, or terminal-based Obsidian tasks. Do not use for GUI automation, plugin authoring, or broad note-organization advice unrelated to the CLI.
---

# Obsidian CLI

Use this skill to operate Obsidian from the terminal in a version-aware way. Inspect the installed CLI first, then use the official docs as the fallback for syntax or behavior that local help does not explain.

## Workflow

1. Inspect the installed interface before suggesting syntax:
   - `command -v obsidian`
   - `obsidian help`
   - `obsidian help <command>`
   - `obsidian version` if supported
2. Classify the task:
   - Command discovery or syntax lookup
   - Vault or file targeting
   - Note creation, opening, or editing
   - Search, tags, or task queries
   - Command dispatch or app actions
   - Troubleshooting or compatibility checks
3. Load only the reference that matches the task:
   - Command shapes and examples: `references/cli-reference.md`
   - Safety guidance and failure modes: `references/practices-and-traps.md`
4. Prefer explicit vault, file, or path parameters over ambient app state whenever the command supports them.
5. Call out destructive, stateful, or context-sensitive behavior before recommending a command.
6. If local help and official docs differ, prefer the installed CLI for exact syntax and treat the docs as compatibility guidance.

## Safe Operating Rules

- Prefer `obsidian help` over memory.
- Prefer explicit `vault=...`, `file=...`, or `path=...` style targeting when the command supports it.
- Treat commands that operate on the active note, current base, or focused pane as stateful.
- Preserve frontmatter, wikilinks, embeds, and note filenames when editing note content outside the app.
- Treat rename, move, and delete operations as link-integrity risks, not just file operations.
- State clearly when a request is better served by plain Markdown file editing or `obsidian-headless` rather than the desktop CLI.

## Troubleshooting Rules

- Check whether `obsidian` exists in `PATH` before assuming the CLI is installed.
- Check whether the installed app exposes CLI help before relying on the docs.
- Check version drift when the docs mention commands that the local install does not expose.
- Treat missing `man obsidian` output as normal; use `obsidian help` and official docs instead.
- On Linux, check symlink or wrapper behavior before assuming `obsidian` is the direct CLI binary.
- If `obsidian` launches the app but does not behave like the documented CLI, check whether CLI support is enabled in the app and whether the install method changed the registration path.

## Resources

- Task-oriented command reference: `references/cli-reference.md`
- Safety guidance and common pitfalls: `references/practices-and-traps.md`
- Official docs: `https://help.obsidian.md/cli`
