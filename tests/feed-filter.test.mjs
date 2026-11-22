import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

// Compile the renderer filter directly so it is tested without duplicating logic.
const source = await readFile(new URL('../src/renderer/lib/article-filter.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { selectArticles, selectArticlesWithOptions, hasActiveFilters } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)

const item = (id, sourceType, sourceId, title, isRead = false, extra = {}) => ({
  id, sourceId, sourceType, contentType: 'article', author: null, metadata: {},
  title, link: `https://example.org/${id}`, pubDate: '2026-11-21T10:00:00Z',
  description: `Description for ${title}`, feedTitle: sourceId, feedUrl: sourceId,
  thumbnail: null, isRead, saved: false, available: true, categoryIds: [], ...extra,
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

test('combined filters include saved, category, date, type and custom views', () => {
  const items = [
    item('a', 'rss', 'rss:one', 'Alpha', true, { saved: true, categoryIds: ['cat:tech'] }),
    item('b', 'youtube', 'youtube:two', 'Beta', false, { contentType: 'video', categoryIds: ['cat:tech', 'cat:fun'] }),
    item('c', 'reddit', 'reddit:three', 'Gamma', false, { pubDate: '2026-10-01T10:00:00Z', categoryIds: ['cat:fun'] }),
  ]
  const base = { query: '', mode: 'all' }
  assert.deepEqual(selectArticlesWithOptions(items, { ...base, mode: 'saved' }).map(a => a.id), ['a'])
  assert.deepEqual(selectArticlesWithOptions(items, { ...base, categoryId: 'cat:fun' }).map(a => a.id), ['b', 'c'])
  assert.deepEqual(selectArticlesWithOptions(items, { ...base, sourceType: 'youtube' }).map(a => a.id), ['b'])
  assert.deepEqual(selectArticlesWithOptions(items, { ...base, sourceId: 'reddit:three' }).map(a => a.id), ['c'])
  assert.deepEqual(selectArticlesWithOptions(items, { ...base, contentType: 'video' }).map(a => a.id), ['b'])
  assert.deepEqual(selectArticlesWithOptions(items, { ...base, dateFrom: '2026-11-01' }).map(a => a.id), ['a', 'b'])
  assert.deepEqual(selectArticlesWithOptions(items, {
    ...base, categoryId: 'cat:tech', query: 'beta', view: { id: 'v', name: 'V', categoryIds: [], sourceIds: [], contentTypes: [], typeFilter: 'youtube' },
  }).map(a => a.id), ['b'])
  assert.equal(hasActiveFilters(base), false)
  assert.equal(hasActiveFilters({ ...base, mode: 'saved' }), true)
})
