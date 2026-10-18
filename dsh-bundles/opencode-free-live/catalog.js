import { readFileSync } from 'node:fs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CACHE_FILE = join(__dirname, '.free-models-cache.json')
const CATALOG_URL = 'https://models.opencode.ai/api.json'
const CACHE_TTL_MS = 300_000 // 5 minutes

/**
 * Fetches the free opencode models from models.opencode.ai/api.json.
 * Stores full metadata per model (reasoning_options, modalities, limit, cost).
 * Falls back to a cached snapshot if the network is unavailable.
 *
 * PROVENANCE (brief): models.opencode.ai/api.json is the full public model
 * directory (127 models, 42 of them free-named with zero cost as of
 * 2026-10-18). The CLI's own GET https://opencode.ai/zen/v1/models lists only
 * 9 free-named ids without metadata, so api.json is the right source for the
 * "42 free models" set. Verified against a live fetch + the MITM capture.
 * NOTE: limit fields are `context`/`output` (NOT contextWindow/maxOutput),
 * checked directly against the live api.json payload.
 *
 * UPDATE HINT: the free set can drift (server-side deprecations happen —
 * muse-spark-1.3-contributor-free returned 410 ModelDeprecated on 2026-10-18).
 * Re-check the count filter if models start erroring.
 */
export class ModelCatalog {
  #models = new Map()
  #updatedAt = 0
  #timer = undefined
  #refreshSeconds

  constructor(options = {}) {
    this.#refreshSeconds = options.refreshSeconds ?? 300
    // Seed synchronously from the on-disk snapshot BEFORE DSH reads the model
    // list. Provenance: DSH calls listModels() the moment the adapter is
    // registered, which happens before any awaited network fetch resolves, so
    // an async-only load left the provider showing 0 models in the UI. Reading
    // the cache here makes the 42 models available on the very first call; the
    // network refresh in start() then updates them in the background.
    this.#seedFromCache()
  }

  #seedFromCache() {
    try {
      const cached = JSON.parse(readFileSync(CACHE_FILE, 'utf-8'))
      // Cache shape written by #refresh(): { free: { <id>: <meta> }, fetchedAt }.
      const free = cached?.free ?? cached?.models ?? cached
      if (free && typeof free === 'object' && Object.keys(free).length > 0) {
        this.#models = new Map(Object.entries(free))
        this.#updatedAt = cached?.fetchedAt ?? 0
      }
    } catch {
      // No cache yet (first ever run) — start() will fetch it.
    }
  }

  async start() {
    await this.#refresh()
    this.#timer = setInterval(() => this.#refresh(), this.#refreshSeconds * 1000)
  }

  stop() {
    if (this.#timer !== undefined) {
      clearInterval(this.#timer)
      this.#timer = undefined
    }
  }

  /** Return all free model IDs sorted alphabetically. */
  list() {
    return [...this.#models.keys()].sort()
  }

  /** Return full metadata for one model, or undefined. */
  get(id) {
    return this.#models.get(id)
  }

  get updatedAt() {
    return this.#updatedAt
  }

  async #refresh() {
    try {
      const resp = await fetch(CATALOG_URL, { signal: AbortSignal.timeout(10_000) })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()
      const opencode = data?.opencode?.models ?? {}
      const free = {}
      for (const [id, meta] of Object.entries(opencode)) {
        if (typeof id === 'string' && id.toLowerCase().includes('free')) {
          free[id] = meta
        }
      }
      // Write cache
      try {
        await mkdir(__dirname, { recursive: true })
        await writeFile(CACHE_FILE, JSON.stringify({ free, fetchedAt: Date.now() }), 'utf-8')
      } catch { /* cache write is best-effort */ }
      this.#models = new Map(Object.entries(free))
      this.#updatedAt = Date.now()
    } catch (err) {
      // Try loading from cache
      try {
        const cached = JSON.parse(await readFile(CACHE_FILE, 'utf-8'))
        this.#models = new Map(Object.entries(cached.free ?? {}))
        this.#updatedAt = cached.fetchedAt ?? 0
      } catch {
        // No cache available either — leave empty
      }
    }
  }
}
