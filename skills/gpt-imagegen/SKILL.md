---
name: gpt-imagegen
description: Generate PNG images using a ChatGPT subscription via the Codex backend. Requires OpenCode OAuth auth. Supports optional reference images and auto-versioned output. Use for raster art, characters, textures, sprites, mockups, or illustrations.
license: MIT
---

# GPT Image Generator (Codex Backend)

Generates images using your existing ChatGPT subscription through the Codex backend API. No separate OpenAI API key needed — uses OpenCode OAuth credentials.

## Setup

Ensure OpenCode is authenticated:
```bash
# Auth is stored at ~/.local/share/opencode/auth.json
# Or set OPENCODE_AUTH_CONTENT env var
```

## Usage

```bash
# Basic generation
node scripts/gpt-imagegen.mjs "a 2D fantasy map, inked line art" --out ./assets/map.png

# With size and quality
node scripts/gpt-imagegen.mjs "cyberpunk city, neon" --out ./assets/city.png --size 1536x1024 --quality high

# With reference image(s)
node scripts/gpt-imagegen.mjs "make it a night scene" --out ./assets/night.png --image ./assets/day.png
node scripts/gpt-imagegen.mjs "blend these" --out ./assets/merge.png --image ./assets/a.png --image ./assets/b.png
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `--out PATH` | Output PNG path (auto-appends `.png` if missing) | `generated.png` |
| `--size WxH` | Image dimensions | API default |
| `--quality` | `low`, `medium`, `high`, or `auto` | `auto` |
| `--image PATH` | Reference image; repeatable | none |

## Notes

- Output is always PNG
- Auto-increments filename (`-v2`, `-v3`, etc.) if file exists
- Requires ChatGPT subscription with Codex access
- Quota errors are surfaced with reset timing
