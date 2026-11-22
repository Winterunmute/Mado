export const MESSENGER_LIST_URL = 'https://www.facebook.com/messages/'
export const MAX_CONVERSATION_TABS = 24

export interface ConversationTab {
  id: string
  key: string
  url: string
  label: string
  pinned: boolean
}

export interface MessengerLocation {
  url: string | null
  key: string | null
  isList: boolean
}

const MESSENGER_HOSTS = new Set(['facebook.com', 'www.facebook.com'])

// A narrow read-only check for tab data. The main-process navigation classifier
// remains the actual security boundary; this only decides what can be stored.
function isMessengerContentUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    return url.protocol === 'https:' &&
      MESSENGER_HOSTS.has(url.hostname.toLowerCase()) &&
      !url.username && !url.password &&
      /^\/messages(?:\/|$)/i.test(url.pathname)
  } catch {
    return false
  }
}

function decodeSegment(value: string): string {
  try { return decodeURIComponent(value) } catch { return value }
}

// Facebook currently uses /messages/t/<id>/ and /messages/<id>/; tabs are keyed by
// the normalized path after /messages so either format can be matched safely.
export function conversationKeyFromUrl(rawUrl: string): string | null {
  if (!isMessengerContentUrl(rawUrl)) return null
  try {
    const url = new URL(rawUrl)
    const rest = url.pathname.split('/').filter(Boolean).slice(1).map(decodeSegment)
    return rest.length ? rest.join('/') : null
  } catch {
    return null
  }
}

export function isConversationUrl(rawUrl: string): boolean {
  return conversationKeyFromUrl(rawUrl) !== null
}

export function conversationLabel(key: string): string {
  const id = key.split('/').filter(Boolean).pop() || key
  return `Chat ${id.slice(0, 12)}`
}

export function conversationListLocation(): MessengerLocation {
  return { url: MESSENGER_LIST_URL, key: null, isList: true }
}

export function locationFromUrl(rawUrl: string): MessengerLocation {
  if (!isMessengerContentUrl(rawUrl)) return { url: null, key: null, isList: false }
  const key = conversationKeyFromUrl(rawUrl)
  return { url: rawUrl, key, isList: key === null }
}

export function sanitizeConversationTabs(value: unknown): ConversationTab[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: ConversationTab[] = []

  for (const candidate of value) {
    if (result.length >= MAX_CONVERSATION_TABS) break
    if (!candidate || typeof candidate !== 'object') continue
    const item = candidate as Record<string, unknown>
    if (typeof item.url !== 'string' || typeof item.key !== 'string') continue
    const key = conversationKeyFromUrl(item.url)
    // Never trust a caller-supplied key; derive it from the validated URL.
    if (!key || key !== item.key) continue
    if (seen.has(key)) continue
    seen.add(key)

    const label = typeof item.label === 'string' && item.label.trim()
      ? item.label.trim().slice(0, 40)
      : conversationLabel(key)
    const id = typeof item.id === 'string' && item.id.trim()
      ? item.id.trim().slice(0, 64)
      : key

    result.push({ id, key, url: new URL(item.url).toString(), label, pinned: item.pinned === true })
  }

  return result.sort((a, b) => Number(b.pinned) - Number(a.pinned))
}
