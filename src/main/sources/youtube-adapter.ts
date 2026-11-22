import { extractDescription, fetchRawFeed, mediaUrl, type FeedItem } from '../rss.js'
import { fetchArticleHtml } from '../reader.js'
import { sanitizeReaderContent } from '../reader-content.js'
import { contentId, sourceId, type ContentItem, type SourceSubscription } from './model.js'

const CHANNEL_ID = /^UC[\w-]{20,24}$/
const YOUTUBE_HOSTS = new Set(['www.youtube.com', 'youtube.com', 'm.youtube.com'])
const HANDLE = /^@?[A-Za-z0-9._-]{1,30}$/

type ParsedYouTube = { kind: 'id'; channelId: string } | { kind: 'handle'; handle: string }

export interface ResolvedYouTubeChannel {
  channelId: string
  feedUrl: string
  channelUrl: string
}

function parseYouTubeInput(input: string): ParsedYouTube | null {
  const raw = input.trim()
  if (CHANNEL_ID.test(raw)) return { kind: 'id', channelId: raw }
  if (raw.startsWith('@') && HANDLE.test(raw)) return { kind: 'handle', handle: raw.replace(/^@/, '') }

  try {
    const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    const url = new URL(candidate)
    if (!YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) return null
    if (url.pathname === '/feeds/videos.xml') {
      const id = url.searchParams.get('channel_id') || ''
      if (CHANNEL_ID.test(id)) return { kind: 'id', channelId: id }
      return null
    }
    const channel = url.pathname.match(/^\/(?:channel|embed)\/(UC[\w-]{20,24})(?:\/|$)/i)
    if (channel) return { kind: 'id', channelId: channel[1] }
    const handle = url.pathname.match(/^\/@([A-Za-z0-9._-]{1,30})\/?$/)
    if (handle) return { kind: 'handle', handle: handle[1] }
  } catch { /* handled by caller */ }
  return null
}

export function normalizeYouTubeInput(input: string): string | null {
  const parsed = parseYouTubeInput(input)
  if (!parsed) return null
  return parsed.kind === 'id' ? `https://www.youtube.com/channel/${parsed.channelId}` : `https://www.youtube.com/@${parsed.handle}`
}

export function extractYouTubeChannelId(html: string): string | null {
  const canonical = html.match(/<link[^>]+href=["']([^"']*youtube\.com\/channel\/(UC[\w-]{20,24})[^"']*)["'][^>]*>/i)
  if (canonical) return canonical[2]
  const embedded = html.match(/"(?:channelId|externalId)":"(UC[\w-]{20,24})"/)
  return embedded ? embedded[1] : null
}

export function resolveYouTubeChannel(input: string): ResolvedYouTubeChannel {
  const parsed = parseYouTubeInput(input)
  if (!parsed) throw new Error('Enter a YouTube channel ID, channel URL or @handle')
  if (parsed.kind === 'handle') {
    throw new Error('This YouTube handle needs a one-time channel lookup. Please retry.')
  }
  return build(parsed.channelId)
}

export async function resolveYouTubeChannelAsync(
  input: string,
  fetchPage: (url: string) => Promise<{ html: string }> = fetchArticleHtml,
): Promise<ResolvedYouTubeChannel> {
  const parsed = parseYouTubeInput(input)
  if (!parsed) throw new Error('Enter a valid YouTube channel ID, channel URL or @handle')
  if (parsed.kind === 'id') return build(parsed.channelId)
  try {
    const { html } = await fetchPage(`https://www.youtube.com/@${parsed.handle}`)
    const channelId = extractYouTubeChannelId(html)
    if (!channelId) throw new Error('not found')
    return build(channelId)
  } catch {
    throw new Error('Could not resolve this YouTube channel right now. Check the handle or try again later.')
  }
}

function build(channelId: string): ResolvedYouTubeChannel {
  return {
    channelId,
    feedUrl: `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
    channelUrl: `https://www.youtube.com/channel/${channelId}`,
  }
}

function thumbnail(item: FeedItem): string | null {
  const group = item.mediaGroup as Record<string, unknown> | undefined
  return mediaUrl(group?.['media:thumbnail'])
    || mediaUrl(group?.thumbnail)
    || mediaUrl(group?.['media:content'])
    || mediaUrl(item.mediaThumbnail)
    || mediaUrl(item.mediaContent)
}

export async function fetchYouTubeChannel(source: SourceSubscription): Promise<ContentItem[]> {
  const feed = await fetchRawFeed(source.url)
  const channelId = source.metadata?.channelId || (await resolveYouTubeChannelAsync(source.sourceUrl)).channelId
  return feed.items.map((item): ContentItem => {
    const videoId = item.videoId || (item.link.match(/[?&]v=([\w-]{11})/) || [])[1] || contentId(source, item.link).split(':').pop() || ''
    return {
      id: contentId(source, item.link),
      sourceId: source.id,
      sourceType: 'youtube',
      sourceName: source.title,
      title: item.title || 'Untitled video',
      link: item.link || `https://www.youtube.com/watch?v=${videoId}`,
      pubDate: item.isoDate || item.pubDate || new Date().toISOString(),
      description: extractDescription(item),
      contentHtml: sanitizeReaderContent(item['content:encoded'] || item.content || '', item.link || source.url),
      thumbnail: thumbnail(item),
      contentType: 'video',
      author: item.creator || source.title,
      metadata: { videoId, channelId },
      feedUrl: source.url,
      feedTitle: source.title,
      isRead: false,
    }
  }).filter(item => item.link)
}
