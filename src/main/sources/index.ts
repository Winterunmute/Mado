import { fetchRssSource } from './rss-adapter.js'
import { fetchYouTubeChannel } from './youtube-adapter.js'
import { fetchRedditCommunity } from './reddit-adapter.js'
import type { ContentItem, SourceSubscription, SourceType } from './model.js'

const MIN_INTERVAL_MS: Record<SourceType, number> = {
  rss: 60_000,
  youtube: 300_000,
  reddit: 300_000,
}

const cache = new Map<string, { items: ContentItem[]; at: number }>()

export async function fetchSource(source: SourceSubscription, force = false): Promise<ContentItem[]> {
  const cached = cache.get(source.id)
  if (!force && cached && Date.now() - cached.at < MIN_INTERVAL_MS[source.type]) return cached.items
  try {
    const items = source.type === 'youtube'
      ? await fetchYouTubeChannel(source)
      : source.type === 'reddit'
        ? await fetchRedditCommunity(source)
        : await fetchRssSource(source)
    cache.set(source.id, { items, at: Date.now() })
    return items
  } catch (error) {
    // The bulk orchestrator serves cached items together with the error so the
    // UI can show stale content and a meaningful per-source failure at once.
    throw error
  }
}

export function clearSourceCache(id?: string): void {
  if (id) cache.delete(id)
  else cache.clear()
}

export interface SourceFetchResult {
  items: ContentItem[]
  error: string | null
}

export async function fetchSourcesConcurrently(sources: SourceSubscription[], force = false): Promise<Map<string, SourceFetchResult>> {
  const results = new Map<string, SourceFetchResult>()
  let active = 0
  let index = 0
  await new Promise<void>(resolve => {
    const next = () => {
      while (active < 4 && index < sources.length) {
        const source = sources[index++]
        active += 1
        void fetchSource(source, force)
          .then(items => results.set(source.id, { items, error: null }))
          .catch(error => {
            const message = error instanceof Error ? error.message : 'Could not refresh this source'
            console.error(`[Sources] ${source.title}:`, message)
            results.set(source.id, { items: cache.get(source.id)?.items || [], error: message })
          })
          .finally(() => { active -= 1; if (active === 0 && index >= sources.length) resolve(); else next() })
      }
      if (active === 0 && index >= sources.length) resolve()
    }
    next()
  })
  return results
}
