export type SourceType = 'rss' | 'youtube' | 'reddit'
export type ContentType = 'article' | 'video' | 'post' | 'image' | 'link'

export interface SourceSubscription {
  id: string
  type: SourceType
  url: string
  sourceUrl: string
  title: string
  enabled: boolean
  lastFetched: string | null
  lastError: string | null
  metadata?: Record<string, string>
}

export interface ContentItem {
  id: string
  sourceId: string
  sourceType: SourceType
  sourceName: string
  title: string
  link: string
  pubDate: string
  description: string
  contentHtml: string
  thumbnail: string | null
  contentType: ContentType
  author: string | null
  metadata: Record<string, string>
  feedUrl: string
  feedTitle: string
  isRead: boolean
}

export const SOURCE_TYPES: SourceType[] = ['rss', 'youtube', 'reddit']

export function sourceId(type: SourceType, input: string): string {
  return `${type}:${input.trim().toLowerCase()}`
}

export function contentId(source: SourceSubscription, link: string): string {
  return `${source.id}:${link}`
}

function isSourceType(value: unknown): value is SourceType {
  return typeof value === 'string' && SOURCE_TYPES.includes(value as SourceType)
}

function sourceHost(url: string): string {
  try { return new URL(url).hostname } catch { return url }
}

// V0.6 accepts the legacy array and the old { feeds: [...] } shape, assigns
// stable ids/types, and always writes a versioned object afterwards.
export function normalizeSources(value: unknown, defaults: SourceSubscription[]): SourceSubscription[] {
  const raw = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as any).feeds)
      ? (value as any).feeds
      : defaults

  const seen = new Set<string>()
  const result: SourceSubscription[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const item = entry as Record<string, any>
    if (typeof item.url !== 'string' || !item.url.trim()) continue
    const type = isSourceType(item.type) ? item.type : 'rss'
    const url = item.url.trim()
    const id = typeof item.id === 'string' && item.id.trim() ? item.id : sourceId(type, url)
    if (seen.has(id)) continue
    seen.add(id)
    result.push({
      id,
      type,
      url,
      sourceUrl: typeof item.sourceUrl === 'string' && item.sourceUrl ? item.sourceUrl : url,
      title: typeof item.title === 'string' && item.title ? item.title : sourceHost(url),
      enabled: item.enabled !== false,
      lastFetched: typeof item.lastFetched === 'string' ? item.lastFetched : null,
      lastError: typeof item.lastError === 'string' ? item.lastError : null,
      ...(item.metadata && typeof item.metadata === 'object'
        ? { metadata: Object.fromEntries(Object.entries(item.metadata).filter(([key, value]) => typeof key === 'string' && typeof value === 'string')) as Record<string, string> }
        : {}),
    })
  }
  return result
}

export function isReadInState(state: Record<string, boolean>, item: ContentItem): boolean {
  return state[item.id] === true || state[item.link] === true
}

export function dedupeContent(items: ContentItem[]): ContentItem[] {
  const seen = new Set<string>()
  return items.filter(item => {
    if (!item.link || seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}
