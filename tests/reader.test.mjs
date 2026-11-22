import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractArticle, readArticle, fetchArticleHtml } from '../dist/main/reader.js'
import { sanitizeReaderContent, publicWebUrl, isPublicAddress } from '../dist/main/reader-content.js'

const paragraph = 'Personally curated reading deserves a comfortable place on your desktop. This article explains how a small, focused application can present information with clear attribution and readable paragraphs. '
const page = `<!doctype html><html><head><title>A window for reading</title></head><body><nav>Unrelated navigation</nav><article><h1>A window for reading</h1>${Array.from({ length: 8 }, () => `<p>${paragraph}</p>`).join('')}<h2>Relevant images</h2><figure><img src="/image.jpg" onerror="globalThis.pwned=true"><figcaption>A useful caption</figcaption></figure><p><a href="/related">Related reading</a></p><div hidden>SECRET HIDDEN TEXT</div><script>globalThis.pwned=true</script></article></body></html>`

test('Readability extracts meaningful article text and resolves relative resources', () => {
  const result = extractArticle(page, 'https://example.org/articles/story')
  assert.ok(result)
  assert.equal(result.title, 'A window for reading')
  assert.match(result.html, /Personally curated/)
  assert.match(result.html, /https:\/\/example.org\/image.jpg/)
  assert.match(result.html, /https:\/\/example.org\/related/)
  assert.doesNotMatch(result.html, /SECRET HIDDEN TEXT|<script|onerror|Unrelated navigation/)
  assert.equal(globalThis.pwned, undefined)
})

test('Reader sanitizer rejects active content, local files and unsafe resource URLs', () => {
  const result = sanitizeReaderContent(`<h2 style="position:fixed" id="root">Safe</h2><script>alert(1)</script><iframe src="https://example.org"></iframe><video autoplay src="x"></video><audio autoplay></audio><form><input name="password"></form><img src="file:///C:/secret"><img src="http://127.0.0.1/a"><img src="https://example.org/a.jpg" srcset="file:///bad" onerror="alert(1)"><a href="javascript:alert(1)">Unsafe</a><svg onload="x()"></svg>`, 'https://example.org/story')
  assert.match(result, /<h2>Safe<\/h2>/)
  assert.match(result, /referrerpolicy="no-referrer"/)
  assert.doesNotMatch(result, /<script|<iframe|<video|<audio|<form|<input|<svg|autoplay|onerror|onload|srcset|style=|id=|file:|127\.0\.0\.1|javascript:/)
})

test('Explicit paywall indicators and non-free metadata fall back instead of exposing content', () => {
  assert.equal(extractArticle(page.replace('<article>', '<div class="paywall">Subscribe</div><article>'), 'https://example.org/a'), null)
  assert.equal(extractArticle(page.replace('</head>', '<script type="application/ld+json">{"isAccessibleForFree":false}</script></head>'), 'https://example.org/a'), null)
  assert.equal(extractArticle('<html><body><p>Too short</p></body></html>', 'https://example.org/a'), null)
})

test('Reader refuses local, credential-bearing and non-web fetches, including IP encodings', async () => {
  for (const url of ['file:///C:/secret', 'http://localhost/a', 'http://127.1/a', 'http://2130706433/a', 'http://192.168.1.1/', 'http://[::1]/', 'https://user:pass@example.org/', 'data:text/html,hi']) {
    assert.equal(publicWebUrl(url), null)
    await assert.rejects(fetchArticleHtml(url))
  }
  assert.equal(isPublicAddress('10.1.2.3'), false)
  assert.equal(isPublicAddress('::ffff:127.0.0.1'), false)
  assert.equal(isPublicAddress('8.8.8.8'), true)
  assert.equal(publicWebUrl('/article', 'https://example.org/'), 'https://example.org/article')
})

test('Fetch failure returns sanitized full RSS content and clear browser fallback', async () => {
  const result = await readArticle({ title: 'RSS title', link: 'http://127.0.0.1/no-fetch', description: 'Summary', contentHtml: '<p>Available RSS text</p><script>alert(1)</script><img src="file:///C:/x">' })
  assert.equal(result.mode, 'feed')
  assert.equal(result.html, '<p>Available RSS text</p>')
  assert.match(result.notice, /full article is unavailable/)
  assert.equal(result.title, 'RSS title')
})
