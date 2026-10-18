// Session-id minting for the opencode free tier — the exact port of opencode's
// own generator, so our ids decode exactly like ids minted by the real CLI.
//
// PROVENANCE (how each fact here was found, brief):
// - Wire shape: scripts/zen-mitm/mitm.py intercepted the real opencode CLI
//   (scripts/zen-mitm/README.md has the capture recipe); ids look like
//   ses_<12 hex><14 base62>, total 26 chars after the ses_ prefix.
// - Algorithm: decompiled /home/hadmin/.opencode/bin/opencode (Bun single-file
//   exe; JS in embedded chunk-*.js). Generator DZ()/Q$e()/Hf() found in
//   chunk-h907w4r7.js at absolute offset 0x7eff898 (opencode 2.0.31):
//     m=0; d=0; DZ(e, n=Date.now()) { if (n!==m) { m=n; d=0 } ; d++;
//       r = n*0x1000 + d;  a = e ? ~r : r;
//       prefix = 6 bytes of a>>(40-8D) & 0xff, hex;  tail = 14 random bytes via I[b%62] }
//   Sessions use the INVERTED variant (~r); per_/wrk_/evt_ ids use plain r.
// - Live proof: a freshly minted id sent to
//   https://opencode.ai/inference/openai/v1/chat/completions returned HTTP 200
//   with a streaming completion (.zen-mitm-work/mint/verify-mint.mjs). The gate
//   is decode-and-validate (counter d>=1, plausible ms) — no allowlist.
//
// UPDATE HINT: if the free tier starts rejecting ids (403 FreeTierError on
// models that used to work), re-extract DZ from the current opencode binary
// and re-verify against this file; also re-check the header set below and the
// UA string against a fresh MITM capture.

import { randomBytes } from 'node:crypto'

/** Captured verbatim from opencode 2.0.31 (MITM): no platform suffix. */
export const OPENCODE_USER_AGENT = 'opencode/latest/2.0.31/cli'

/** Captured x-opencode-project value from a working CLI request (MITM 2026-10-18). */
export const OPENCODE_PROJECT = 'a8aa488341ea80c0314be6035775511d9d19b429'

// Same constants as DZ in the binary.
const ID_LENGTH = 26
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

// DZ's module state: one counter shared across all id kinds, reset per ms.
let lastMs = 0
let perMsCount = 0

/**
 * Port of DZ(true) — the session-id variant (bit-inverted).
 * `nowMs` is injectable so tests can pin the millisecond.
 */
export function mintSession(nowMs = Date.now()) {
  return mintIdentifier(true, nowMs)
}

/**
 * Port of DZ(false) / Hf() — the plain variant used for per_/wrk_/evt_ ids.
 * Kept for parity with the binary; not currently sent by this adapter.
 */
export function mintPlainIdentifier(nowMs = Date.now()) {
  return mintIdentifier(false, nowMs)
}

function mintIdentifier(inverted, nowMs) {
  if (nowMs !== lastMs) {
    lastMs = nowMs
    perMsCount = 0
  }
  perMsCount += 1

  // r = (ms since epoch) * 4096 + per-ms counter. The counter occupies the low
  // 12 bits; only the low 36 bits of the ms survive into the 48-bit prefix.
  const raw = BigInt(nowMs) * 0x1000n + BigInt(perMsCount)
  const mixed = inverted ? ~raw : raw

  // Low 48 bits of `mixed`, big-endian, as 12 hex chars (bytes at shifts 40..0).
  let prefix = ''
  for (let shift = 40; shift >= 0; shift -= 8) {
    prefix += Number((mixed >> BigInt(shift)) & 0xffn).toString(16).padStart(2, '0')
  }

  // 14 random bytes mapped onto the 62-char alphabet exactly like DZ.
  const bytes = randomBytes(ID_LENGTH - 12)
  let tail = ''
  for (const b of bytes) tail += ALPHABET[b % ALPHABET.length]

  return `ses_${prefix}${tail}`
}

/**
 * Inverse of mintSession for tests/debugging: recover the per-ms counter `d`
 * and the encoded 36-bit millisecond. The ms is n36 + era*2^36; eras are
 * 2^36 ms (~19.07 h) apart, so pass the era you expect (26 for Oct 2026) or
 * let the function scan eras 0..40 for one within `maxAgeMs` of `nearMs`.
 *
 * UPDATE HINT: era arithmetic depends only on the epoch, not the binary.
 */
export function decodeSession(id, { era, nearMs = Date.now(), maxAgeMs = 48 * 3600 * 1000 } = {}) {
  if (typeof id !== 'string' || !id.startsWith('ses_')) return undefined
  const body = id.slice(4)
  if (body.length !== 26 || !/^[0-9a-f]{12}[0-9A-Za-z]{14}$/.test(body)) return undefined

  const low48 = BigInt('0x' + body.slice(0, 12))
  const unmasked = low48 ^ 0xffffffffffffn // undo the ~r inversion
  const d = Number(unmasked & 0xfffn)
  const n36 = Number((unmasked - (unmasked & 0xfffn)) >> 12n)
  const ERA_MS = 2 ** 36

  if (era !== undefined) {
    return { d, era, ms: n36 + era * ERA_MS }
  }
  for (let k = 0; k <= 40; k++) {
    const ms = n36 + k * ERA_MS
    if (Math.abs(nearMs - ms) <= maxAgeMs) return { d, era: k, ms }
  }
  return { d, era: undefined, ms: undefined }
}

/**
 * The full MITM-captured header set for upstream calls, with a fresh session
 * id. Host/Accept-Encoding/Content-Length are transport-level (fetch adds
 * them); Content-Type and Accept belong to the request itself.
 *
 * UPDATE HINT: re-capture with scripts/zen-mitm/ if the gate ever widens.
 */
export function upstreamHeaders(sessionId) {
  return {
    'Authorization': 'Bearer public',
    'User-Agent': OPENCODE_USER_AGENT,
    'x-opencode-client': 'cli',
    'x-opencode-project': OPENCODE_PROJECT,
    'x-opencode-session': sessionId,
    'x-opencode-session-id': sessionId,
    'Accept': '*/*',
  }
}
