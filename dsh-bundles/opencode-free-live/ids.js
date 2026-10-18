import { createHash, randomBytes } from 'node:crypto'

/** sha256("prefix\0value") truncated to 12 bytes: stable, non-reversible. */
export function stableID(prefix, value) {
  const sum = createHash('sha256').update(prefix + '\x00' + value).digest()
  return `${prefix}_${sum.subarray(0, 12).toString('hex')}`
}

export function randomID(prefix, size) {
  return `${prefix}_${randomBytes(size).toString('hex')}`
}

export function firstString(...values) {
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed) return trimmed
  }
  return ''
}

/** The conversation signal: JSON of the first user message's content. */
export function conversationSeed(messages) {
  for (const message of messages) {
    if (message.role !== 'user') continue
    const encoded = JSON.stringify(message.content ?? null)
    if (encoded !== 'null' && encoded.length > 0) return encoded
  }
  return ''
}

/** Derive correlation ids for one upstream request. */
export function deriveRequestIDs(messages) {
  let signal = conversationSeed(messages)
  if (signal === '' || signal === '{}') signal = randomID('fallback', 16)
  return {
    session: canonicalSessionID(signal),
    request: randomID('req', 16),
    project: stableID('prj', 'opencode-free-live:default-project'),
    parentSession: '',
  }
}

const CANONICAL_SESSION_PATTERN = /^ses_[0-9a-f]{12}[0-9A-Za-z]{14}$/
const BASE62_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

function base62Fixed(value, width) {
  const base = 62n
  let n = value
  const out = new Array(width)
  for (let i = width - 1; i >= 0; i--) {
    out[i] = BASE62_ALPHABET.charAt(Number(n % base))
    n /= base
  }
  return out.join('')
}

export function canonicalSessionID(signal) {
  if (CANONICAL_SESSION_PATTERN.test(signal)) return signal
  const sum = createHash('sha256').update('ses\x00' + signal).digest()
  const timePart = sum.subarray(0, 6).toString('hex')
  const randomPart = base62Fixed(BigInt('0x' + sum.subarray(6, 16).toString('hex')), 14)
  return `ses_${timePart}${randomPart}`
}

/** CLI-identical user agent (captured: opencode/latest/2.0.31/cli). */
export function opencodeUserAgent() {
  return `opencode/latest/2.0.31/cli (${process.platform} ${process.arch}; node${process.versions.node})`
}

/** The full disguise header set sent with every upstream request. */
export function disguiseHeaders(ids) {
  return {
    'user-agent': opencodeUserAgent(),
    'x-opencode-client': 'cli',
    'x-opencode-session': ids.session,
    'x-session-affinity': ids.session,
    'X-Session-Id': ids.session,
    'x-opencode-request': ids.request,
    'x-opencode-project': ids.project,
  }
}
