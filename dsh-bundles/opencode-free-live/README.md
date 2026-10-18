# opencode-free-live

DSH plugin registering a **custom model provider** (`opencode-free-live`) that exposes the
**42 opencode FREE models** over **direct HTTPS** to `opencode.ai` — no opencode process, no
bridge, no opencode dependency at runtime.

Models then appear as `opencode-free-live/<model-id>` (e.g. `opencode-free-live/deepseek-v4.1-flash-free`).

## Install / activate

Works as a profile bundle. Copy this directory anywhere (e.g. `~/dsh-bundles/opencode-free-live`)
and register it in your profile's `package.json`:

```jsonc
// ~/.dsh/profiles/web/package.json
{
  "dsh": { "profile": { "bundles": [ "dsh-plugin-opencode-free-live" ] } },
  "dependencies": {
    "dsh-plugin-opencode-free-live": "link:/home/<you>/dsh-bundles/opencode-free-live"
  }
}
```

Then install the link and restart DSH:

```bash
cd ~/.dsh/profiles/web && pnpm install
```

`package.json` carries `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`, so the patch —
`- id: opencode-free-live` / `name: dsh-plugin-opencode-free-live` — is picked up automatically;
no absolute path is baked in. Activation requires a **DSH restart** to take effect.

<details>
<summary>Alternative: paste the entry by hand</summary>

Add to your profile's `cordis.patch.yml`:

```yaml
- id: opencode-free-live
  name: dsh-plugin-opencode-free-live
```

</details>

## How it works

The free tier is gated by **two factors** (plus one flag). All three were recovered by
reverse-engineering the shipped opencode binary and confirmed with a local TLS-terminating
MITM; the plugin reproduces them directly.

### 1. Session id (minted per request)

`POST https://opencode.ai/inference/openai/v1/chat/completions` with `Authorization: Bearer public`
and the `x-opencode-*` header set. A **freshly minted** `ses_…` id passes; a garbage id returns
`403 FreeTierError`.

The generator lives in the binary's embedded JS (`chunk-h907w4r7.js`, abs offset `0x7eff898`).
Per-millisecond counter, 48-bit timestamp:

```
m = 0; d = 0
DZ(e, n = Date.now()) {
  if (n !== m) { m = n; d = 0 }         // new millisecond → reset counter
  d++
  r = BigInt(n) * 0x1000n + BigInt(d)   // ms<<12 | counter(12 bits)
  a = e ? ~r : r                        // sessions are inverted
  prefix = 6 bytes of a >> (40 - 8*len) // 26 chars after "ses_"
  tail   = 14 random bytes via I[b % 62]  // alphabet: 0-9 A-Z a-z
}
```

Sessions use the **inverted** form; `per_` / `wrk_` / `evt_` ids use plain `r`.
The ids decode back cleanly, which is how the generator was confirmed:
`low48 = hex12(id)`, `unmasked = low48 ^ 0xffffffffffff`, `d = unmasked & 0xfff`,
`ms = (unmasked - d) >> 12 + era * 2**36` (era 26 ↔ Oct 2026, eras ≈19.07 h apart;
every captured id decoded to `d = 1`). See `ids.js` for `mintSession`, `mintPlainIdentifier`,
`decodeSession`.

### 2. Request-body fingerprint (the part that is easy to miss)

A valid fresh id is **not sufficient**. The request must also carry opencode's own system
prompt **verbatim** as the leading system message. Replacing it with a shorter prompt, or
dropping it, returns `403 FreeTierError` even with a perfect id.

- `verify-mint.mjs` → `*** MINTED ID PASSES THE GATE ***` (id works)
- single-variable mutation probes (`.zen-mitm-work/mint/probe-final.mjs`):

| Variant | Mutation | Result |
|---|---|---|
| A | verbatim captured body | **200** |
| B | system replaced with short prompt | 403 FreeTierError |
| C | system dropped | 403 FreeTierError |
| D | user message unquoted | 200 |
| E | user message lengthened | 200 |
| F | user message changed | 200 |
| G | `stream_options` removed | 200 |
| H | `stream: false` | 403 FreeTierError |

So the gate checks the **system prompt** and **`stream: true`** (and the session id). User
content, its length, its quoting, and `stream_options` are all irrelevant.

The captured prompt is embedded verbatim in `opencode-system-prompt.js` (2119 bytes). Caller
`system` text is appended *after* it inside the same system message, so the fingerprint stays
intact. `developer` role messages are dropped; client tools travel in the request `tools` field.

> **UPDATE HINT** — if opencode changes its system prompt, all requests start returning
> `403 FreeTierError` again. Re-capture it from a live opencode request (see
> `scripts/zen-mitm/README.md` for the capture recipe) and replace the constant in
> `opencode-system-prompt.js`. Nothing else needs to change.

### 3. Streaming contract

The upstream is OpenAI-compatible SSE, with two opencode specifics:

- reasoning text arrives in `choices[0].delta.reasoning` (**not** `reasoning_content`), plus
  `reasoning_details[{type:'reasoning.text',text,…}]`
- the final chunk carries `finish_reason` + `usage`, then `data: [DONE]`

`adapter.js` translates this into DSH `StreamChunk`s (`block-start` → `text-delta` /
`reasoning-delta` → `block-end` → `usage` → `finish`) through a queue-safe SSE parser.
`muse-spark*` models are routed to the Responses API (`routing.js`).

## Model source

`https://models.opencode.ai/api.json` → `data.opencode.models`, filtered to ids containing
`free` → exactly **42 models** (`catalog.js`, 5-minute cache). The CLI's
`GET https://opencode.ai/zen/v1/models` was rejected as a source: it lists 9 free models with
no metadata.

## Files

| File | Purpose |
|------|---------|
| `index.js` | Cordis entry: builds catalog + adapter, `ctx.llm.registerAdapter` |
| `adapter.js` | `LlmAdapter`: direct HTTPS completions/responses, SSE → `StreamChunk` |
| `ids.js` | Session-id minting/decoding + `x-opencode-*` headers |
| `opencode-system-prompt.js` | Verbatim body fingerprint (the gate's 2nd factor) |
| `messages.js` | DSH messages/tools → OpenAI chat input, fingerprint prepended |
| `catalog.js` | 42 free models from `models.opencode.ai/api.json` |
| `routing.js` | chat-completions vs responses-api per model |

## Live status (42 models, verified against the live endpoint)

Only the models opencode actually serves upstream right now can return a completion. All 42
are exposed in the catalog; the rest fail provider-side and cannot be fixed in this plugin.

**200 — 11/42**

| Model | | |
|---|---|---|
| `beam-free` | `cat-jam-free` | `deepseek-v4.1-flash-free` |
| `exo-free` | `glm-5.3-flash-free` | `longcat-2.5-preview-free` |
| `mimo-v2.6-flash-free` | `nemotron-3-ultra-free` | `nemotron-3.5-lightning-free` |
| `nemotron-3.5-super-vl-free` | `space-bunny-free` | |

**Non-200 (31/42) — upstream/account conditions, not gate failures**

| Response | Models |
|---|---|
| `400 {"error":{"type":"server_error","message":"Upstream request failed: Model is unavailable."}}` (~26) | the bulk of the catalog |
| `403 RegionError` | `fledge-alpha-free` |
| `410 ModelDeprecated` | `ll-alpha-free`, `mimo-v2.5-free`, `muse-spark-1.3-contributor-free` |
| `400 ModelProtocolUnsupported` | `muse-spark-1.2-contributor-free` |

Sweep: `.zen-mitm-work/mint/sweep-catalog.mjs` → prints a sorted status table and the total.

## Curl example

Mint a session id, then post the exact body:

```bash
export OPENCODE_SESSION_ID=$(node --input-type=module -e '
import { mintSession } from "/home/hadmin/projects/agentic-coding/dsh-bundles/opencode-free-live/ids.js";
process.stdout.write(mintSession());
')
echo "$OPENCODE_SESSION_ID"   # ses_....

node --input-type=module -e '
import { OPENCODE_SYSTEM_PROMPT } from "/home/hadmin/projects/agentic-coding/dsh-bundles/opencode-free-live/opencode-system-prompt.js";
import { upstreamHeaders } from "/home/hadmin/projects/agentic-coding/dsh-bundles/opencode-free-live/ids.js";
const body = {
  model: "deepseek-v4.1-flash-free",
  messages: [
    { role: "system", content: OPENCODE_SYSTEM_PROMPT },
    { role: "user", content: "Reply with only: PONG" }
  ],
  stream: true,
  stream_options: { include_usage: true }
};
const res = await fetch("https://opencode.ai/inference/openai/v1/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json", ...upstreamHeaders(process.env.OPENCODE_SESSION_ID || "") },
  body: JSON.stringify(body)
});
console.log(res.status, res.headers.get("content-type"));
for await (const c of res.body) process.stdout.write(c);
'
```

`GET https://opencode.ai/zen/v1/models` works anonymously and is handy for a quick reachability
check, but chat completions are the endpoints that matter.

## Provenance / where each fact came from

| Fact | How it was found |
|---|---|
| Session-id gate | MITM capture of a live opencode request; replaying a captured id worked, a random `ses_` id returned 403 |
| Id generator | Embedded JS extracted from the Bun single-file binary (`chunk-h907w4r7.js` @ `0x7eff898`), then confirmed by decoding captured ids |
| Header set | Same capture; `x-opencode-session`/`x-opencode-session-id` are both sent |
| Body fingerprint | Single-variable mutation probes against the live endpoint (table above) |
| System prompt | Verbatim from the captured request body (`req-019.body`) |
| SSE shape | Raw stream capture (`sse-sample.txt`) |
| Model list | `models.opencode.ai/api.json` |
| DSH adapter contract | `@deepseek-ai/dsh-llm` type declarations |

Capture/MITM tooling: `scripts/zen-mitm/` (self-contained curl proof + recipes).
Working probes: `.zen-mitm-work/mint/`.
