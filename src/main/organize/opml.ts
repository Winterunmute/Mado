import { DOMParser } from 'linkedom'
import { publicWebUrl } from '../reader-content.js'

export interface OpmlFeedEntry {
  url: string
  title: string
  categories: string[]
}

export interface OpmlSkippedEntry {
  title: string
  url: string
  reason: string
}

export interface OpmlImportResult {
  entries: OpmlFeedEntry[]
  duplicates: OpmlSkippedEntry[]
  invalid: OpmlSkippedEntry[]
}

function attribute(node: any, name: string): string {
  return (node.getAttribute?.(name) || '').trim()
}

function nativeFeedUrl(url: string): boolean {
  return /youtube\.com\/feeds\/videos\.xml|reddit\.com\/r\//i.test(url)
}

export function parseOpml(xml: string, existingUrls: string[] = []): OpmlImportResult {
  const result: OpmlImportResult = { entries: [], duplicates: [], invalid: [] }
  const known = new Set(existingUrls.map(url => url.trim().toLowerCase()))
  const document = new DOMParser().parseFromString(xml.slice(0, 2_000_000), 'text/xml')
  if (document.querySelector('parsererror')) throw new Error('The OPML file is not valid XML.')
  const root = document.querySelector('opml > body') || document.querySelector('body')
  if (!root) throw new Error('The OPML file has no body section.')

  const walk = (node: any, folders: string[]) => {
    for (const child of Array.from(node.children || []) as any[]) {
      if (child.tagName?.toLowerCase() !== 'outline') continue
      const title = attribute(child, 'title') || attribute(child, 'text') || 'Untitled feed'
      const rawUrl = attribute(child, 'xmlUrl') || attribute(child, 'xmlurl')
      const folderName = title && !rawUrl ? title : ''
      const nextFolders = folderName ? [...folders, folderName] : folders
      if (!rawUrl) { walk(child, nextFolders); continue }
      const url = publicWebUrl(rawUrl)
      const inlineCategories = attribute(child, 'category').split(',').map(value => value.trim()).filter(Boolean)
      const entry = {
        title: title.slice(0, 200),
        url: url || rawUrl.slice(0, 500),
        categories: [...nextFolders, ...inlineCategories].slice(0, 10),
      }
      if (!url) { result.invalid.push({ ...entry, reason: 'Not a valid public HTTP(S) URL' }); continue }
      if (nativeFeedUrl(url)) { result.invalid.push({ ...entry, reason: 'Native YouTube/Reddit sources must be added from Sources' }); continue }
      const key = url.toLowerCase()
      if (known.has(key)) { result.duplicates.push({ ...entry, reason: 'Already subscribed' }); continue }
      known.add(key)
      result.entries.push(entry)
    }
  }
  walk(root, [])
  return result
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]!))
}

export interface OpmlExportFeed {
  url: string
  title: string
  categories: string[]
}

export function buildOpml(feeds: OpmlExportFeed[]): string {
  const outline = (feed: OpmlExportFeed) => {
    const category = feed.categories.length ? ` category="${escapeXml(feed.categories.join(','))}"` : ''
    return `    <outline type="rss" text="${escapeXml(feed.title)}" title="${escapeXml(feed.title)}" xmlUrl="${escapeXml(feed.url)}"${category} />`
  }
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    '  <head><title>Mado subscriptions</title></head>',
    '  <body>',
    ...feeds.map(outline),
    '  </body>',
    '</opml>',
  ].join('\n')
}
