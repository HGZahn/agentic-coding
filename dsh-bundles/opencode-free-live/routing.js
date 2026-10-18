// Lane selection per model id.
//
// PROVENANCE (brief): probed live with minted session ids on 2026-10-18 —
// regular free models answer on /inference/openai/v1/chat/completions, while
// muse-* models answer 403 FreeTierError there (muse-spark-1.2) or 410
// ModelDeprecated (muse-spark-1.3); the muse pair routes to the Responses
// endpoint, standard OpenAI Responses wire format. All other free models use
// the chat-completions lane.
export const RESPONSES_ONLY_PREFIX = 'muse-spark'

export function isResponsesModel(id) {
  return String(id ?? '').toLowerCase().startsWith(RESPONSES_ONLY_PREFIX)
}

/** @returns 'openai-responses' | 'openai-completions' */
export function apiForModel(id) {
  return isResponsesModel(id) ? 'openai-responses' : 'openai-completions'
}
