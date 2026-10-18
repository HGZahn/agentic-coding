#!/usr/bin/env bash
# End-to-end curl proof: MITM interception + TLS pinning accept + pin mismatch reject.
#
#   ./prove.sh                 # self-signed local CA, proxy on 127.0.0.1:8443
#   WORK=/some/dir ./prove.sh  # keep artifacts elsewhere (default: repo/.zen-mitm-work)
#
# What you should see:
#   TEST 1  plain curl to the real opencode.ai           -> 200 (control)
#   TEST 2  curl through the MITM with OUR pin           -> 200 (interception worked)
#   TEST 3  curl with a foreign pin                      -> curl exit 90 (pinning works)
#   then the plaintext log from mitm.py
#
# Finding this stuff NEXT TIME (also in README.md):
#   - pool   : curl -s https://opencode.ai/zen/v1/models -H 'Authorization: Bearer public'
#   - limits : curl -s https://models.opencode.ai/api.json | jq '.opencode.models["mimo-v2.6-flash-free"]'
#   - history: git show ac7731a:home/.pi/agent/extensions/dreamloop-zen.ts
#   - live capture of the real opencode CLI:
#         mitmdump -p 8899 &
#         export HTTPS_PROXY=http://127.0.0.1:8899
#         export NODE_EXTRA_CA_CERTS=$HOME/.mitmproxy/mitmproxy-ca-cert.pem
#         opencode run "..."
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK="${WORK:-$ROOT/../../.zen-mitm-work}"
UPSTREAM_HOST="${UPSTREAM_HOST:-opencode.ai}"
LISTEN_PORT="${LISTEN_PORT:-8443}"
mkdir -p "$WORK"

echo "== minting local CA + leaf for $UPSTREAM_HOST =="
if [[ ! -s "$WORK/ca.crt" || "${REGEN:-0}" == 1 ]]; then
  openssl genrsa -out "$WORK/ca.key" 2048 2>/dev/null
  openssl req -x509 -new -nodes -key "$WORK/ca.key" -sha256 -days 3650 \
    -subj "/CN=Zen Proof Local CA" -out "$WORK/ca.crt"
  openssl genrsa -out "$WORK/site.key" 2048 2>/dev/null
  openssl req -new -key "$WORK/site.key" -subj "/CN=$UPSTREAM_HOST" -out "$WORK/site.csr"
  printf 'subjectAltName=DNS:%s,DNS:*.%s,IP:127.0.0.1\nextendedKeyUsage=serverAuth\n' \
    "$UPSTREAM_HOST" "$UPSTREAM_HOST" > "$WORK/site.ext"
  openssl x509 -req -in "$WORK/site.csr" -CA "$WORK/ca.crt" -CAkey "$WORK/ca.key" \
    -CAcreateserial -out "$WORK/site.crt" -days 825 -sha256 -extfile "$WORK/site.ext" 2>/dev/null
  cat "$WORK/site.crt" "$WORK/site.key" > "$WORK/site.pem"
fi
openssl x509 -in "$WORK/site.crt" -pubkey -noout > "$WORK/pin.pem"   # our pin
# a pin that must NOT match
openssl req -x509 -newkey rsa:2048 -nodes -keyout "$WORK/evil.key" \
  -subj "/CN=evil-pin" -days 1 -out "$WORK/evil.crt" 2>/dev/null
openssl x509 -in "$WORK/evil.crt" -pubkey -noout > "$WORK/evil-pin.pem"
# the pin of the REAL server, for honest (non-MITM) pinning:
printf '%s' "$(openssl s_client -connect "$UPSTREAM_HOST:443" -servername "$UPSTREAM_HOST" \
  </dev/null 2>/dev/null | openssl x509 -pubkey -noout)" > "$WORK/real-pin.pem"
echo "real-server pin sha256: $(openssl pkey -pubin -in "$WORK/real-pin.pem" -outform der 2>/dev/null \
  | openssl dgst -sha256 -r | cut -d' ' -f1)"
echo "MITM     pin sha256: $(openssl pkey -pubin -in "$WORK/pin.pem" -outform der 2>/dev/null \
  | openssl dgst -sha256 -r | cut -d' ' -f1)"

: > "$WORK/mitm.log"
python3 "$ROOT/mitm.py" --workdir "$WORK" \
  --listen "127.0.0.1:$LISTEN_PORT" --upstream "$UPSTREAM_HOST:443" &
PROXY=$!
trap 'kill "$PROXY" 2>/dev/null || true' EXIT
sleep 1.5

echo
echo "########## TEST 1: control, direct to the real server ##########"
curl -sS -m 20 "https://$UPSTREAM_HOST/zen/v1/models" -H "Authorization: Bearer public" \
  | jq -r '.data[0:3][] | .id'

echo
echo "########## TEST 2: through MITM + TLS pin (expected: 200) ##########"
curl -sS -m 20 --resolve "$UPSTREAM_HOST:$LISTEN_PORT:127.0.0.1" \
  --cacert "$WORK/ca.crt" --pinnedpubkey "$WORK/pin.pem" \
  "https://$UPSTREAM_HOST:$LISTEN_PORT/zen/v1/models" \
  -H "Authorization: Bearer public" -H "x-opencode-client: cli" \
  -H "User-Agent: opencode/1.18.31 ai-sdk/provider-utils/4.0.40 runtime/bun/1.3.14" \
  -o "$WORK/t2.json" -w "http=%{http_code} tls_verify=%{ssl_verify_result}\n"
jq -r '.data[0:6][] | .id' "$WORK/t2.json"

echo
echo "########## TEST 3: foreign pin (expected: curl exit 90) ##########"
if curl -sS -m 20 --resolve "$UPSTREAM_HOST:$LISTEN_PORT:127.0.0.1" \
  --cacert "$WORK/ca.crt" --pinnedpubkey "$WORK/evil-pin.pem" \
  "https://$UPSTREAM_HOST:$LISTEN_PORT/zen/v1/models" -o /dev/null \
  -w "http=%{http_code}\n"; then
  echo "UNEXPECTED: wrong pin was accepted - pinning is NOT enforced"
else
  echo "OK: rejected with curl exit $?"
fi

echo
echo "########## MITM plaintext log ##########"
cat "$WORK/mitm.log"
echo
echo "artifacts kept in: $WORK (git-ignored)"