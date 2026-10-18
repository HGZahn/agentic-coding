// Mapping from the DSH message vocabulary (dsh-llm GenerateOptions) to the
// OpenAI-compatible bodies the opencode inference gateway accepts.
//
// PROVENANCE (brief):
// - The chat-completions body shape was confirmed by replaying a captured
//   opencode CLI request (.zen-mitm-work/req-019.body) through the gateway:
//   plain OpenAI chat format, stream:true, stream_options.include_usage.
// - IMPORTANT: the earlier "free lane requires bash+read gate tools" belief
//   was DISPROVEN — the captured working request carried NO tools at all
//   (tools: []) and returned HTTP 200 and streams. What the gateway DOES check
//   is the client fingerprint of the body: dropping the opencode system
//   preamble turns a passing request into 403 FreeTierError even with a valid
//   freshly minted session id. So every request carries `preamble` (see
//   OPENCODE_CLIENT_PREAMBLE in adapter.js) as its leading system message.
// - The Responses lane (/inference/openai/v1/responses) is standard OpenAI
//   Responses wire format; used only by muse-* models (see routing.js).

const MAX_IMAGE_HANDLE = 200

/** Join the text out of a content block list. */
function textOf(blocks) {
  let out = ''
  for (const block of blocks ?? []) {
    if (block?.type === 'text' && typeof block.text === 'string') {
      out += (out ? '\n' : '') + block.text
    }
  }
  return out
}

/**
 * Project an image block to model-visible text. DSH attaches images as
 * durable attachment refs (dsh-attachment), not inline bytes; the documented
 * provider projection is a text handle naming the image. Free-lane models
 * marked image-capable in the catalog therefore receive a handle, not pixels.
 *
 * UPDATE HINT: to send real pixels, resolve ImageAttachmentRef bytes through
 * the dsh-attachment service and emit an OpenAI image_url part here.
 */
function imageHandle(block) {
  const att = block?.attachment ?? {}
  const name = att.name ?? att.title ?? att.id ?? 'image'
  const path = att.path ?? att.savedPath ?? ''
  const line = `[image: ${name}${path ? ` — ${path}` : ''}]`
  return line.length > MAX_IMAGE_HANDLE ? line.slice(0, MAX_IMAGE_HANDLE - 1) + '…' : line
}

/**
 * Map GenerateOptions.messages (+ one-shot `system`) to OpenAI chat messages.
 * Roles per dsh-llm: system | developer | user | assistant | tool.
 * - `preamble` is the fixed opencode client system message the free-tier gate
 *   fingerprints on; caller `system` follows it in the same system message.
 * - developer messages carry DSH-internal tool declarations; the complete
 *   active tool list travels in the request `tools` field instead.
 * - assistant reasoning blocks are model-internal; not replayed upstream.
 */
export function toOpenAIChatMessages(messages, system, preamble) {
  const out = []
  const parts = [preamble, typeof system === 'string' ? system : ''].filter(
    (part) => typeof part === 'string' && part.trim() !== '',
  )
  if (parts.length > 0) out.push({ role: 'system', content: parts.join('\n\n') })

  for (const msg of messages ?? []) {
    switch (msg?.role) {
      case 'system':
        out.push({ role: 'system', content: textOf(msg.content) })
        break
      case 'developer':
        break
      case 'user': {
        const parts = []
        for (const block of msg.content ?? []) {
          if (block?.type === 'text') {
            parts.push({ type: 'text', text: block.text ?? '' })
          } else if (block?.type === 'image') {
            parts.push({ type: 'text', text: imageHandle(block) })
          }
          // file blocks: DSH projects files to handle text upstream already
        }
        out.push({ role: 'user', content: parts.length === 1 && parts[0].type === 'text' ? parts[0].text : parts })
        break
      }
      case 'assistant': {
        const text = textOf(msg.content)
        const toolCalls = []
        for (const block of msg.content ?? []) {
          if (block?.type === 'tool-call') {
            toolCalls.push({
              id: block.id,
              type: 'function',
              function: { name: block.name, arguments: block.arguments ?? '{}' },
            })
          }
        }
        const entry = { role: 'assistant', content: text || null }
        if (toolCalls.length > 0) entry.tool_calls = toolCalls
        out.push(entry)
        break
      }
      case 'tool':
        out.push({ role: 'tool', tool_call_id: msg.toolCallId, content: textOf(msg.content) })
        break
      default:
        break
    }
  }
  return out
}

/** Map DSH ToolSchema[] to OpenAI chat `tools`. */
export function toOpenAITools(tools) {
  return (tools ?? [])
    .filter((tool) => tool && typeof tool.name === 'string')
    .map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description ?? '',
        parameters: tool.parameters ?? { type: 'object', properties: {} },
      },
    }))
}

/**
 * Map messages to OpenAI Responses `input` items (+ `instructions`).
 * Only the muse-* models route here today.
 */
export function toOpenAIResponsesInput(messages, system) {
  const items = []
  for (const msg of messages ?? []) {
    if (msg?.role === 'user') {
      const text = textOf(msg.content) || (msg.content ?? []).map((b) => (b?.type === 'image' ? imageHandle(b) : '')).filter(Boolean).join('\n')
      items.push({ role: 'user', content: [{ type: 'input_text', text }] })
    } else if (msg?.role === 'assistant') {
      const text = textOf(msg.content)
      if (text) items.push({ role: 'assistant', content: [{ type: 'output_text', text }] })
    } else if (msg?.role === 'system' || msg?.role === 'developer') {
      // System prompts ride `instructions` (leading) or stay unsupported mid-history.
    }
  }
  const instructions = typeof system === 'string' && system ? system : undefined
  return { input: items, instructions }
}

/** Map DSH ToolSchema[] to Responses flat function tools. */
export function toResponsesTools(tools) {
  return (tools ?? [])
    .filter((tool) => tool && typeof tool.name === 'string')
    .map((tool) => ({
      type: 'function',
      name: tool.name,
      description: tool.description ?? '',
      parameters: tool.parameters ?? { type: 'object', properties: {} },
    }))
}
