// Deterministic local performance baseline for V0.8.
// Run after npm run build with: node scripts/benchmark.mjs
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import { dedupeContent, normalizeSources } from '../dist/main/sources/model.js'
import { normalizeSavedMap } from '../dist/main/organize/saved.js'

const source = await readFile(new URL('../src/renderer/lib/article-filter.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { selectArticlesWithOptions } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)

const now = () => Number(process.hrtime.bigint() / 1000000n)
const measure = (label, iterations, fn) => {
  const start = now()
  let value
  for (let i = 0; i < iterations; i++) value = fn(i)
  const ms = now() - start
  console.log(`${label}: ${ms.toFixed(1)}ms total / ${(ms / iterations).toFixed(3)}ms avg (${iterations} runs)${value === undefined ? '' : ` [${value}]`}`)
  return ms
}

const SIZE = 5000
const contentTypes = ['article', 'video', 'post', 'image', 'link']
const sourceTypes = ['rss', 'youtube', 'reddit']
const items = Array.from({ length: SIZE }, (_, index) => ({
  id: `rss:source-${index % 40}:https://example.org/item-${index}`,
  sourceId: `rss:source-${index % 40}`,
  sourceType: sourceTypes[index % 3],
  contentType: contentTypes[index % 5],
  author: index % 2 ? 'Author' : null,
  metadata: {},
  title: `Fixture article ${index}`,
  link: `https://example.org/item-${index}`,
  pubDate: new Date(Date.UTC(2026, 10, 1 + (index % 25))).toISOString(),
  description: 'A deterministic fixture summary used for repeatable performance measurement.',
  contentHtml: '',
  thumbnail: null,
  feedTitle: `Source ${index % 40}`,
  feedUrl: `https://example.org/source-${index % 40}/feed`,
  isRead: index % 4 === 0,
  saved: index % 11 === 0,
  available: true,
  categoryIds: index % 2 ? ['cat:tech'] : ['cat:news'],
}))

measure('combined filter (5k items, 100 runs)', 100, () => selectArticlesWithOptions(items, {
  mode: 'unread', query: 'fixture', categoryId: 'cat:tech', sourceType: 'all',
  sourceId: 'all', contentType: 'article', dateFrom: '2026-11-01', dateTo: '2026-11-20',
}).length)

measure('dedupe (5k items, 20 runs)', 20, () => dedupeContent(items).length)
measure('source normalize (40 sources, 100 runs)', 100, () => normalizeSources({ version: 3, feeds: items.slice(0, 40).map(item => ({ url: item.feedUrl, title: item.feedTitle })) }, []).length)
measure('saved map normalize (500 items, 50 runs)', 50, () => Object.keys(normalizeSavedMap({ version: 1, items: Object.fromEntries(items.slice(0, 500).map(item => [item.id, item])) })).length)

const markIds = items.slice(0, 500).map(item => item.id)
measure('mark-all-read lookup with includes (5k x 500, 20 runs)', 20, () => items.filter(item => markIds.includes(item.id)).length)
measure('mark-all-read lookup with Set (5k x 500, 20 runs)', 20, () => {
  const idSet = new Set(markIds)
  return items.filter(item => idSet.has(item.id)).length
})
