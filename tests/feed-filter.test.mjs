import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

// Compile the renderer filter directly so it is tested without duplicating logic.
const source = await readFile(new URL('../src/renderer/lib/article-filter.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { selectArticles } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)

const item = (id, sourceType, sourceId, title, isRead = false) => ({
  id, sourceId, sourceType, contentType: 'article', author: null, metadata: {},
  title, link: `https://example.org/${id}`, pubDate: '2026-11-21T10:00:00Z',
  description: `Description for ${title}`, feedTitle: sourceId, feedUrl: sourceId,
  thumbnail: null, isRead,
})

const mixed = [
  item('rss-1', 'rss', 'rss:blog', 'Quiet desktop tools'),
  item('yt-1', 'youtube', 'youtube:UCabcdefghijklmnopqrstuv', 'Building a tiny synthesizer'),
  item('reddit-1', 'reddit', 'reddit:technology', 'Reddit desktop discussion', true),
]

test('mixed-source feed filters by type, source and unread state', () => {
  assert.equal(selectArticles(mixed, 'all', '').length, 3)
  assert.deepEqual(selectArticles(mixed, 'all', '', 'youtube').map(a => a.id), ['yt-1'])
  assert.deepEqual(selectArticles(mixed, 'all', '', 'all', 'reddit:technology').map(a => a.id), ['reddit-1'])
  assert.deepEqual(selectArticles(mixed, 'unread', '').map(a => a.id), ['rss-1', 'yt-1'])
})

test('search matches title, description, source and author across content types', () => {
  assert.deepEqual(selectArticles(mixed, 'all', 'synthesizer').map(a => a.id), ['yt-1'])
  assert.deepEqual(selectArticles(mixed, 'all', 'REDDIT').map(a => a.id), ['reddit-1'])
  assert.deepEqual(selectArticles(mixed, 'all', 'description for quiet').map(a => a.id), ['rss-1'])
})
