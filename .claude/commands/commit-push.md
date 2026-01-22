---
description: Commit and push changes with a solid commit message
argument-hint: [commit-message-optional]
allowed-tools: Bash(git:*)
model: haiku
---

Create a git commit and push to remote.

**Steps:**

1. Run `git status` to see what files are changed/untracked
2. Run `git diff --staged` and `git diff` to see the changes
3. Run `git log -5 --oneline` to understand commit message style
4. If there are files that likely contain secrets (.env, *.key, credentials.json, etc.), warn and do not proceed
5. Check for broken translation tags and template variables in HTML templates:
   ```bash
   rg -U '\{% translate "[^"]*\n' djangoapp/ --glob "*.html"
   rg 'endblocktrans$' djangoapp/ --glob "*.html"
   rg -U '\{\{[^}]*\n\s*\}\}' djangoapp/ --glob "*.html"
   ```
   If any results, warn that broken tags/variables are found and do not proceed

**Commit message:**

- If user provided an argument ($1), use it as the commit message
- Otherwise, draft a concise commit message (1-2 lines) that:
  - Starts with a verb (add, update, fix, refactor, etc.)
  - Describes the "why" not the "what"
  - Follows the style of recent commits in the repo

**Execute:**

Run these commands sequentially:
```bash
git add .
git commit -m "your message"
git push
```

**Notes:**

- Never use `--no-verify` or skip hooks
- Never force push unless explicitly requested
- If commit or push fails (e.g., pre-commit hook fails), report the error and do NOT retry - let the user fix the issue
- Keep the commit message clear and professional
- After successful push, confirm with a brief message
