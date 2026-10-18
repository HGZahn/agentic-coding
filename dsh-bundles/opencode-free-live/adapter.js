import { createProvider } from 'file:///usr/lib/node_modules/@deepseek-ai/dsh/node_modules/@earendil-works/pi-ai/dist/index.js'
import * as openaiCompletions from 'file:///usr/lib/node_modules/@deepseek-ai/dsh/node_modules/@earendil-works/pi-ai/dist/api/openai-completions.js'
import * as openaiResponses from 'file:///usr/lib/node_modules/@deepseek-ai/dsh/node_modules/@earendil-works/pi-ai/dist/api/openai-responses.js'

import { ensureFreeLaneShape, ensureResponsesFreeLaneShape } from './messages.js'
import { deriveRequestIDs, disguiseHeaders, opencodeUserAgent } from './ids.js'
import { apiForModel, isResponsesModel } from './routing.js'

export const PROVIDER_ID = 'opencode-free-live'

const DEFAULT_CONTEXT_WINDOW = 262144
const DEFAULT_MAX_TOKENS = 32768
const ANONYMOUS_KEY = 'public'

export function resolveApiKey(env = process.env) {
  const key = (env.OPENCODE_API_KEY || '').trim()
  return key.length > 0 ? key : ANONYMOUS_KEY
}

export class OpenCodeFreeAdapter {
  #catalog
  #provider
  #responsesProvider
  #bridgeBaseUrl
  #firstEventMs
  #bodyIdleMs

  constructor(catalog, options = {}) {
    this.#catalog = catalog
    this.#bridgeBaseUrl = (options.bridgeBaseUrl || 'http://127.0.0.1:49374').replace(/\/+$/, '')
    this.#firstEventMs = options.firstEventMs ?? 15000
    this.#bodyIdleMs = options.bodyIdleMs ?? 60000

    const baseUrl = this.#bridgeBaseUrl + '/v1'
    const auth = {
      apiKey: {
        name: 'OpenCode bridge key (OPENCODE_API_KEY, else anonymous)',
        resolve: async () => ({ auth: { apiKey: resolveApiKey() } }),
      },
    }
    this.#provider = createProvider({
      id: PROVIDER_ID,
      name: PROVIDER_ID,
      baseUrl,
      auth,
      models: [],
      api: openaiCompletions,
    })
    this.#responsesProvider = createProvider({
      id: PROVIDER_ID,
      name: PROVIDER_ID,
      baseUrl,
      auth,
      models: [],
      api: openaiResponses,
    })
  }

  providerInfo(provider) {
    return { id: provider, name: PROVIDER_ID }
  }

  listModels() {
    return this.#catalog.list()
  }

  /**
   * Build a pi-ai Model object for one free model from the catalog metadata.
   */
  resolveModel(modelId) {
    const meta = this.#catalog.get(modelId)
    if (!meta) return undefined

    const reasoning = this.#reasoningOptions(meta)
    const modalities = meta.modalities ?? { input: ['text'], output: ['text'] }
    const inputTypes = Array.isArray(modalities.input) ? modalities.input : ['text']
    const limits = meta.limit ?? {}

    return {
      id: meta.id ?? modelId,
      name: meta.name ?? modelId,
      api: apiForModel(modelId),
      provider: PROVIDER_ID,
      baseUrl: this.#bridgeBaseUrl + '/v1',
      reasoning,
      input: inputTypes.includes('image') ? ['text', 'image'] : ['text'],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: contextWindowFor(limits),
      maxTokens: defaultMaxTokensFor(limits),
      limit: limits,
      modalities,
      reasoningOptions: meta.reasoning_options,
    }
  }

  #reasoningOptions(meta) {
    const ro = meta.reasoning_options
    if (!ro || !Array.isArray(ro)) return { toggle: true }
    const effort = ro.find(r => r.type === 'effort')
    if (effort && Array.isArray(effort.values)) {
      return { effort: effort.values }
    }
    return { toggle: true }
  }

  async stream(modelId, context, options) {
    const model = this.resolveModel(modelId)
    if (!model) throw new Error(`Model ${modelId} not found in free catalog`)

    const ids = deriveRequestIDs(context.messages)
    const isResponses = isResponsesModel(modelId)
    const provider = isResponses ? this.#responsesProvider : this.#provider

    const onPayload = isResponses
      ? (payload) => {
          const normalized = ensureResponsesFreeLaneShape(payload)
          return normalized ?? payload
        }
      : (payload) => {
          const shaped = ensureFreeLaneShape(payload)
          if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return shaped
          return { ...payload, ...(shaped ?? payload) }
        }

    return provider.streamSimple(model, context, {
      apiKey: resolveApiKey(),
      sessionId: ids.session,
      headers: disguiseHeaders(ids),
      onPayload,
      signal: options.signal,
      maxRetries: 0,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    })
  }
}

function contextWindowFor(limits) {
  const declared = limits?.contextWindow
  return typeof declared === 'number' && Number.isSafeInteger(declared) && declared > 0
    ? declared
    : DEFAULT_CONTEXT_WINDOW
}

function defaultMaxTokensFor(limits) {
  const declared = limits?.maxOutput
  return typeof declared === 'number' && Number.isSafeInteger(declared) && declared > 0
    ? declared
    : DEFAULT_MAX_TOKENS
}
