import { DOMParser } from 'linkedom'
import sanitizeHtml from 'sanitize-html'
import { fetchRedditFeed, type FeedItem } from '../rss.js'
import { sanitizeReaderContent } from '../reader-content.js'
import { contentId, sourceId, type ContentItem, type SourceSubscription } from './model.js'

const NAME = /^[A-Za-z0-9_]{1,21}$/
const REDDIT_HOSTS = new Set(['www.reddit.com', 'reddit.com', 'old.reddit.com'])

export interface ResolvedRedditCommunity {
  name: string
  feedUrl: string
  communityUrl: string
}

export function resolveRedditCommunity(input: string): ResolvedRedditCommunity {
  const raw = input.trim().replace(/^\/?r\//i, '')
  if (NAME.test(raw)) return build(raw)
  try {
    const url = new URL(raw)
    if (!REDDIT_HOSTS.has(url.hostname.toLowerCase())) throw new Error('Enter a Reddit community name or URL')
    const match = url.pathname.match(/^\/r\/([A-Za-z0-9_]{1,21})(?:\/|$)/i)
    if (match) return build(match[1])
  } catch { /* handled below */ }
  throw new Error('Enter a subreddit name (for example: technology) or a reddit.com/r/... URL')
}

function build(name: string): ResolvedRedditCommunity {
  return {
    name,
    feedUrl: `https://www.reddit.com/r/${name}/new/.rss`,
    communityUrl: `https://www.reddit.com/r/${name}/`,
  }
}

function excerpt(item: FeedItem): string {
  const raw = item['content:encoded'] || item.content || ''
  const safe = sanitizeHtml(raw, { allowedTags: ['p', 'br', 'a', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre'], allowedAttributes: {}, allowedSchemes: ['http', 'https'] })
  const text = new DOMParser().parseFromString(`<body>${safe}</body>`, 'text/html').body.textContent?.replace(/\s+/g, ' ').trim() || ''
  return text.length > 300 ? `${text.slice(0, 300)}…` : text
}

function preview(item: FeedItem): string | null {
  const html = item['content:encoded'] || item.content || ''
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i)
  return match ? match[1] : null
}

export async function fetchRedditCommunity(source: SourceSubscription): Promise<ContentItem[]> {
  const feed = await fetchRedditFeed(source.url)
  return feed.items.map((item): ContentItem => {
    const author = item.creator || ''
    const text = excerpt(item)
    const href = item.link || ''
    const image = preview(item)
    const contentType = image ? 'image' : /^https?:\/\//i.test(text) && text.length < 160 ? 'link' : 'post'
    return {
      id: contentId(source, href || item.title),
      sourceId: source.id,
      sourceType: 'reddit',
      sourceName: source.title,
      title: item.title || 'Untitled post',
      link: href,
      pubDate: item.isoDate || item.pubDate || new Date().toISOString(),
      description: text,
      contentHtml: sanitizeReaderContent(item['content:encoded'] || item.content || '', href || source.url),
      thumbnail: image,
      contentType,
      author,
      metadata: { community: source.metadata?.community || source.title, author },
      feedUrl: source.url,
      feedTitle: source.title,
      isRead: false,
    }
  }).filter(item => item.link)
}
