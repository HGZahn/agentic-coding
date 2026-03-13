# CLI Reference

Confirm exact syntax with `obsidian help` and `obsidian help <command>` before running a command. The official CLI is still evolving, so treat these examples as safe starting points rather than a frozen contract.

## Discovery And Help

Use these commands first to discover what the local install actually supports.

- `obsidian`
  Purpose: open the interactive terminal interface when supported.
  Safe example: `obsidian`
  Caveat: some installs still behave more like a launcher wrapper than a full TUI entrypoint.
- `obsidian help`
  Purpose: list available commands and top-level help.
  Safe example: `obsidian help`
  Caveat: use this instead of `man obsidian`; a manpage is often missing.
- `obsidian help <command>`
  Purpose: inspect parameters and flags for one command.
  Safe example: `obsidian help create`
  Caveat: prefer this over guessing argument names from online examples.
- `obsidian version`
  Purpose: show the installed Obsidian version when the local build exposes the command.
  Safe example: `obsidian version`
  Caveat: if unsupported, fall back to app metadata or package-manager inspection.

## Vault And File Targeting

Prefer explicit vault or file selection over whatever note or pane happens to be active.

- `obsidian create ...`
  Purpose: create a note, often with a name, content, or template.
  Safe example: `obsidian create name="Trip to Paris" template=Travel`
  Caveat: confirm how the local build resolves note names versus full paths.
- `obsidian read ...`
  Purpose: read note contents, often from the active note or a targeted file.
  Safe example: `obsidian read`
  Caveat: if the command defaults to the active note, say that explicitly before using it.
- `obsidian diff ...`
  Purpose: compare file revisions or note history where supported.
  Safe example: `obsidian diff file=README from=1 to=3`
  Caveat: confirm the revision identifiers and file selector syntax with local help.
- `obsidian bookmark ...`
  Purpose: add bookmarks for files, folders, searches, or URLs.
  Safe example: `obsidian bookmark file=Notes/Plan.md`
  Caveat: some selectors are mutually exclusive; inspect help before combining them.

## Create Open And Edit

Use these commands for everyday note workflows, but warn when they rely on current app state.

- `obsidian daily`
  Purpose: open today's daily note.
  Safe example: `obsidian daily`
  Caveat: some flags control whether the note opens in place, a split, or another window.
- `obsidian daily:read`
  Purpose: read today's daily note.
  Safe example: `obsidian daily:read`
  Caveat: confirm whether missing daily notes are created automatically or treated as an error.
- `obsidian daily:append ...`
  Purpose: append content to today's daily note.
  Safe example: `obsidian daily:append content="- [ ] Buy groceries"`
  Caveat: use `\\n` for multiline input and check whether the local build appends a newline by default.
- `obsidian daily:prepend ...`
  Purpose: prepend content to today's daily note.
  Safe example: `obsidian daily:prepend content="## Inbox"`
  Caveat: check whether the command opens the file unless `silent` or equivalent is passed.

## Search And Navigation

Use these commands for read-heavy workflows before moving into file edits.

- `obsidian search ...`
  Purpose: search vault content.
  Safe example: `obsidian search query="meeting notes"`
  Caveat: confirm whether the search targets the whole vault, the active base, or the active view.
- `obsidian tags ...`
  Purpose: inspect tags, optionally with counts.
  Safe example: `obsidian tags counts`
  Caveat: output formatting may differ across builds; do not hardcode parsers without checking.
- `obsidian tasks ...`
  Purpose: list tasks from a scope such as the daily note.
  Safe example: `obsidian tasks daily`
  Caveat: verify the supported scopes locally before scripting against them.

## Command Dispatch And App Actions

Use these commands when the goal is to invoke existing Obsidian features rather than manipulate note text directly.

- `obsidian commands`
  Purpose: list available command IDs, including plugin-provided commands.
  Safe example: `obsidian commands`
  Caveat: plugin command IDs are install-specific and should not be assumed.
- `obsidian command ...`
  Purpose: execute one Obsidian command by ID.
  Safe example: list IDs first with `obsidian commands`, then run `obsidian command id=<command-id>`
  Caveat: never invent a command ID; discover it first.
- `obsidian hotkeys`
  Purpose: inspect hotkey mappings.
  Safe example: `obsidian hotkeys`
  Caveat: custom hotkeys differ by user setup.
- `obsidian reload`
  Purpose: reload the current app window.
  Safe example: `obsidian reload`
  Caveat: treat as a stateful app action, not a note operation.
- `obsidian restart`
  Purpose: restart the app.
  Safe example: `obsidian restart`
  Caveat: warn before using it in an interactive session.

## Compatibility Notes

- Official docs describe a desktop CLI that can launch the app if it is not already running.
- Official docs also note that the CLI surface is still changing, so local help wins over memory.
- `obsidian-headless` is a different product for server-side or unattended workflows; do not conflate it with the desktop CLI.
- On this machine, `/usr/bin/obsidian` exists but `man obsidian` is absent. Treat that as a local compatibility note, not a universal assumption.
- Linux installs may register `obsidian` via a symlink or launcher wrapper rather than a direct binary. Check the resolved path when behavior looks inconsistent.
