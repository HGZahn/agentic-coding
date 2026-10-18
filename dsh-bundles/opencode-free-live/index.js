// Plugin entry: registers the direct-HTTPS opencode free-tier adapter.
//
// PROVENANCE (brief): this plugin started as a bridge-proxy around a local
// `opencode serve` subprocess (127.0.0.1:49374). That design was replaced
// after the session-id gate was solved by decompiling the generator
// (see ids.js) — the adapter now talks to opencode.ai directly with minted
// session ids and spawns nothing.
import { ModelCatalog } from './catalog.js'
import { OpenCodeFreeAdapter, PROVIDER_ID } from './adapter.js'

export const name = 'opencode-free-live'
export const inject = ['llm']

export function apply(ctx) {
  const catalog = new ModelCatalog({ refreshSeconds: 300 })
  const adapter = new OpenCodeFreeAdapter(catalog)
  ctx.llm.registerAdapter([PROVIDER_ID], adapter)
  ctx.effect(() => () => catalog.stop())
  void catalog.start().catch(() => ctx.logger.warn('OpenCode free catalog refresh failed'))
  ctx.logger.info('OpenCode Free Live: direct HTTPS adapter registered (minted session ids, no opencode process)')
}
