# zen-mitm — curl proof: MITM + TLS pinning (and where to find the Zen-free stuff)

`prove.sh` mints a local CA + `opencode.ai` leaf, starts `mitm.py` (a stdlib TLS
terminator that logs plaintext and forwards to the real server), then runs three
curls: control, **pinned MITM (200 = interception worked)**, **foreign pin
(curl exit 90 = pinning enforced)**. Run `./prove.sh`; artifacts land in
`.zen-mitm-work/` (git-ignored).

## How it works

1. Client trusts our CA only for this run (`--cacert ca.crt`) → our fake
   `opencode.ai` leaf is accepted.
2. `--pinnedpubkey pin.pem` compares SHA-256 over the peer's **SubjectPublicKeyInfo**
   with the expected key; mismatch aborts before any byte leaves the client.
3. The proxy terminates TLS, logs headers/body in plaintext, re-encrypts to
   `opencode.ai:443` with the system trust store → end-to-end still valid, but
   the middle hop is fully readable.

## Fast-find hints (next time, don't re-derive)

| What | Where |
|---|---|
| Live free model pool | `curl -s https://opencode.ai/zen/v1/models -H 'Authorization: Bearer public'` (rotating, ~9 `*-free` ids) |
| Limits / endpoint per model | `curl -s https://models.opencode.ai/api.json \| jq '.opencode.models["mimo-v2.6-flash-free"]'` (free ones: `provider.api = https://opencode.ai/inference/openai/v1/chat/completions`) |
| Official docs | <https://opencode.ai/docs/providers> → “OpenCode Zen” |
| Old captured CLI handshake | `git show ac7731a:home/.pi/agent/extensions/dreamloop-zen.ts` (deleted by `3efbda4 cleanup`) — documents headers: `Bearer public`, `x-opencode-client: cli`, `x-opencode-project: global`, fresh `ses_`/`msg_` ids, and the free-tier gate that demands genuine OpenCode system-head text |
| Free-tier gate verdicts | 200 = ok · `FreeTierError` = shape/markers wrong · “OpenCode's free tier can only be used from within OpenCode.” = anonymous blocked |
| Capture the **real** opencode CLI | `mitmdump -p 8899 &` then `HTTPS_PROXY=http://127.0.0.1:8899 NODE_EXTRA_CA_CERTS=$HOME/.mitmproxy/mitmproxy-ca-cert.pem opencode run "..."` (or `curl --proxy http://127.0.0.1:8899`) — this is how the original capture was made |
| OpenCode config/logs on this host | `~/.config/opencode/opencode.jsonc`, `~/.config/opencode/opencode.jsonc.bak-*`, `~/.local/share/opencode/log/opencode.log` (`grep -i zen`) |
| opencode crash evidence | `ls -la /var/lib/systemd/coredump/ \| grep opencode` |
| Pin the **real** server | `prove.sh` writes `.zen-mitm-work/real-pin.pem` — use that with `--pinnedpubkey` when you want to *detect* MITM instead of performing one |

DSH-side copy of this bundle: `~/dsh-bundles/zen-mitm-proof/`.