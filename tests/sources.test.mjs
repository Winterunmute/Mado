import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import {
  normalizeSources,
  sourceId,
  contentId,
  dedupeContent,
  isReadInState,
} from '../dist/main/sources/model.js'
import { clearSourceCache, fetchSource, fetchSourcesConcurrently } from '../dist/main/sources/index.js'
import { mediaUrl } from '../dist/main/rss.js'
import { resolveYouTubeChannel } from '../dist/main/sources/youtube-adapter.js'
import { resolveRedditCommunity } from '../dist/main/sources/reddit-adapter.js'

test('legacy subscriptions migrate to stable typed sources', () => {
  const legacy = [
    { url: 'https://example.com/feed.xml', title: 'Example', enabled: true, lastFetched: null },
    { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCabcdefghijklmnopqrstuv', title: 'YouTube', enabled: false, lastFetched: null },
  ]
  const sources = normalizeSources({ feeds: legacy }, [])
  assert.equal(sources.length, 2)
  assert.deepEqual(sources.map(source => source.type), ['rss', 'rss'])
  assert.equal(sources[0].id, sourceId('rss', 'https://example.com/feed.xml'))
  assert.equal(sources[1].enabled, false)
  const typed = normalizeSources([{ ...legacy[1], type: 'youtube' }], [])
  assert.equal(typed[0].type, 'youtube')
  assert.equal(normalizeSources('bad', []).length, 0)
})

test('V0.7 migration preserves legacy sources and adds empty category assignments', () => {
  const legacy = [{ url: 'https://example.com/feed.xml', title: 'Example', enabled: false, lastFetched: null }]
  const migrated = normalizeSources({ version: 2, feeds: legacy }, [])
  assert.equal(migrated.length, 1)
  assert.deepEqual(migrated[0].categoryIds, [])
  const typed = normalizeSources({ version: 3, feeds: [{ ...legacy[0], type: 'youtube', categoryIds: ['cat:tech', 'cat:tech', ''] }] }, [])
  assert.equal(typed[0].type, 'youtube')
  assert.deepEqual(typed[0].categoryIds, ['cat:tech'])
})

test('media thumbnails normalize rss-parser object and array shapes', () => {
  assert.equal(mediaUrl({ url: 'https://example.org/a.jpg' }), 'https://example.org/a.jpg')
  assert.equal(mediaUrl({ $: { url: 'https://example.org/b.jpg' } }), 'https://example.org/b.jpg')
  assert.equal(mediaUrl([{ $: { url: 'https://example.org/c.jpg' } }]), 'https://example.org/c.jpg')
  assert.equal(mediaUrl(null), null)
})

test('YouTube input accepts channel ids and canonical URLs only', () => {
  const id = 'UCabcdefghijklmnopqrstuv'
  const expected = `https://www.youtube.com/feeds/videos.xml?channel_id=${id}`
  for (const input of [id, `https://www.youtube.com/channel/${id}`, expected]) {
    assert.equal(resolveYouTubeChannel(input).feedUrl, expected)
  }
  assert.throws(() => resolveYouTubeChannel('https://www.youtube.com/@somehandle'), /cannot be resolved reliably/i)
  assert.throws(() => resolveYouTubeChannel('https://example.com/channel/UCabcdefghijklmnopqrstuv'), /YouTube/)
})

test('Reddit input accepts community names and URLs', () => {
  assert.equal(resolveRedditCommunity('technology').feedUrl, 'https://www.reddit.com/r/technology/new/.rss')
  assert.equal(resolveRedditCommunity('/r/technology').feedUrl, 'https://www.reddit.com/r/technology/new/.rss')
  assert.equal(resolveRedditCommunity('https://old.reddit.com/r/webdev/').feedUrl, 'https://www.reddit.com/r/webdev/new/.rss')
  assert.throws(() => resolveRedditCommunity('https://example.com/r/technology'), /subreddit|reddit/i)
})

test('content ids include source identity and dedupe preserves read state', () => {
  const source = { id: sourceId('rss', 'https://example.com/feed.xml'), type: 'rss', url: 'https://example.com/feed.xml', sourceUrl: 'https://example.com/feed.xml', title: 'Example', enabled: true, lastFetched: null, lastError: null }
  const item = {
    id: contentId(source, 'https://example.com/a'),
    sourceId: source.id, sourceType: 'rss', sourceName: 'Example', title: 'A',
    link: 'https://example.com/a', pubDate: '2026-01-01T00:00:00Z', description: '', contentHtml: '',
    thumbnail: null, contentType: 'article', author: null, metadata: {}, feedUrl: source.url,
    feedTitle: 'Example', isRead: false,
  }
  assert.equal(item.id, 'rss:https://example.com/feed.xml:https://example.com/a')
  assert.deepEqual(dedupeContent([item, { ...item }]).length, 1)
  assert.equal(isReadInState({ [item.id]: true }, item), true)
  assert.equal(isReadInState({ [item.link]: true }, item), true)
  assert.equal(isReadInState({}, item), false)
})

test('source failures are isolated and cached content survives with its error', async t => {
  const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>Fixture</title><link>https://example.org</link><description>Fixture</description><item><title>One</title><link>https://example.org/one</link><pubDate>Thu, 21 Nov 2026 10:00:00 GMT</pubDate><description>Body</description></item></channel></rss>`
  const server = createServer((_req, res) => {
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8')
    res.end(xml)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => { clearSourceCache(); server.close() })

  const url = `http://127.0.0.1:${server.address().port}/feed`
  const base = { sourceUrl: url, title: 'Fixture', enabled: true, lastFetched: null, lastError: null }
  const good = { ...base, id: 'rss:fixture-good', type: 'rss', url }
  const bad = { ...base, id: 'rss:fixture-bad', type: 'rss', url: 'http://127.0.0.1:9/feed' }

  const results = await fetchSourcesConcurrently([good, bad], true)
  assert.equal(results.get(good.id)?.error, null)
  assert.equal(results.get(good.id)?.items.length, 1)
  assert.match(results.get(bad.id)?.error || '', /ECONNREFUSED|fetch|Status|socket/i)
  assert.equal(results.get(bad.id)?.items.length, 0)

  await fetchSource(good, true)
  const stale = await fetchSourcesConcurrently([{ ...good, url: bad.url }], true)
  assert.ok(stale.get(good.id)?.error)
  assert.equal(stale.get(good.id)?.items.length, 1)
})
