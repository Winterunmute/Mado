import { extractDescription, fetchRawFeed, mediaUrl, type FeedItem } from '../rss.js'
import { sanitizeReaderContent } from '../reader-content.js'
import { contentId, sourceId, type ContentItem, type SourceSubscription } from './model.js'

const CHANNEL_ID = /^UC[\w-]{20,24}$/
const YOUTUBE_HOSTS = new Set(['www.youtube.com', 'youtube.com', 'm.youtube.com'])

export interface ResolvedYouTubeChannel {
  channelId: string
  feedUrl: string
  channelUrl: string
}

export function resolveYouTubeChannel(input: string): ResolvedYouTubeChannel {
  const raw = input.trim()
  const bare = raw.match(CHANNEL_ID)
  if (bare) return build(bare[0])

  try {
    const url = new URL(raw)
    if (!YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) throw new Error('Enter a YouTube channel URL or channel ID')
    if (url.hostname.toLowerCase().endsWith('youtube.com') && url.pathname === '/feeds/videos.xml') {
      const id = url.searchParams.get('channel_id') || ''
      if (CHANNEL_ID.test(id)) return build(id)
    }
    const match = url.pathname.match(/^\/(?:channel\/|embed\/)(UC[\w-]{20,24})/)
    if (match) return build(match[1])
    if (/^\/@[^/]+\/?$/.test(url.pathname)) {
      throw new Error('YouTube @handle URLs cannot be resolved reliably. Use the channel ID or /channel/UC... URL.')
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('@handle')) throw error
    throw new Error('Enter a YouTube channel ID or channel URL')
  }
  throw new Error('Enter a valid YouTube channel ID or channel URL')
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
  const channelId = source.metadata?.channelId || resolveYouTubeChannel(source.sourceUrl).channelId
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
