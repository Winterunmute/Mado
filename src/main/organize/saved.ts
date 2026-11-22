import type { ContentItem, ContentType, SourceType } from '../sources/model.js'

export interface SavedItem {
  id: string
  link: string
  title: string
  description: string
  contentHtml: string
  thumbnail: string | null
  pubDate: string
  sourceId: string
  sourceType: SourceType
  sourceName: string
  contentType: ContentType
  author: string | null
  metadata: Record<string, string>
  feedUrl: string
  feedTitle: string
  savedAt: string
}

const TYPES: SourceType[] = ['rss', 'youtube', 'reddit']
const CONTENT: ContentType[] = ['article', 'video', 'post', 'image', 'link']
const CONTROL_CHARS = new RegExp(
  '[' + Array.from({ length: 32 }, (_, index) => String.fromCharCode(index))
    .filter(character => character !== '\n' && character !== '\t').join('') + String.fromCharCode(127) + ']',
  'g',
)

function text(value: unknown, max = 4000): string {
  if (typeof value !== 'string') return ''
  return value.replace(CONTROL_CHARS, '').slice(0, max)
}

function optional(value: unknown, max = 500): string | null {
  const result = text(value, max).trim()
  return result || null
}

export function savedKey(item: Pick<SavedItem, 'id' | 'link'>): string {
  return item.id || item.link
}

function cleanMetadata(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, 20)
      .filter(([key, entry]) => key.length <= 50 && typeof entry === 'string' && entry.length <= 500),
  ) as Record<string, string>
}

export function normalizeSavedItem(value: unknown): SavedItem | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const link = optional(raw.link, 2000)
  const id = optional(raw.id, 2000) || link
  if (!id || !link) return null
  const sourceType = TYPES.includes(raw.sourceType as SourceType) ? raw.sourceType as SourceType : 'rss'
  const contentType = CONTENT.includes(raw.contentType as ContentType) ? raw.contentType as ContentType : 'article'
  return {
    id, link,
    title: text(raw.title, 500) || 'Untitled item',
    description: text(raw.description, 1000),
    contentHtml: text(raw.contentHtml, 200_000),
    thumbnail: optional(raw.thumbnail, 2000),
    pubDate: text(raw.pubDate, 50) || new Date().toISOString(),
    sourceId: text(raw.sourceId, 500) || sourceType,
    sourceType,
    sourceName: text(raw.sourceName, 200) || text(raw.feedTitle, 200) || 'Saved source',
    contentType,
    author: optional(raw.author, 200),
    metadata: cleanMetadata(raw.metadata),
    feedUrl: text(raw.feedUrl, 2000) || link,
    feedTitle: text(raw.feedTitle, 200) || 'Saved source',
    savedAt: text(raw.savedAt, 50) || new Date().toISOString(),
  }
}

export function normalizeSavedMap(value: unknown): Record<string, SavedItem> {
  const source = value && typeof value === 'object' && (value as any).items && typeof (value as any).items === 'object'
    ? (value as any).items
    : value
  const entries = source && typeof source === 'object' ? Object.values(source as Record<string, unknown>) : []
  const result: Record<string, SavedItem> = {}
  for (const entry of entries) {
    const item = normalizeSavedItem(entry)
    if (item) result[savedKey(item)] = item
  }
  return result
}

export function toSavedItem(item: ContentItem): SavedItem | null {
  return normalizeSavedItem({ ...item, savedAt: new Date().toISOString() })
}
