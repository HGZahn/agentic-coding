import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CACHE_FILE = join(__dirname, '.free-models-cache.json')
const CATALOG_URL = 'https://models.opencode.ai/api.json'
const CACHE_TTL_MS = 300_000 // 5 minutes

/**
 * Fetches the 42 free opencode models from models.opencode.ai/api.json.
 * Stores full metadata per model (reasoning_options, modalities, limit, cost).
 * Falls back to a cached snapshot if the network is unavailable.
 */
export class ModelCatalog {
  #models = new Map()
  #updatedAt = 0
  #timer = undefined
  #refreshSeconds

  constructor(options = {}) {
    this.#refreshSeconds = options.refreshSeconds ?? 300
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
      const resp = await fetch(CATALOG_URL, { timeout: 10000 })
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
