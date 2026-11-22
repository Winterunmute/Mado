import { Readability } from '@mozilla/readability'
import { DOMParser } from 'linkedom'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { lookup } from 'node:dns'
import { isPublicAddress, publicWebUrl, sanitizeReaderContent } from './reader-content.js'

export interface ReaderResult {
  title: string
  html: string
  byline: string | null
  url: string
  mode: 'extracted' | 'feed'
  notice: string | null
}

interface ReaderSource { title: string; link: string; description: string; contentHtml?: string }

// No browser, credentials, cookies, scripts or subresource fetching. DNS is checked
// in the request's lookup callback, so redirects and private-address rebinding fail closed.
export async function fetchArticleHtml(rawUrl: string): Promise<{ html: string; url: string }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)
  try {
    let current = publicWebUrl(rawUrl)
    if (!current) throw new Error('This article URL is not a public HTTP(S) page.')
    for (let redirect = 0; redirect <= 4; redirect++) {
      const url = new URL(current)
      const result = await new Promise<{ html?: string; redirect?: string }>((resolve, reject) => {
        const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mado/0.3 ArticleReader', Accept: 'text/html, application/xhtml+xml', 'Accept-Encoding': 'identity' },
          lookup: (host, options, callback) => {
            lookup(host, { all: true }, (error, addresses) => {
              if (error) { callback(error, '', 4); return }
              if (!addresses.length || addresses.some(a => !isPublicAddress(a.address))) {
                callback(new Error('Local and private network addresses are not allowed.'), '', 4); return
              }
              if ((options as { all?: boolean }).all) (callback as Function)(null, addresses)
              else callback(null, addresses[0].address, addresses[0].family)
            })
          },
        }, response => {
          const status = response.statusCode || 0
          if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) {
            response.destroy(); resolve({ redirect: response.headers.location }); return
          }
          if (status < 200 || status >= 300) { response.destroy(); reject(new Error(`Publisher returned HTTP ${status}.`)); return }
          if (!/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(response.headers['content-type'] || '')) {
            response.destroy(); reject(new Error('The publisher did not return an HTML article.')); return
          }
          const chunks: Buffer[] = []
          let size = 0
          response.on('data', chunk => {
            size += chunk.length
            if (size > 2_000_000) { response.destroy(new Error('Article exceeds the reader size limit.')); return }
            chunks.push(Buffer.from(chunk))
          })
          response.on('end', () => resolve({ html: Buffer.concat(chunks).toString('utf8') }))
          response.on('error', reject)
        })
        request.on('error', reject)
        request.end()
      })
      if (result.html !== undefined) return { html: result.html, url: current }
      current = publicWebUrl(result.redirect!, current)
      if (!current) throw new Error('The publisher redirected to an unsupported address.')
    }
    throw new Error('The publisher redirected too many times.')
  } finally { clearTimeout(timeout) }
}

export function extractArticle(html: string, url: string): Omit<ReaderResult, 'mode' | 'notice'> | null {
  // LinkeDOM parses an inert DOM: it does not run scripts or load remote resources.
  const document = new DOMParser().parseFromString(html, 'text/html')
  Object.defineProperty(document, 'documentURI', { value: url })
  Object.defineProperty(document, 'baseURI', { value: url })
  // Respect explicit publisher restrictions and hidden content. Never remove a
  // paywall overlay to reveal the content behind it.
  for (const metadata of document.querySelectorAll('script[type="application/ld+json"]')) {
    if (/"isAccessibleForFree"\s*:\s*(?:false|"false")/i.test(metadata.textContent || '')) return null
  }
  if (document.querySelector('[class*="paywall"], [id*="paywall"], [data-paywall], [class*="subscription-wall"]')) return null
  for (const node of document.querySelectorAll('[hidden], [aria-hidden="true"], [style]')) {
    if (node.hasAttribute('hidden') || node.getAttribute('aria-hidden') === 'true' || /(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(node.getAttribute('style') || '')) node.remove()
  }
  const parsed = new Readability(document as unknown as Document, { maxElemsToParse: 15_000, charThreshold: 300, disableJSONLD: true }).parse()
  if (!parsed?.content || (parsed.textContent?.trim().length || 0) < 200) return null
  const content = sanitizeReaderContent(parsed.content, url)
  if (!content.trim()) return null
  return { title: parsed.title?.trim() || '', html: content, byline: parsed.byline || null, url }
}

export async function readArticle(source: ReaderSource): Promise<ReaderResult> {
  try {
    const downloaded = await fetchArticleHtml(source.link)
    const extracted = extractArticle(downloaded.html, downloaded.url)
    if (extracted) return { ...extracted, title: extracted.title || source.title, mode: 'extracted', notice: null }
  } catch { /* Expected for offline, blocked, private, non-HTML or restricted pages. */ }
  const fallback = source.contentHtml || `<p>${escapeText(source.description || 'No article text was included in this feed.')}</p>`
  return {
    title: source.title, html: sanitizeReaderContent(fallback, source.link), url: source.link, byline: null, mode: 'feed',
    notice: 'The full article is unavailable in Mado. Showing the content supplied by this RSS feed. Open the original in your browser for more.',
  }
}

function escapeText(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
}
