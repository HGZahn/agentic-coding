export const RESPONSES_ONLY_PREFIX = 'muse-spark'

export function isResponsesModel(id) {
  return String(id ?? '').toLowerCase().startsWith(RESPONSES_ONLY_PREFIX)
}

export function apiForModel(id) {
  return isResponsesModel(id) ? 'openai-responses' : 'openai-completions'
}
