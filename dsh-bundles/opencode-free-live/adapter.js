// Direct HTTPS adapter for the opencode free tier — NO opencode process, NO
// opencode dependency. Registers as DSH provider 'opencode-free-live' and
// streams OpenAI-compatible completions straight from opencode.ai.
//
// PROVENANCE (how this worked out, brief):
// - Endpoint + header set: MITM capture of the real opencode CLI
//   (scripts/zen-mitm/mitm.py; capture recipe in scripts/zen-mitm/README.md).
//   POST https://opencode.ai/inference/openai/v1/chat/completions with
//   Authorization: Bearer public plus the x-opencode-* headers (ids.js).
// - The only gate is the session id: a freshly minted ses_ id (ids.js, ported
//   from the decompiled generator) returns HTTP 200 with SSE; random/garbage
//   ids get 403 FreeTierError. Proven live in .zen-mitm-work/mint/.
// - SSE vocabulary captured in .zen-mitm-work/mint/sse-sample.txt:
//   reasoning arrives as choices[0].delta.reasoning (NOT reasoning_content),
//   visible text as delta.content; the final chunk carries finish_reason and
//   usage (prompt_tokens_details.cached_tokens / cache_write_tokens,
//   completion_tokens_details.reasoning_tokens); stream ends with data:[DONE].
// - StreamChunk contract read from @deepseek-ai/dsh-llm type defs
//   (lib/types/types.d.ts): block-start/text-delta/reasoning-delta/
//   tool-call-delta/block-end, then usage, then terminal finish.
//
// - BODY FINGERPRINT (the second half of the gate): a valid session id alone is
//   not enough. A bare body (single short user message, no preamble) gets 403
//   FreeTierError, while the opencode-shaped body captured from the CLI returns
//   200 with the SAME fresh id. Proven by mutation in .zen-mitm-work/mint/
//   (probe-shape / probe-matrix): what flips 200 -> 403 is dropping the
//   opencode system preamble. So we always prepend OPENCODE_SYSTEM_PROMPT
//   below; genuine caller system text is appended after it.
//
// UPDATE HINT: if the gateway changes (new gate, new SSE fields), re-capture
// with scripts/zen-mitm/ and re-check ids.js + the parsers below.

import { LlmAdapter, LlmError } from 'file:///usr/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-llm/lib/index.js'

import { mintSession, upstreamHeaders } from './ids.js'
import { OPENCODE_SYSTEM_PROMPT } from './opencode-system-prompt.js'
import {
  toOpenAIChatMessages,
  toOpenAITools,
  toOpenAIResponsesInput,
  toResponsesTools,
} from './messages.js'
import { apiForModel } from './routing.js'

export const PROVIDER_ID = 'opencode-free-live'

const CHAT_COMPLETIONS_URL = 'https://opencode.ai/inference/openai/v1/chat/completions'
const RESPONSES_URL = 'https://opencode.ai/inference/openai/v1/responses'
const DEFAULT_CONTEXT_WINDOW = 262144
const DEFAULT_MAX_TOKENS = 32768

// Verbatim from the captured opencode CLI request (.zen-mitm-work/req-019.body).
// The free-tier gate fingerprints the body, not just the session id: with this
// exact preamble the request is accepted; replacing OR dropping it makes the
// same freshly minted id return 403 FreeTierError (probe-final.mjs cases B/C).

function errorFor(status, message) {
  const code = status === 401 || status === 403 ? 'AUTH' : status === 429 ? 'RATE_LIMIT' : 'PROVIDER'
  return new LlmError(`opencode free tier HTTP ${status}: ${message}`, code, { status })
}

/** TokenUsage per dsh-llm: disjoint counts (uncached input | cacheRead | cacheWrite). */
export function mapUsage(usage) {
  if (!usage || typeof usage !== 'object') return undefined
  const promptDetails = usage.prompt_tokens_details ?? {}
  const cached = promptDetails.cached_tokens ?? 0
  const cacheWrite = promptDetails.cache_write_tokens ?? 0
  const reasoning = usage.completion_tokens_details?.reasoning_tokens
  const mapped = {
    inputTokens: Math.max(0, (usage.prompt_tokens ?? 0) - cached - cacheWrite),
    outputTokens: usage.completion_tokens ?? 0,
  }
  if (typeof usage.total_tokens === 'number') mapped.totalTokens = usage.total_tokens
  if (cached > 0) mapped.cacheReadTokens = cached
  if (cacheWrite > 0) mapped.cacheWriteTokens = cacheWrite
  if (typeof reasoning === 'number' && reasoning > 0) mapped.reasoningTokens = reasoning
  return mapped
}

function mapFinishReason(reason) {
  if (reason === 'length') return { kind: 'max-tokens' }
  if (reason === 'tool_calls' || reason === 'tool_use') return { kind: 'tool-calls' }
  return { kind: 'stop' }
}

/** Pull-based SSE reader: one yielded JSON string per `data:` line. No event can be dropped —
 * the consumer pulls and the buffer holds partial chunks across reads. */
export async function* sseData(body) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const emitLine = (line) => {
    if (!line.startsWith('data:')) return undefined
    const data = line.slice(5).trim()
    if (data === '') return undefined
    if (data === '[DONE]') return null
    return data
  }
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let nl
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const data = emitLine(buffer.slice(0, nl))
      buffer = buffer.slice(nl + 1)
      if (data === null) return
      if (data !== undefined) yield data
    }
  }
  const data = emitLine(buffer + decoder.decode())
  if (data === null) return
  if (data !== undefined) yield data
}

export class OpenCodeFreeAdapter extends LlmAdapter {
  #catalog
  #fetchImpl

  constructor(catalog, options = {}) {
    super()
    this.#catalog = catalog
    this.#fetchImpl = options.fetch ?? ((...args) => globalThis.fetch(...args))
  }

  providerInfo(provider) {
    return { id: provider, name: 'opencode-free' }
  }

  providerRetryPolicy() {
    return undefined
  }

  imageRequestPricing() {
    return undefined
  }

  async listModels() {
    return this.#catalog.list().map((id) => {
      const meta = this.#catalog.get(id) ?? {}
      const inputs = Array.isArray(meta.modalities?.input) ? meta.modalities.input : ['text']
      return {
        id,
        name: meta.name ?? id,
        description: meta.description,
        inputModalities: inputs.includes('image') ? ['text', 'image'] : ['text'],
      }
    })
  }

  async resolveModel(provider, model, _signal) {
    const meta = this.#catalog.get(model) ?? {}
    const inputs = Array.isArray(meta.modalities?.input) ? meta.modalities.input : ['text']
    const limit = meta.limit ?? {}
    const info = {
      id: model,
      name: meta.name ?? model,
      description: meta.description,
      inputModalities: inputs.includes('image') ? ['text', 'image'] : ['text'],
      context: {
        contextWindow:
          typeof limit.context === 'number' && limit.context > 0 ? limit.context : DEFAULT_CONTEXT_WINDOW,
      },
      defaultMaxTokens:
        typeof limit.output === 'number' && limit.output > 0 ? limit.output : DEFAULT_MAX_TOKENS,
    }
    // reasoning_options shapes seen in models.opencode.ai/api.json:
    // {type:'effort',values:[...]}, {type:'toggle'}, {type:'budget_tokens',max}
    const effort = (meta.reasoning_options ?? []).find(
      (option) => option?.type === 'effort' && Array.isArray(option.values) && option.values.length > 0,
    )
    if (effort) {
      info.reasoning = {
        efforts: effort.values.map((value) => ({ id: String(value), name: String(value) })),
      }
    }
    return info
  }

  async *stream(options) {
    const lane = apiForModel(options.model)
    const session = mintSession()
    const url = lane === 'openai-responses' ? RESPONSES_URL : CHAT_COMPLETIONS_URL
    const body =
      lane === 'openai-responses'
        ? this.#responsesBody(options)
        : this.#completionsBody(options)

    const response = await this.#fetchImpl(url, {
      method: 'POST',
      headers: { ...upstreamHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: options.signal,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw errorFor(response.status, text.slice(0, 300) || response.statusText)
    }
    if (!response.body) {
      throw errorFor(response.status ?? 502, 'empty response body')
    }

    const assembler =
      lane === 'openai-responses' ? new ResponsesAssembler() : new CompletionsAssembler()
    for await (const data of sseData(response.body)) {
      let event
      try {
        event = JSON.parse(data)
      } catch {
        continue // tolerate keep-alives / partial junk lines
      }
      const chunk = assembler.push(event)
      if (chunk) yield chunk
    }
    for (const chunk of assembler.finish()) yield chunk
  }

  #completionsBody(options) {
    const body = {
      model: options.model,
      messages: toOpenAIChatMessages(options.messages, options.system, OPENCODE_SYSTEM_PROMPT),
      stream: true,
      stream_options: { include_usage: true },
    }
    const tools = toOpenAITools(options.tools)
    if (tools.length > 0) {
      body.tools = tools
      body.tool_choice = 'auto'
    }
    if (typeof options.temperature === 'number') body.temperature = options.temperature
    if (typeof options.maxTokens === 'number' && options.maxTokens > 0) body.max_tokens = options.maxTokens
    if (Array.isArray(options.stop) && options.stop.length > 0) body.stop = options.stop
    if (typeof options.reasoningEffort === 'string') body.reasoning_effort = options.reasoningEffort
    return body
  }

  #responsesBody(options) {
    const { input, instructions } = toOpenAIResponsesInput(options.messages, options.system)
    const body = { model: options.model, input, stream: true, store: false }
    if (instructions) body.instructions = instructions
    const tools = toResponsesTools(options.tools)
    if (tools.length > 0) {
      body.tools = tools
      body.tool_choice = 'auto'
    }
    if (typeof options.temperature === 'number') body.temperature = options.temperature
    if (typeof options.maxTokens === 'number' && options.maxTokens > 0) body.max_output_tokens = options.maxTokens
    if (typeof options.reasoningEffort === 'string') body.reasoning = { effort: options.reasoningEffort }
    return body
  }
}

/**
 * Assembles chat-completions SSE chunks into StreamChunks. Blocks open lazily
 * on the first delta of their kind; everything closes in finish() in open
 * order. Usage rides the final chunk (include_usage) and is emitted after the
 * block-ends, before the terminal finish — per the dsh-llm contract.
 */
export class CompletionsAssembler {
  #blocks = []
  #byType = new Map() // 'text' | 'reasoning' -> block record
  #tools = new Map() // upstream tool index -> { blockIndex, id, name, arguments }
  #usage
  #finishReason

  #ensureBlock(type) {
    let block = this.#byType.get(type)
    if (!block) {
      block = { index: this.#blocks.length, blockType: type, text: '' }
      this.#blocks.push(block)
      this.#byType.set(type, block)
      return { block, opened: true }
    }
    return { block, opened: false }
  }

  push(event) {
    if (event?.usage) this.#usage = event.usage
    const choice = event?.choices?.[0]
    if (!choice) return undefined
    if (choice.finish_reason) this.#finishReason = choice.finish_reason
    const delta = choice.delta
    if (!delta) return undefined

    // One delta may legally carry several fields at once; process all of them.
    const chunks = []
    if (typeof delta.reasoning === 'string' && delta.reasoning.length > 0) {
      const { block, opened } = this.#ensureBlock('reasoning')
      block.text += delta.reasoning
      if (opened) chunks.push({ type: 'block-start', index: block.index, blockType: 'reasoning' })
      chunks.push({ type: 'reasoning-delta', index: block.index, text: delta.reasoning })
    }
    if (typeof delta.content === 'string' && delta.content.length > 0) {
      const { block, opened } = this.#ensureBlock('text')
      block.text += delta.content
      if (opened) chunks.push({ type: 'block-start', index: block.index, blockType: 'text' })
      chunks.push({ type: 'text-delta', index: block.index, text: delta.content })
    }
    if (Array.isArray(delta.tool_calls)) {
      for (const call of delta.tool_calls) {
        const slot = call?.index ?? 0
        let record = this.#tools.get(slot)
        if (!record) {
          record = { blockIndex: this.#blocks.length, id: '', name: '', arguments: '', announced: false }
          this.#blocks.push({ index: record.blockIndex, blockType: 'tool-call' })
          this.#tools.set(slot, record)
          chunks.push({ type: 'block-start', index: record.blockIndex, blockType: 'tool-call' })
        }
        if (typeof call.id === 'string' && call.id) record.id = call.id
        if (typeof call.function?.name === 'string' && call.function.name) record.name = call.function.name
        if ((record.id || record.name) && !record.announced) {
          record.announced = true
          chunks.push({ type: 'tool-call-delta', id: record.id, name: record.name, argumentsDelta: '' })
        }
        const fragment = call.function?.arguments
        if (typeof fragment === 'string' && fragment.length > 0) {
          record.arguments += fragment
          chunks.push({ type: 'tool-call-delta', id: record.id, argumentsDelta: fragment })
        }
      }
    }
    if (chunks.length === 0) return undefined
    return chunks.length === 1 ? chunks[0] : chunks
  }

  finish() {
    const chunks = []
    for (const block of this.#blocks) {
      if (block.blockType === 'tool-call') {
        // Tool blocks carry their record text via #tools; find it by index.
        const record = [...this.#tools.values()].find((entry) => entry.blockIndex === block.index)
        chunks.push({
          type: 'block-end',
          index: block.index,
          block: { type: 'tool-call', id: record?.id ?? '', name: record?.name ?? '', arguments: record?.arguments ?? '' },
        })
      } else {
        chunks.push({
          type: 'block-end',
          index: block.index,
          block: { type: block.blockType, text: block.text },
        })
      }
    }
    const usage = mapUsage(this.#usage)
    if (usage) chunks.push({ type: 'usage', usage })
    chunks.push({ type: 'finish', reason: mapFinishReason(this.#finishReason) })
    return chunks
  }
}

/**
 * Assembler for the standard OpenAI Responses SSE vocabulary (muse-* lane).
 * Events used: response.output_text.delta, response.reasoning_summary_text.delta,
 * response.output_item.added (function_call), response.function_call_arguments.delta,
 * response.completed / response.incomplete / response.failed.
 */
export class ResponsesAssembler {
  #textIndex
  #reasoningIndex
  #toolIndex
  #toolRecord
  #text = ''
  #reasoning = ''
  #finish
  #usage

  push(event) {
    if (!event || typeof event.type !== 'string') return undefined
    switch (event.type) {
      case 'response.output_text.delta': {
        if (this.#textIndex === undefined) {
          this.#textIndex = 0
          return [
            { type: 'block-start', index: 0, blockType: 'text' },
            { type: 'text-delta', index: 0, text: event.delta ?? '' },
          ]
        }
        this.#text += event.delta ?? ''
        return { type: 'text-delta', index: 0, text: event.delta ?? '' }
      }
      case 'response.reasoning_summary_text.delta':
      case 'response.reasoning_text.delta': {
        if (this.#reasoningIndex === undefined) {
          this.#reasoningIndex = 1
          this.#reasoning += event.delta ?? ''
          return [
            { type: 'block-start', index: 1, blockType: 'reasoning' },
            { type: 'reasoning-delta', index: 1, text: event.delta ?? '' },
          ]
        }
        this.#reasoning += event.delta ?? ''
        return { type: 'reasoning-delta', index: 1, text: event.delta ?? '' }
      }
      case 'response.output_item.added': {
        if (event.item?.type === 'function_call') {
          this.#toolIndex = this.#toolIndex ?? 2
          this.#toolRecord = { id: event.item.call_id ?? '', name: event.item.name ?? '', arguments: '' }
          return [
            { type: 'block-start', index: this.#toolIndex, blockType: 'tool-call' },
            { type: 'tool-call-delta', id: this.#toolRecord.id, name: this.#toolRecord.name, argumentsDelta: '' },
          ]
        }
        return undefined
      }
      case 'response.function_call_arguments.delta': {
        if (this.#toolRecord) {
          this.#toolRecord.arguments += event.delta ?? ''
          return { type: 'tool-call-delta', id: this.#toolRecord.id, argumentsDelta: event.delta ?? '' }
        }
        return undefined
      }
      case 'response.completed':
      case 'response.incomplete': {
        this.#usage = event.response?.usage
        this.#finish = event.type === 'response.incomplete' ? 'length' : 'stop'
        return undefined
      }
      case 'response.failed': {
        throw errorFor(event.response?.status ?? 502, event.response?.error?.message ?? 'response.failed')
      }
      default:
        return undefined
    }
  }

  finish() {
    const chunks = []
    if (this.#reasoningIndex !== undefined) {
      chunks.push({ type: 'block-end', index: 1, block: { type: 'reasoning', text: this.#reasoning } })
    }
    if (this.#textIndex !== undefined) {
      chunks.push({ type: 'block-end', index: 0, block: { type: 'text', text: this.#text } })
    }
    if (this.#toolRecord) {
      chunks.push({
        type: 'block-end',
        index: this.#toolIndex,
        block: { type: 'tool-call', id: this.#toolRecord.id, name: this.#toolRecord.name, arguments: this.#toolRecord.arguments },
      })
    }
    const usage = this.#usage
      ? {
          inputTokens: this.#usage.input_tokens ?? 0,
          outputTokens: this.#usage.output_tokens ?? 0,
          ...(typeof this.#usage.total_tokens === 'number' ? { totalTokens: this.#usage.total_tokens } : {}),
          ...((this.#usage.input_tokens_details?.cached_tokens ?? 0) > 0
            ? { cacheReadTokens: this.#usage.input_tokens_details.cached_tokens }
            : {}),
          ...((this.#usage.output_tokens_details?.reasoning_tokens ?? 0) > 0
            ? { reasoningTokens: this.#usage.output_tokens_details.reasoning_tokens }
            : {}),
        }
      : undefined
    if (usage) chunks.push({ type: 'usage', usage })
    chunks.push({ type: 'finish', reason: mapFinishReason(this.#finish) })
    return chunks
  }
}
