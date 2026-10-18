import { ModelCatalog } from './catalog.js'
import { OpenCodeFreeAdapter, PROVIDER_ID } from './adapter.js'

export const name = 'opencode-free-live'
export const inject = ['llm']

export function apply(ctx) {
  const catalog = new ModelCatalog({ refreshSeconds: 300 })
  const adapter = new OpenCodeFreeAdapter(catalog, {
    bridgeBaseUrl: 'http://127.0.0.1:49374',
  })
  ctx.llm.registerAdapter([PROVIDER_ID], adapter)
  ctx.effect(() => () => catalog.stop())
  void catalog.start().catch(() => ctx.logger.warn('OpenCode free catalog refresh failed'))
  ctx.logger.info('OpenCode Free Live bridge-proxy adapter registered')
}
