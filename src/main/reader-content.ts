import sanitizeHtml from 'sanitize-html'
import { isIP } from 'node:net'

export function isPublicAddress(address: string): boolean {
  const ip = address.toLowerCase().replace(/^\[|\]$/g, '')
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number)
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0)) || (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19)))
  }
  // Only globally routed IPv6 unicast, excluding mapped IPv4 and documentation ranges.
  return isIP(ip) === 6 && /^[23]/.test(ip) && !ip.startsWith('2001:db8:')
}

export function publicWebUrl(value: string, base?: string): string | null {
  if (!value.trim()) return null
  try {
    const url = new URL(value, base)
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null
    if (isIP(host) ? !isPublicAddress(host) : (!host.includes('.') || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(host))) return null
    return url.toString()
  } catch { return null }
}

export function sanitizeReaderContent(html: string, base: string): string {
  return sanitizeHtml(html.slice(0, 2_000_000), {
    allowedTags: ['p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's', 'blockquote', 'ul', 'ol', 'li', 'pre', 'code', 'a', 'img', 'figure', 'figcaption', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'sup', 'sub'],
    allowedAttributes: { a: ['href', 'rel'], img: ['src', 'alt', 'title', 'loading', 'decoding', 'referrerpolicy'] },
    allowedSchemes: ['https', 'http'],
    allowProtocolRelative: false,
    nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript', 'template', 'svg', 'math', 'iframe', 'video', 'audio', 'object', 'embed', 'form'],
    transformTags: {
      a: (_tag, attrs) => ({ tagName: 'a', attribs: { ...(publicWebUrl(attrs.href || '', base) ? { href: publicWebUrl(attrs.href || '', base)! } : {}), rel: 'noopener noreferrer' } }),
      img: (_tag, attrs) => ({ tagName: 'img', attribs: {
        src: publicWebUrl(attrs.src || '', base) || '', alt: (attrs.alt || '').slice(0, 1000),
        ...(attrs.title ? { title: attrs.title.slice(0, 1000) } : {}),
        loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer',
      } }),
    },
    exclusiveFilter: frame => frame.tag === 'img' && !frame.attribs.src,
  })
}
