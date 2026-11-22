export interface Category {
  id: string
  name: string
}

export function sanitizeCategoryName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const cleaned = [...value]
    .filter(character => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)
    .join('')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 40)
  return cleaned || null
}

export function categoryId(name: string): string {
  const slug = name.toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40)
  return `cat:${slug || 'category'}`
}

export function normalizeCategories(value: unknown): Category[] {
  const raw = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as any).categories)
      ? (value as any).categories
      : []
  const seen = new Set<string>()
  const result: Category[] = []
  for (const entry of raw) {
    const name = sanitizeCategoryName(entry && typeof entry === 'object' ? (entry as any).name : entry)
    if (!name) continue
    const id = (entry && typeof entry === 'object' && typeof (entry as any).id === 'string' && (entry as any).id.trim())
      ? (entry as any).id.trim()
      : categoryId(name)
    const key = id.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push({ id, name })
  }
  return result
}

export function categoryNameMap(categories: Category[]): Record<string, string> {
  return Object.fromEntries(categories.map(category => [category.id, category.name]))
}
