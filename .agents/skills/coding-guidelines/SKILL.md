---
name: coding-guidelines
description: AI-first coding guidelines for projects maintained by LLMs. Use
  when creating new code, refactoring, or reviewing code to optimize for model
  reasoning, regenerability, and debugging; applies to layout, architecture,
  functions, naming, logging, platform use, and tests.
---

# Coding Guidelines

## Overview

Apply these rules to produce predictable, debuggable code that can be safely
rewritten by future LLMs. These coding principles are mandatory!
Assume all code will be written and maintained by LLMs, not humans. Optimize for model reasoning, regeneration, and debugging — not human aesthetics.

## Principles

### 1. Structure
- Use a consistent, predictable project layout.
- Group code by feature or screen; keep shared utilities minimal.
- Create simple, obvious entry points.
- Identify shared structure before scaffolding multiple files.
- Use framework-native composition patterns for shared elements.
- Treat duplication that needs the same fix in multiple places as a code smell.

### 2. Architecture
- Prefer flat, explicit code over abstractions or deep hierarchies.
- Avoid clever patterns, metaprogramming, and unnecessary indirection.
- Minimize coupling so files can be safely regenerated.

### 3. Functions and Modules
- Keep control flow linear and simple.
- Use small-to-medium functions; avoid deeply nested logic.
- Pass state explicitly; avoid globals.

### 4. Naming and Comments
- Use descriptive-but-simple names.
- Comment only to note invariants, assumptions, or external requirements.

### 5. Logging and Errors
- Emit detailed, structured logs at key boundaries.
- Make errors explicit and informative.

### 6. Regenerability
- Write code so any file or module can be rewritten from scratch without
  breaking the system.
- Prefer clear, declarative configuration (JSON/YAML/etc.).

### 7. Platform Use
- Use platform conventions directly and simply without over-abstracting.

### 8. Modifications
- When extending or refactoring, follow existing patterns.
- Prefer full-file rewrites over micro-edits unless instructed otherwise.

### 9. Quality
- Favor deterministic, testable behavior.
- Keep tests simple and focused on verifying observable behavior.

## Your goal:
Produce code that is predictable, debuggable, and easy for future LLMs to rewrite or extend.
