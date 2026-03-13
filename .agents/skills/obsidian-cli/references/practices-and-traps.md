# Practices And Traps

Use these rules when the task involves more than simple command lookup.

## Prefer Explicit Targeting

- Prefer explicit vault, file, or path selection over the active note.
- Do not assume the current working directory implies the intended vault.
- Check whether a command expects a note name, a vault-relative path, or an absolute path before suggesting it.

## Treat App State As Unreliable

- Assume the active note, active base, and focused pane can differ from what the user expects.
- Call out stateful behavior before using commands that default to the current file or view.
- Prefer read-only inspection commands before stateful write commands.

## Preserve Obsidian-Specific Markdown

- Preserve frontmatter exactly unless the user asked to change it.
- Preserve wikilinks, embeds, block references, callouts, tags, and aliases when editing note content.
- Avoid renaming notes casually; note filenames often participate in links, embeds, and automation.

## Treat File Operations As Link Operations

- Moves, renames, and deletes can break backlinks, embeds, templates, and automation that refer to note paths.
- If a workflow needs structural changes, warn about link integrity first and prefer app-aware operations over raw filesystem changes when possible.

## Prefer Idempotent Writes

- Prefer create-if-missing or append-style workflows when the user is automating repeated note updates.
- Warn before overwrite-style commands or edits that replace entire files.
- For multiline content, check escape and newline rules before generating commands.

## Check Environment Drift Early

- Check local help first when online examples do not match the install.
- Treat missing commands as a registration, version, or feature-toggle problem before assuming user error.
- On Linux, inspect symlinks, wrappers, and `PATH` entries when the command exists but acts like a launcher.

## Know When Not To Use The Desktop CLI

- Do not present the desktop CLI as a pure headless automation interface.
- For unattended server workflows, say explicitly that `obsidian-headless` or direct Markdown operations may be a better fit.
- If the user wants GUI behavior, switch to a browser or desktop automation approach instead of stretching this skill beyond its scope.
