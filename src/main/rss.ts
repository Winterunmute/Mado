import Parser from 'rss-parser'
import sanitizeHtml from 'sanitize-html'
import { sanitizeReaderContent } from './reader-content.js'
import { DOMParser } from 'linkedom'

const parser = new Parser({
  timeout: 15000,
  customFields: {
    item: [
      ['media:group', 'mediaGroup'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['media:content', 'mediaContent'],
      ['yt:videoId', 'videoId'],
      ['dc:creator', 'creator'],
    ],
  },
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Mado/0.1',
    'Accept': 'application/rss+xml, application/xml, application/atom+xml, text/xml, */*',
  },
})

export interface FeedItem {
  title: string
  link: string
  pubDate: string
  contentSnippet?: string
  content?: string
  'content:encoded'?: string
  isoDate?: string
  enclosure?: { url: string; type: string }
  'media:thumbnail'?: { url: string }
  'media:content'?: { url: string }
  mediaThumbnail?: { url: string }
  mediaContent?: { url: string }
  mediaGroup?: { 'media:thumbnail'?: { url: string }; thumbnail?: { url: string } }
  videoId?: string
  creator?: string
}

interface ParsedFeed {
  title: string
  items: FeedItem[]
}

function sanitizeContent(content: string): string {
  return sanitizeHtml(content, {
    allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br', 'a', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre'],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      '*': ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesAppliedToAttributes: ['href'],
    selfClosing: ['br', 'img', 'hr'],
  })
}

export function mediaUrl(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return mediaUrl(value[0])
  if (!value || typeof value !== 'object') return null
  const entry = value as Record<string, any>
  if (typeof entry.url === 'string') return entry.url
  if (entry.$ && typeof entry.$.url === 'string') return entry.$.url
  return null
}

export function extractThumbnail(item: FeedItem): string | null {
  if (item.enclosure?.type?.startsWith('image/')) {
    const url = mediaUrl(item.enclosure)
    if (url) return url
  }
  const mediaThumbnail = mediaUrl(item['media:thumbnail']) || mediaUrl(item.mediaThumbnail)
  if (mediaThumbnail) return mediaThumbnail
  const mediaContent = mediaUrl(item['media:content']) || mediaUrl(item.mediaContent)
  if (mediaContent) return mediaContent
  const content = item['content:encoded'] || item.content
  if (content) {
    const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i)
    if (imgMatch) return imgMatch[1]
  }
  return null
}

export function extractDescription(item: FeedItem): string {
  const raw = item.contentSnippet || item['content:encoded'] || item.content || ''
  const sanitized = sanitizeContent(raw)
  const textOnly = new DOMParser().parseFromString(`<html><body>${sanitized.replace(/<\/(?:p|li|div)>|<br\s*\/?>/gi, ' ')}</body></html>`, 'text/html').body.textContent.replace(/\s+/g, ' ').trim()
  return textOnly.length > 300 ? textOnly.slice(0, 300) + '…' : textOnly
}

export async function fetchFeed(url: string): Promise<any[]> {
  try {
    const feed = await parser.parseURL(url) as ParsedFeed
    const items = feed.items || []
    
    return items.map(item => ({
      title: item.title || 'Untitled',
      link: item.link || '',
      pubDate: item.isoDate || item.pubDate || new Date().toISOString(),
      description: extractDescription(item),
      contentHtml: sanitizeReaderContent(item['content:encoded'] || item.content || '', item.link || url),
      thumbnail: extractThumbnail(item),
      feedTitle: feed.title || new URL(url).hostname,
    })).filter(item => item.link)
  } catch (error) {
    console.error(`Failed to fetch feed ${url}:`, error)
    throw error
  }
}

export async function fetchRawFeed(url: string): Promise<ParsedFeed> {
  return parser.parseURL(url) as Promise<ParsedFeed>
}

const redditParser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mado/0.6 (personal desktop feed reader)',
    Accept: 'application/atom+xml, application/rss+xml, text/xml, */*',
  },
})

export async function fetchRedditFeed(url: string): Promise<ParsedFeed> {
  return redditParser.parseURL(url) as Promise<ParsedFeed>
}

export async function fetchAllFeeds(urls: string[]): Promise<any[]> {
  const results = await Promise.allSettled(urls.map(url => fetchFeed(url)))
  const articles: any[] = []
  
  for (const result of results) {
    if (result.status === 'fulfilled') {
      articles.push(...result.value)
    }
  }
  
  return articles.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
}
