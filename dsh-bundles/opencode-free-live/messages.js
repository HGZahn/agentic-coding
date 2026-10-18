/**
 * Free-lane gate tool injection for the opencode serve bridge.
 * The anonymous free lane rejects chat bodies without bash+read tools
 * and requires tool_choice 'none' when no client tools are present.
 */

export const FREE_LANE_GATE_TOOL_NAMES = ['bash', 'read']

export function freeLaneGateTool(name) {
  return {
    type: 'function',
    function: {
      name,
      description: 'Reserved for the host runtime; do not call it.',
      parameters: { type: 'object', properties: {} },
    },
  }
}

/** Responses uses flat function tools and its Zen gateway accepts auto only. */
export function ensureResponsesFreeLaneShape(payload) {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return undefined
  const body = payload
  if (!Array.isArray(body.input)) return undefined
  const tools = Array.isArray(body.tools) ? body.tools : []
  const names = new Set(tools.map((tool) => {
    if (typeof tool !== 'object' || tool === null) return undefined
    const candidate = tool
    return candidate.type === 'function' ? candidate.name : undefined
  }))
  const missing = FREE_LANE_GATE_TOOL_NAMES.filter((name) => !names.has(name))
  const invalidChoice = body.tool_choice !== undefined && body.tool_choice !== 'auto'
  if (missing.length === 0 && !invalidChoice) return undefined
  return {
    ...body,
    tools: [...tools, ...missing.map((name) => ({ type: 'function', ...freeLaneGateTool(name).function }))],
    tool_choice: 'auto',
  }
}

/**
 * Rewrite an outgoing chat-completions payload so it satisfies the free-lane
 * agent-shape gate. Appends only the gate tools the payload is missing;
 * when the context carried no tools at all, tool_choice 'none' keeps the
 * model from ever calling the injected stubs, while client-provided tool
 * choices are preserved untouched.
 */
export function ensureFreeLaneShape(payload) {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return undefined
  const body = payload
  if (!Array.isArray(body.messages)) return undefined
  const tools = Array.isArray(body.tools) ? body.tools : []
  const names = new Set(
    tools.map((tool) => {
      const fn = typeof tool === 'object' && tool !== null ? tool.function : undefined
      return typeof fn === 'object' && fn !== null ? fn.name : undefined
    }),
  )
  const missing = FREE_LANE_GATE_TOOL_NAMES.filter((name) => !names.has(name))
  if (missing.length === 0) return undefined
  const next = { ...body }
  next.tools = [...tools, ...missing.map((name) => freeLaneGateTool(name))]
  if (tools.length === 0) next.tool_choice = 'none'
  return next
}
