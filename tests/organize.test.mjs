import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeCategories, categoryId, sanitizeCategoryName } from '../dist/main/organize/categories.js'
import { normalizeViews } from '../dist/main/organize/views.js'
import { normalizeSavedItem, normalizeSavedMap, savedKey, toSavedItem } from '../dist/main/organize/saved.js'
import { parseOpml, buildOpml } from '../dist/main/organize/opml.js'
import { parseFeedLinks, classifyDiscoveryInput } from '../dist/main/organize/discovery.js'

test('categories normalize, dedupe and reject empty names', () => {
  const categories = normalizeCategories({ version: 1, categories: [
    { id: 'cat:gaming', name: 'Gaming' },
    { name: 'Gaming' },
    { name: '  Science   News  ' },
    { name: '   ' },
  ] })
  assert.deepEqual(categories.map(category => category.name), ['Gaming', 'Science News'])
  assert.equal(categories[1].id, categoryId('Science News'))
  assert.equal(sanitizeCategoryName('A'.repeat(100)).length, 40)
})

test('custom views normalize category, source, type and content filters', () => {
  const views = normalizeViews({ version: 1, views: [{
    id: 'view:tech', name: 'Tech', categoryIds: ['cat:tech', 'cat:tech'],
    sourceIds: ['rss:a'], contentTypes: ['video', 'bad'], typeFilter: 'rss',
  }] })
  assert.equal(views.length, 1)
  assert.deepEqual(views[0].categoryIds, ['cat:tech'])
  assert.deepEqual(views[0].contentTypes, ['video'])
  assert.equal(views[0].typeFilter, 'rss')
})

test('saved snapshots keep metadata and ignore read status', () => {
  const item = {
    id: 'youtube:feed:video', link: 'https://www.youtube.com/watch?v=abcdefghijk', title: 'Video',
    description: 'A saved video', contentHtml: '<p>Saved text</p>', thumbnail: 'https://i.ytimg.com/a.jpg',
    pubDate: '2026-11-21T10:00:00Z', sourceId: 'youtube:feed', sourceType: 'youtube', sourceName: 'Channel',
    contentType: 'video', author: 'Creator', metadata: { videoId: 'abcdefghijk' }, feedUrl: 'https://www.youtube.com/feed',
    feedTitle: 'Channel', isRead: true,
  }
  const saved = toSavedItem(item)
  assert.ok(saved)
  assert.equal(savedKey(saved), item.id)
  assert.equal(saved.contentType, 'video')
  assert.equal(saved.metadata.videoId, 'abcdefghijk')
  assert.equal(saved.savedAt.length > 0, true)
  const map = normalizeSavedMap({ version: 1, items: { [item.id]: saved } })
  assert.equal(Object.keys(map).length, 1)
  assert.equal(normalizeSavedItem(null), null)
})

test('OPML import recognizes folders, validates URLs and detects duplicates', () => {
  const xml = `<?xml version="1.0"?><opml version="2.0"><head/><body>
    <outline text="Technology"><outline text="Verge" title="The Verge" type="rss" xmlUrl="https://example.com/feed.xml" category="News,Tech"/></outline>
    <outline text="Dup" xmlUrl="https://example.com/feed.xml"/>
    <outline text="Bad" xmlUrl="http://127.0.0.1/private.xml"/>
    <outline text="Native" xmlUrl="https://www.youtube.com/feeds/videos.xml?channel_id=UCabcdefghijklmnopqrstuv"/>
  </body></opml>`
  const result = parseOpml(xml, [])
  assert.equal(result.entries.length, 1)
  assert.deepEqual(result.entries[0].categories, ['Technology', 'News', 'Tech'])
  assert.equal(result.duplicates.length, 1)
  assert.equal(result.invalid.length, 2)
  const again = parseOpml(xml, ['https://example.com/feed.xml'])
  assert.equal(again.entries.length, 0)
  assert.throws(() => parseOpml('<not-opml/>'), /body/)
})

test('OPML export is standards-shaped and escapes titles', () => {
  const opml = buildOpml([{ url: 'https://example.com/feed?a=1&b=2', title: 'A & B', categories: ['Tech', 'News'] }])
  assert.match(opml, /<opml version="2.0">/)
  assert.match(opml, /type="rss"/)
  assert.match(opml, /A &amp; B/)
  assert.match(opml, /a=1&amp;b=2/)
  assert.match(opml, /category="Tech,News"/)
})

test('discovery parses advertised feeds and classifies platform inputs', () => {
  const html = `<html><head>
    <link rel="alternate" type="application/rss+xml" title="Main feed" href="/feed.xml">
    <link rel="alternate" type="application/atom+xml" href="https://news.example.org/atom">
    <link rel="alternate" type="text/html" href="/other">
    <link rel="stylesheet" href="/style.css">
  </head></html>`
  const feeds = parseFeedLinks(html, 'https://example.org/site/')
  assert.deepEqual(feeds.map(feed => feed.url), ['https://example.org/feed.xml', 'https://news.example.org/atom'])
  assert.equal(feeds[0].title, 'Main feed')
  assert.equal(parseFeedLinks('<html></html>', 'https://example.org').length, 0)
  const youtube = classifyDiscoveryInput('UCX6OQ3DkcsbYNE6H8uQQuVA')
  assert.equal(youtube?.kind, 'youtube')
  const reddit = classifyDiscoveryInput('https://old.reddit.com/r/webdev/')
  assert.equal(reddit?.kind, 'reddit')
  assert.equal(classifyDiscoveryInput('not a source'), null)
})
