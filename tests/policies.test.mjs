import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'

async function sourceModule(path) {
  const source = await fs.readFile(new URL(path, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
}
const { selectArticles, filterFromPreference } = await sourceModule('../src/renderer/lib/article-filter.ts')
const { classifyMessengerNavigation: classify } = await sourceModule('../src/main/messenger-navigation.ts')
const { messengerStyle } = await sourceModule('../src/main/messenger-style.ts')

test('All, Unread, search and persisted filter use the same read state', () => {
  const articles = [
    { title: 'A', description: 'First', feedTitle: 'Publisher', isRead: false },
    { title: 'B', description: 'Second', feedTitle: 'Other', isRead: true },
  ]
  assert.equal(selectArticles(articles, 'all', '').length, 2)
  assert.equal(selectArticles(articles, 'unread', '').length, 1)
  assert.equal(selectArticles(articles, 'all', ' publisher ').length, 1)
  assert.equal(filterFromPreference(false), 'unread')
  assert.equal(filterFromPreference(true), 'all')
  articles[0].isRead = true
  assert.equal(selectArticles(articles, 'unread', '').length, 0)
})

test('Messenger-only navigation blocks Facebook feed even during authentication', () => {
  for (const landing of [false, true]) {
    for (const route of ['/', '/home.php', '/feed/', '/watch/', '/reels/', '/groups/feed/']) {
      assert.equal(classify(`https://www.facebook.com${route}`, landing).kind, 'block')
    }
  }
  for (const route of ['/messages/', '/messages/t/123', '/login/', '/checkpoint/', '/two_step_verification/']) {
    assert.equal(classify(`https://www.facebook.com${route}`).kind, 'allow')
  }
})

test('Messenger redirects, malformed URLs and unsafe schemes cannot escape policy', () => {
  for (const url of ['javascript:alert(1)', 'file:///C:/secret', 'data:text/html,hi', 'not a url', 'https://user:password@facebook.com/messages/']) {
    assert.equal(classify(url).kind, 'block')
  }
  for (const url of ['https://facebook.com.evil.example/messages/', 'https://example.org/article']) {
    assert.equal(classify(url).kind, 'external')
  }
  assert.deepEqual(classify('https://l.facebook.com/l.php?u=https%3A%2F%2Fexample.org%2Farticle'), { kind: 'external', url: 'https://example.org/article' })
  assert.equal(classify('https://l.facebook.com/l.php?u=javascript%3Aalert(1)').kind, 'block')
})

test('Messenger styling uses both palettes without hiding generic conversation navigation', () => {
  const dark = messengerStyle('dark')
  const light = messengerStyle('light')
  assert.match(dark, /#161622/)
  assert.match(light, /#ffffff/)
  assert.match(dark, /--web-wash: #0f0f1a/)
  assert.match(light, /--web-wash: #fafafa/)
  assert.match(dark, /--accent: #3b82f6/)
  assert.match(light, /--accent: #2563eb/)
  assert.match(dark, /--divider: #2a2a4a/)
  assert.match(light, /--divider: #e4e4e7/)
  assert.match(dark, /::-webkit-scrollbar-thumb/)
  assert.match(dark, /role="banner"/)
  assert.doesNotMatch(dark, /\[role="navigation"\]\s*\{/)
  assert.doesNotMatch(dark, /role="tablist"/)
  assert.doesNotMatch(dark, /transform:\s*scale|position:\s*fixed\s*!important/)
})
