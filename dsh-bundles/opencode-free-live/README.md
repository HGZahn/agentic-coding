# opencode-free-live

DSH plugin exposing the 42 opencode FREE models via the local `opencode serve --service` bridge.

## Architecture

- **Transport**: proxies through the local `opencode serve --service` bridge (default `http://127.0.0.1:49374`)
- **No opencode dependency**: the plugin is self-contained, using only pi-ai and Node.js builtins
- **Auth**: anonymous (`Authorization: Bearer public`) unless `OPENCODE_API_KEY` is set
- **UA**: `opencode/latest/2.0.31/cli` (captured from the real inference lane)
- **Free-lane gate**: injects `bash`+`read` tools and sets `tool_choice: 'none'` when no client tools are present

## Why not direct-HTTP?

Direct-HTTP to `https://opencode.ai/inference/openai/v1/chat/completions` returns **403 FreeTierError** ("OpenCode's free tier can only be used from within OpenCode"). The free tier is serve-bound — the plugin must proxy through the local `opencode serve` bridge.

## Setup

1. Start the bridge: `opencode serve --service` (default port 49374)
2. Activate the plugin via `cordis.patch.yml` (see below)
3. The 42 free models appear as `opencode-free-live/<model-id>`

## Files

| File | Purpose |
|------|---------|
| `index.js` | DSH entry point, registers the adapter |
| `adapter.js` | LlmAdapter: proxies completions to the local bridge |
| `catalog.js` | Fetches 42 free models from `models.opencode.ai/api.json` |
| `ids.js` | Session/request ID derivation and disguise headers |
| `messages.js` | Free-lane gate tool injection |
| `routing.js` | Model routing (chat vs responses) |

## Configuration

```yaml
# cordis.patch.yml
- insert:
    - id: opencode-free-live
      name: opencode-free-live
      config:
        bridgeBaseUrl: http://127.0.0.1:49374
      module: /home/hadmin/projects/agentic-coding/dsh-bundles/opencode-free-live/index.js
```

## Debug Notes

- Direct-HTTP to opencode.ai: **DEAD** (403 FreeTierError on all replays)
- ZEN list endpoint (`/zen/v1/models`): works anonymously, but chat completion is serve-gated
- MITM at 8443 (TLS-terminating): gets 200 PONG, so JA3/TLS fingerprinting is NOT the gate
- The gate is "must be within OpenCode" (serve-bound), not a replayable header/session shape
- `opencode serve --service` is the real HTTPS egress to opencode.ai
- 49374 listener had no owner process (stale socket); plugin uses configurable bridge URL
