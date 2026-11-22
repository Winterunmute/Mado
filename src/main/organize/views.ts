import type { ContentType, SourceType } from '../sources/model.js'

export interface CustomFeedView {
  id: string
  name: string
  categoryIds: string[]
  sourceIds: string[]
  contentTypes: ContentType[]
  typeFilter: SourceType | 'all'
}

const CONTENT_TYPES: ContentType[] = ['article', 'video', 'post', 'image', 'link']

function cleanString(value: unknown, max = 120): string | null {
  if (typeof value !== 'string') return null
  const text = [...value].filter(c => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127).join('').trim().slice(0, max)
  return text || null
}

export function sanitizeViewName(value: unknown): string | null {
  return cleanString(value, 50)
}

export function viewId(name: string): string {
  const slug = name.toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40)
  return `view:${slug || 'feed'}`
}

function stringList(value: unknown, max = 100): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const entry of value) {
    const text = cleanString(entry, max)
    if (text && !seen.has(text)) { seen.add(text); result.push(text) }
  }
  return result.slice(0, 100)
}

function contentTypes(value: unknown): ContentType[] {
  return stringList(value).filter((type): type is ContentType => CONTENT_TYPES.includes(type as ContentType))
}

function typeFilter(value: unknown): SourceType | 'all' {
  return value === 'rss' || value === 'youtube' || value === 'reddit' ? value : 'all'
}

export function normalizeViews(value: unknown): CustomFeedView[] {
  const raw = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as any).views)
      ? (value as any).views
      : []
  const seen = new Set<string>()
  const result: CustomFeedView[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const name = sanitizeViewName((entry as any).name)
    if (!name) continue
    const id = cleanString((entry as any).id, 100) || viewId(name)
    if (seen.has(id.toLowerCase())) continue
    seen.add(id.toLowerCase())
    result.push({
      id, name,
      categoryIds: stringList((entry as any).categoryIds),
      sourceIds: stringList((entry as any).sourceIds),
      contentTypes: contentTypes((entry as any).contentTypes),
      typeFilter: typeFilter((entry as any).typeFilter),
    })
  }
  return result
}
