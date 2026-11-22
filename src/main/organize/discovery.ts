import { DOMParser } from 'linkedom'
import { lookup } from 'node:dns'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { isPublicAddress, publicWebUrl } from '../reader-content.js'
import { resolveYouTubeChannel } from '../sources/youtube-adapter.js'
import { resolveRedditCommunity } from '../sources/reddit-adapter.js'

export type DiscoveredKind = 'rss' | 'youtube' | 'reddit'

export interface DiscoveredSource {
  kind: DiscoveredKind
  url: string
  title: string
}

export interface DiscoveryResult {
  sources: DiscoveredSource[]
  message: string
}

const FEED_TYPES = /^(application\/(?:rss\+xml|atom\+xml|xml)|text\/xml|application\/xml)/i

export function parseFeedLinks(html: string, baseUrl: string): DiscoveredSource[] {
  const document = new DOMParser().parseFromString(html.slice(0, 1_000_000), 'text/html')
  const found: DiscoveredSource[] = []
  const seen = new Set<string>()
  for (const link of Array.from(document.querySelectorAll('link[rel]')) as any[]) {
    const rel = (link.getAttribute('rel') || '').toLowerCase().split(/\s+/)
    if (!rel.includes('alternate')) continue
    const type = (link.getAttribute('type') || '').toLowerCase()
    if (!FEED_TYPES.test(type)) continue
    const url = publicWebUrl(link.getAttribute('href') || '', baseUrl)
    if (!url || seen.has(url)) continue
    seen.add(url)
    found.push({ kind: 'rss', url, title: (link.getAttribute('title') || 'RSS feed').slice(0, 200) })
  }
  return found
}

export function classifyDiscoveryInput(input: string): DiscoveredSource | null {
  try {
    const channel = resolveYouTubeChannel(input)
    return { kind: 'youtube', url: channel.channelUrl, title: channel.channelId }
  } catch { /* not a YouTube input */ }
  try {
    const community = resolveRedditCommunity(input)
    return { kind: 'reddit', url: community.communityUrl, title: community.name }
  } catch { /* not a Reddit input */ }
  return null
}

function feedTitle(xml: string, fallback: string): string {
  try {
    const document = new DOMParser().parseFromString(xml.slice(0, 100_000), 'text/xml')
    return (document.querySelector('title')?.textContent || '').trim().slice(0, 200) || fallback
  } catch { return fallback }
}

async function fetchPage(rawUrl: string): Promise<{ body: string; url: string; contentType: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  try {
    let current = publicWebUrl(rawUrl)
    if (!current) throw new Error('Enter a public HTTP(S) website URL')
    for (let redirect = 0; redirect <= 3; redirect++) {
      const url = new URL(current)
      const result = await new Promise<{ body?: string; location?: string; contentType: string }>((resolve, reject) => {
        const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mado/0.7 Feed Discovery',
            Accept: 'text/html, application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
            'Accept-Encoding': 'identity',
          },
          lookup: (host: string, options: any, callback: Function) => {
            lookup(host, { all: true }, (error, addresses) => {
              if (error) { callback(error, '', 4); return }
              if (!addresses.length || addresses.some(address => !isPublicAddress(address.address))) {
                callback(new Error('Local and private network addresses are not allowed.'), '', 4)
                return
              }
              if (options?.all) callback(null, addresses)
              else callback(null, addresses[0].address, addresses[0].family)
            })
          },
        }, response => {
          const status = response.statusCode || 0
          const location = response.headers.location
          if ([301, 302, 303, 307, 308].includes(status) && location) {
            response.destroy(); resolve({ location, contentType: '' }); return
          }
          if (status < 200 || status >= 300) { response.destroy(); reject(new Error(`Website returned HTTP ${status}.`)); return }
          const contentType = String(response.headers['content-type'] || '')
          const chunks: Buffer[] = []
          let size = 0
          response.on('data', chunk => {
            size += chunk.length
            if (size > 1_500_000) { response.destroy(new Error('Page exceeds the discovery size limit.')); return }
            chunks.push(Buffer.from(chunk))
          })
          response.on('end', () => resolve({ body: Buffer.concat(chunks).toString('utf8'), contentType }))
          response.on('error', reject)
        })
        request.on('error', reject)
        request.end()
      })
      if (result.body !== undefined) return { body: result.body, url: current, contentType: result.contentType }
      current = publicWebUrl(result.location!, current)
      if (!current) throw new Error('The website redirected to an unsupported address.')
    }
    throw new Error('The website redirected too many times.')
  } finally { clearTimeout(timer) }
}

export async function discoverSources(input: string): Promise<DiscoveryResult> {
  const raw = input.trim()
  if (!raw) return { sources: [], message: 'Enter a website, feed URL, YouTube channel or Reddit community.' }
  const platform = classifyDiscoveryInput(raw)
  if (platform) return { sources: [platform], message: `Detected a ${platform.kind === 'rss' ? 'feed' : platform.kind} source.` }
  const validUrl = publicWebUrl(raw)
  if (!validUrl) return { sources: [], message: 'Enter a public HTTP(S) URL, YouTube channel or Reddit community.' }
  try {
    const page = await fetchPage(validUrl)
    if (FEED_TYPES.test(page.contentType)) {
      return {
        sources: [{ kind: 'rss', url: page.url, title: feedTitle(page.body, new URL(page.url).hostname) }],
        message: 'This URL is a direct RSS/Atom feed.',
      }
    }
    const sources = parseFeedLinks(page.body, page.url)
    return sources.length
      ? { sources, message: `${sources.length} feed${sources.length === 1 ? '' : 's'} found on this website.` }
      : { sources: [], message: 'No RSS or Atom feed was advertised by this website. You can still enter a feed URL manually.' }
  } catch (error) {
    return { sources: [], message: error instanceof Error ? error.message : 'Could not inspect this website.' }
  }
}
