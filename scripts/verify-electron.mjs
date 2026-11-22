// Runs the real production renderer, preload, IPC and stores in an isolated profile.
// Never reads the user's Messenger cookies, credentials or conversations.
// Allow local fixture servers inside this harness only; packaged builds do not set it.
process.env.MADO_ALLOW_LOCAL_SOURCES = '1'
import { app, BrowserWindow, shell, session, screen, nativeImage } from 'electron'
import http from 'node:http'
import fs from 'node:fs/promises'
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import https from 'node:https'
import { syncBuiltinESMExports } from 'node:module'

async function run() {
console.log('Starting isolated Electron verification')
app.on('browser-window-created', (_event, window) => {
  console.log('Created verification window')
  window.show()
  window.webContents.on('render-process-gone', (_e, details) => console.error('Renderer process gone:', details))
  window.webContents.on('did-fail-load', (_e, code, description) => console.error('Renderer load failed:', code, description))
  window.webContents.on('console-message', (_e, level, message) => { if (level >= 2) console.error('Renderer:', message) })
})
const profile = path.resolve('.verification', process.env.MADO_VERIFY_STAGE || 'v02')
mkdirSync(path.join(profile, 'mado'), { recursive: true })
app.setPath('userData', profile)
await app.whenReady()
// Controlled Messenger-shaped fixture: no authentication or private conversation data.
await session.fromPartition('persist:messenger').protocol.handle('https', () => new Response(`<!doctype html><html><head><style>body {font:14px system-ui;background:var(--web-wash);color:var(--primary-text);padding:20px}nav,textarea {padding:20px;background:var(--card-background);color:var(--primary-text);border:1px solid var(--divider)}textarea{width:90%;margin-top:80px}a{color:var(--accent)}</style></head><body><div role="banner"><a href="/">Facebook</a><button>Menu</button></div><main><h2>Messenger verification</h2><nav role="navigation" aria-label="Conversations">Conversation switching remains visible</nav><textarea placeholder="Message composer (fixture)"></textarea><p>Controlled fixture. No private messages.</p></main></body></html>`, { headers: { 'Content-Type': 'text/html' } }))
const server = http.createServer((req, res) => {
  if (req.url === '/bad') { res.writeHead(500); res.end('Unavailable'); return }
  if (req.url === '/atom') {
    res.setHeader('Content-Type', 'application/atom+xml')
    res.end('<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Atom Verification</title><id>https://example.org/atom</id><updated>2026-11-20T12:00:00Z</updated><entry><title>Atom article</title><id>https://example.org/atom-article</id><link href="https://example.org/atom-article"/><updated>2026-11-20T12:00:00Z</updated><content type="html">&lt;p&gt;RSS and Atom remain supported.&lt;/p&gt;</content></entry></feed>')
    return
  }
  if (req.url === '/youtube-feed') {
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8')
    res.end(`<?xml version="1.0"?><rss version="2.0" xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>Fixture Channel</title><link>https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv</link><description>Controlled channel</description><item><title>Video One: A guided tour</title><link>https://www.youtube.com/watch?v=abcdefghijk</link><pubDate>${new Date(2026, 10, 21, 10, 0).toUTCString()}</pubDate><description>A controlled video description for feed verification.</description><yt:videoId>abcdefghijk</yt:videoId><media:group><media:thumbnail url="https://example.org/video-thumb.jpg"/></media:group></item></channel></rss>`)
    return
  }
  if (req.url === '/reddit-feed') {
    res.setHeader('Content-Type', 'application/atom+xml; charset=utf-8')
    res.end(`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>r/technology</title><id>https://www.reddit.com/r/technology/</id><updated>2026-11-21T10:00:00Z</updated><entry><title>Reddit fixture discussion</title><link href="https://www.reddit.com/r/technology/comments/1/fixture/"/><id>https://www.reddit.com/r/technology/comments/1/fixture/</id><updated>2026-11-21T10:00:00Z</updated><author><name>fixture-author</name></author><content type="html">&lt;p&gt;A controlled Reddit post body for feed verification.&lt;/p&gt;</content></entry></feed>`)
    return
  }
  if (req.url === '/discover') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(`<!doctype html><html><head><title>Discovery fixture</title><link rel="alternate" type="application/rss+xml" title="Fixture Discovery Feed" href="/feed"></head><body>Controlled discovery page.</body></html>`)
    return
  }
  if (req.url?.startsWith('/article-')) {
    if (req.url === '/article-1') { res.writeHead(403); res.end('Restricted'); return }
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    const html = `<!doctype html><html><head><title>Inside Mado: ${req.url}</title></head><body><article><h1>Inside Mado: ${req.url}</h1><p>By Example Publisher</p>${Array.from({length: 20}, (_, i) => `<h2>Chapter ${i + 1}</h2><p>Personally curated reading deserves a comfortable place on your desktop. This is a long article with readable paragraphs, useful headings and clear publisher attribution. Your own sources determine what appears in your feed.</p>`).join('')}<p><a href="https://example.org/related">Related article</a></p><script>window.__readerScript=true</script><video autoplay src="https://example.org/video.mp4"></video></article></body></html>`
    if (req.url === '/article-2') setTimeout(() => res.end(html), 500)
    else res.end(html)
    return
  }
  res.setHeader('Content-Type', 'application/rss+xml')
  res.end(`<?xml version="1.0"?><rss version="2.0"><channel><title>Verification News</title><link>https://example.org</link><description>Controlled fixture</description>${Array.from({ length: 24 }, (_, i) => `<item><title>Article ${i + 1}: A comfortable window to the world</title><link>https://example.org/article-${i}</link><pubDate>${new Date(2026, 10, 20, 12, 0, -i).toUTCString()}</pubDate><description>A readable article summary from a personally curated source. This fixture verifies card height, scrolling and persisted read state.</description></item>`).join('')}</channel></rss>`)
})
// V0.6 read-state ids include the source url, so the local fixture keeps one
// persisted port across fresh and restart runs in the same profile.
const portFile = path.join(profile, 'fixture-port.json')
let fixturePort = 0
try {
  fixturePort = Number(JSON.parse(await fs.readFile(portFile, 'utf8')).port) || 0
} catch { /* first run in this profile */ }
await new Promise(resolve => server.listen(fixturePort, '127.0.0.1', resolve))
fixturePort = server.address().port
await fs.writeFile(portFile, JSON.stringify({ port: fixturePort }))
const feedUrl = `http://127.0.0.1:${fixturePort}/feed`
// Route only controlled example.org article fixtures to our local fixture server.
// Production fetch code still runs, including its status/size/redirect handling.
const fixtureUrl = value => {
  if (value instanceof URL) return value
  if (value && typeof value === 'object' && value.hostname) {
    try { return new URL(`${value.protocol || 'https:'}//${value.hostname}${value.port ? `:${value.port}` : ''}${value.path || '/'}`) } catch { return null }
  }
  return null
}
const fixtureRequest = (parsed, options, callback) => {
  const fixture = parsed.hostname === 'www.youtube.com' ? '/youtube-feed' : parsed.hostname === 'www.reddit.com' ? '/reddit-feed' : parsed.pathname
  return http.request(`http://127.0.0.1:${server.address().port}${fixture}`, { signal: options?.signal }, callback)
}
const originalRequest = https.request
https.request = function(url, options, callback) {
  const parsed = fixtureUrl(url)
  if (parsed && ['example.org', 'www.youtube.com', 'www.reddit.com'].includes(parsed.hostname)) {
    assert.equal(options?.headers?.Cookie, undefined)
    assert.equal(options?.headers?.Authorization, undefined)
    return fixtureRequest(parsed, options, callback)
  }
  return originalRequest.apply(this, arguments)
}
const originalGet = https.get
https.get = function(url, options, callback) {
  const parsed = fixtureUrl(url)
  if (parsed && ['example.org', 'www.youtube.com', 'www.reddit.com'].includes(parsed.hostname)) {
    if (typeof options === 'function') { callback = options; options = {} }
    const request = fixtureRequest(parsed, options || {}, callback)
    request.end()
    return request
  }
  return originalGet.apply(this, arguments)
}
syncBuiltinESMExports()
await fs.writeFile(path.join(profile, 'mado', 'feeds.json'), JSON.stringify({ feeds: [{ url: feedUrl, title: 'Verification News', enabled: true, lastFetched: null }] }))
if (!process.env.MADO_VERIFY_RESTART) {
  await fs.writeFile(path.join(profile, 'mado', 'settings.json'), JSON.stringify({ settings: { theme: 'dark', showReadArticles: true, messengerVisible: true, messengerWidth: 420, onboardingComplete: true } }))
  await fs.writeFile(path.join(profile, 'mado', 'read-state.json'), JSON.stringify({ state: {} }))
  await fs.writeFile(path.join(profile, 'mado', 'messenger-tabs.json'), JSON.stringify({ tabs: [] }))
  await fs.writeFile(path.join(profile, 'mado', 'categories.json'), JSON.stringify({ version: 1, categories: [] }))
  await fs.writeFile(path.join(profile, 'mado', 'saved.json'), JSON.stringify({ version: 1, items: {} }))
  await fs.writeFile(path.join(profile, 'mado', 'feed-views.json'), JSON.stringify({ version: 1, views: [] }))
  await fs.writeFile(path.join(profile, 'mado', 'window-state.json'), JSON.stringify({ state: { x: null, y: null, width: 1400, height: 900, maximized: false } }))
}
const external = []
shell.openExternal = async url => { external.push(url) }
const logs = []
const check = (name, result) => { assert.ok(result, name); logs.push(name); console.log('PASS', name) }
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
await import('../dist/main/index.js')
console.log('Imported application')
await app.whenReady()
console.log('Electron ready')
const { readSettings, writeSettings } = await import('../dist/main/store.js')
await writeSettings({ ...await readSettings(), onboardingComplete: true })
let win
for (let i = 0; i < 100; i++) {
  win = BrowserWindow.getAllWindows()[0]
  if (win && !win.webContents.isLoading()) break
  await delay(100)
}
// V0.5 verification is deliberately placed on the secondary/smaller display.
let verificationDisplay = screen.getPrimaryDisplay()
if (process.env.MADO_VERIFY_STAGE === 'v05') {
  const secondary = screen.getAllDisplays()
    .filter(display => display.id !== screen.getPrimaryDisplay().id)
    .sort((a, b) => (a.workArea.width * a.workArea.height) - (b.workArea.width * b.workArea.height))[0]
  verificationDisplay = secondary || verificationDisplay
  const area = verificationDisplay.workArea
  if (!process.env.MADO_VERIFY_RESTART) {
    win.setBounds({
      x: area.x + 20,
      y: area.y + 20,
      width: Math.max(1000, Math.min(1200, area.width - 40)),
      height: Math.max(700, Math.min(800, area.height - 40)),
    })
  }
  console.log(`Verification display: ${verificationDisplay.id} ${area.width}x${area.height}${secondary ? '' : ' (only display)'}`)
}
const js = code => win.webContents.executeJavaScript(code, true)
const wait = async (code) => {
  for (let i = 0; i < 100; i++) {
    try { if (await js(code)) return } catch { /* transient DOM during React re-render */ }
    await delay(100)
  }
  throw new Error(`Timed out: ${code}`)
}
const click = selector => js(`document.querySelector(${JSON.stringify(selector)}).click()`)
const waitFor = async (probe, label) => {
  for (let i = 0; i < 100; i++) { if (await probe()) return; await delay(100) }
  throw new Error(`Timed out: ${label}`)
}
try {
  if (process.env.MADO_VERIFY_RESTART) {
    const persistedFilter = await js("window.electronAPI.settings.get().then(s => s.feedFilterMode || (s.showReadArticles ? 'all' : 'unread'))")
    await wait(`document.documentElement.dataset.theme === 'light' && document.querySelector('.filter-btn')?.textContent.includes('${persistedFilter === 'unread' ? 'Unread' : 'All'}') && document.querySelectorAll('.article-card').length > 0`)
    check(`full Electron process restart restores Light and ${persistedFilter} filter`, true)
    check('full Electron process restart restores persisted read status', await js("window.electronAPI.articles.get().then(articles => articles.find(a=>a.link === 'https://example.org/article-0').isRead)"))
    check('full Electron process restart restores Messenger visibility and width', await js("window.electronAPI.settings.get().then(settings => settings.messengerVisible === true && settings.messengerWidth === 420)"))
    if (process.env.MADO_VERIFY_STAGE === 'v04') {
      check('full Electron process restart restores pinned conversation tabs', await js("window.electronAPI.conversationTabs.get().then(tabs => tabs.length === 1 && tabs[0].pinned === true && tabs[0].label === 'Chat 123')"))
    }
    if (process.env.MADO_VERIFY_STAGE === 'v05') {
      const expectedWidth = Math.max(1000, Math.min(1100, verificationDisplay.workArea.width - 80))
      check('full Electron process restart restores maximized window state', await js("window.electronAPI.desktop.getState().then(s => s.windowState && s.windowState.maximized === true)") && win.isMaximized())
      check('full Electron process restart restores saved window size', await js(`window.electronAPI.desktop.getState().then(s => Math.abs(s.windowState.width - ${expectedWidth}) <= 2)`))
      check('full Electron process restart keeps normal exit default', await js("window.electronAPI.desktop.getState().then(s => s.closeToTray === false && !s.trayActive)"))
    }
    await fs.writeFile(path.join(profile, 'restart-results.json'), JSON.stringify(logs, null, 2))
    server.close(); app.quit(); return
  }
  await wait("document.querySelectorAll('.article-card').length === 24")
  await delay(300)
  await fs.writeFile(path.join(profile, 'feed-dark.png'), (await win.webContents.capturePage()).toPNG())
  check('production renderer renders 24 readable cards and scrolls', await js("document.querySelector('.article-card').clientHeight > 100 && document.querySelector('.feed-container').scrollHeight > document.querySelector('.feed-container').clientHeight"))
  await click('.filter-btn')
  await click('[aria-label="Mark as read"]')
  await wait("document.querySelectorAll('.article-card').length === 23")
  check('marking read immediately removes the card in Unread', true)
  await click('[aria-label="Refresh feeds"]')
  await wait("document.querySelectorAll('.article-card').length === 23")
  await delay(400)
  check('refresh preserves read status', await js("document.querySelectorAll('.article-card').length === 23"))
  await delay(300)
  await win.webContents.reload()
  await wait("document.querySelector('.filter-btn')?.textContent.includes('Unread') && document.querySelectorAll('.article-card').length === 23")
  check('reload restores persisted Unread and read status', true)
  await click('[aria-label="Sources"]')
  await wait("!!document.querySelector('.sources-view')")
  check('Sources is a dedicated subscription view', await js("document.querySelectorAll('.feed-item').length === 1"))
  await click('.feed-toggle input')
  await wait("document.querySelector('.feed-toggle input')?.checked === false")
  await click('[aria-label="Home"]')
  await wait("document.querySelectorAll('.article-card').length === 0")
  check('disabling a source removes its articles', true)
  await click('[aria-label="Sources"]')
  await click('.feed-toggle input')
  await wait("document.querySelector('.feed-toggle input')?.checked === true")
  await click('[aria-label="Settings"]')
  await wait("!!document.querySelector('.settings')")
  check('Settings scrolls independently', await js("getComputedStyle(document.querySelector('.settings')).overflowY === 'auto' && document.querySelector('.settings').scrollHeight > document.querySelector('.settings').clientHeight"))
  await click('[role="radio"]:nth-child(2)')
  await wait("document.documentElement.dataset.theme === 'light'")
  check('Light theme changes computed surface color', await js("getComputedStyle(document.body).backgroundColor === 'rgb(250, 250, 250)'"))
  await delay(300)
  win.webContents.reload()
  await wait("document.documentElement.dataset.theme === 'light' && !!document.querySelector('.feed-area')")
  check('Light theme survives renderer restart', true)
  win.setSize(1000, 700)
  await delay(300)
  await click('[aria-label="Settings"]')
  check('Settings can reach its final section at minimum size', await js("(() => { const s=document.querySelector('.settings'); s.scrollTop=s.scrollHeight; return s.scrollTop > 0 && s.getBoundingClientRect().bottom <= innerHeight })()"))
  await fs.writeFile(path.join(profile, 'settings-minimum.png'), (await win.webContents.capturePage()).toPNG())
  await js("window.electronAPI.settings.set('messengerWidth', 600)")
  await delay(100)
  // Reload synchronizes a direct IPC preference change with the production React store.
  win.webContents.reload()
  await wait("document.querySelector('.messenger-panel')?.clientWidth === 599")
  check('feed stays outside Messenger at minimum window and maximum panel width', await js("document.querySelector('.feed-area').getBoundingClientRect().right <= document.querySelector('.messenger-panel').getBoundingClientRect().left + 1"))
  await js("window.electronAPI.settings.set('messengerWidth', 420)")
  win.setSize(1400, 900)
  win.webContents.reload()
  await wait("!!document.querySelector('.feed-area')")
  await delay(300)
  const messenger = win.contentView.children[0]
  check('Messenger cosmetic styling hides only the global banner on fixture', await messenger.webContents.executeJavaScript(`getComputedStyle(document.querySelector('[role="banner"]')).display === 'none' && getComputedStyle(document.querySelector('nav')).display !== 'none' && !!document.querySelector('textarea')`))
  check('Messenger native view stays below the titlebar and compact tab header', messenger.getBounds().y === 80)
  await js("document.querySelector('.resize-handle').dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowLeft', bubbles:true}))")
  await wait("document.querySelector('.messenger-panel').clientWidth === 439")
  check('keyboard resizing updates both renderer and native panel', messenger.getBounds().width === 432)
  await js("document.querySelector('.resize-handle').dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowRight', bubbles:true}))")
  await wait("document.querySelector('.messenger-panel').clientWidth === 419")
  const handle = await js("(() => {const r=document.querySelector('.resize-handle').getBoundingClientRect();return {x:Math.round(r.left+3),y:300}})()")
  await js("window.__pointerTrace=[]; for(const type of ['pointerdown','pointermove','pointerup','lostpointercapture']) document.addEventListener(type,e=>window.__pointerTrace.push({type,x:e.clientX,target:e.target.className,buttons:e.buttons}),true)")
  win.focus()
  win.webContents.focus()
  win.webContents.sendInputEvent({ type:'mouseMove', ...handle })
  await delay(100)
  win.webContents.sendInputEvent({ type:'mouseDown', ...handle, button:'left', modifiers:['leftButtonDown'], clickCount:1 })
  await delay(100)
  win.webContents.sendInputEvent({ type:'mouseMove', x:handle.x-60, y:handle.y, modifiers:['leftButtonDown'] })
  await delay(100)
  win.webContents.sendInputEvent({ type:'mouseUp', x:handle.x-60, y:handle.y, button:'left', clickCount:1 })
  await wait("document.querySelector('.messenger-panel').clientWidth === 479")
  check('pointer dragging updates panel width', true)
  for (let i=0;i<3;i++) {
    await js("document.querySelector('.resize-handle').dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowRight', bubbles:true}))")
    await delay(50)
  }
  await wait("document.querySelector('.messenger-panel').clientWidth === 419")
  await messenger.webContents.executeJavaScript("location.href='https://www.facebook.com/'")
  await delay(150)
  check('top-level Facebook home navigation stays blocked in Electron', new URL(messenger.webContents.getURL()).pathname.startsWith('/messages/'))
  await messenger.webContents.executeJavaScript("history.pushState({}, '', '/')")
  await delay(200)
  check('Facebook SPA home transition recovers to Messenger', new URL(messenger.webContents.getURL()).pathname.startsWith('/messages/'))
  await fs.writeFile(path.join(profile, 'feed-light.png'), (await win.webContents.capturePage()).toPNG())
  try { await fs.writeFile(path.join(profile, 'messenger-light.png'), (await messenger.webContents.capturePage()).toPNG()) }
  catch { /* capture surface can be unavailable in the sandbox; assertions do not depend on it */ }
  if (['v03', 'v04', 'v05', 'v06', 'v07'].includes(process.env.MADO_VERIFY_STAGE)) {
    await click('.filter-btn') // All; exact scroll restoration while the opened article becomes read.
    await wait("document.querySelectorAll('.article-card').length === 24")
    await js("document.querySelector('.feed-container').scrollTop = 650")
    const savedScroll = await js("document.querySelector('.feed-container').scrollTop")
    const messengerId = messenger.webContents.id
    await click('.article-card:nth-child(5) .card-title')
    await wait("document.querySelector('.reader-body')?.textContent.includes('Personally curated')")
    check('articles open in the main-area reader with clean extracted text', await js("document.querySelector('.feed-container').hidden && document.querySelectorAll('.reader-body h2').length === 20"))
    check('Messenger retains the same native webContents while reading', messenger.webContents.id === messengerId && win.contentView.children.includes(messenger))
    check('long reader scrolls independently and has no scripts or media', await js("document.querySelector('.reader-scroll').scrollHeight > document.querySelector('.reader-scroll').clientHeight && !document.querySelector('.reader-body script, .reader-body video, .reader-body audio, .reader-body iframe') && !window.__readerScript"))
    await fs.writeFile(path.join(profile, 'reader-light.png'), (await win.webContents.capturePage()).toPNG())
    await click('.reader-toolbar button:nth-child(2)')
    check('Open in Browser dispatches the original article through validated shell handler', external.includes('https://example.org/article-4'))
    await click('.reader-toolbar button:first-child')
    await wait("!document.querySelector('.article-reader')")
    check('Back to Feed restores exact feed scroll and All preference', await js(`document.querySelector('.feed-container').scrollTop === ${savedScroll} && document.querySelector('.filter-btn').textContent.includes('All')`))
    await click('.article-card:nth-child(2) .action-btn.primary')
    await wait("document.querySelector('.reader-notice')?.textContent.includes('full article is unavailable')")
    check('HTTP restriction falls back to RSS content with attribution and browser action', await js("document.querySelector('.reader-body').textContent.includes('readable article summary') && !!document.querySelector('.reader-original')"))
    await fs.writeFile(path.join(profile, 'reader-fallback.png'), (await win.webContents.capturePage()).toPNG())
    await click('.reader-toolbar button:first-child')
    await click('.article-card:nth-child(3) .card-title')
    await click('.reader-toolbar button:first-child')
    await click('.article-card:nth-child(4) .card-title')
    await wait("document.querySelector('.reader-body')?.textContent.includes('Personally curated')")
    await delay(600)
    check('late article completion cannot replace a newer reader selection', await js("document.querySelector('.reader-page h1').textContent.includes('/article-3')"))
    await js("window.electronAPI.settings.set('theme', 'dark')")
    // Exercise the UI setting too, keeping the React store and native view coordinated.
    await click('[aria-label="Settings"]')
    await click('[role="radio"]:first-child')
    await click('[aria-label="Home"]')
    await click('.article-card:nth-child(5) .card-title')
    await wait("!!document.querySelector('.reader-body') && document.documentElement.dataset.theme === 'dark'")
    await fs.writeFile(path.join(profile, 'reader-dark.png'), (await win.webContents.capturePage()).toPNG())
    check('reader follows the dark palette', await js("getComputedStyle(document.body).backgroundColor === 'rgb(15, 15, 26)'"))
    win.setSize(1000, 700)
    await delay(150)
    check('reader remains within available width at minimum size', await js("document.querySelector('.reader-page').getBoundingClientRect().right <= document.querySelector('.messenger-panel').getBoundingClientRect().left + 1 && document.querySelector('.reader-scroll').scrollHeight > document.querySelector('.reader-scroll').clientHeight"))
    await fs.writeFile(path.join(profile, 'reader-minimum.png'), (await win.webContents.capturePage()).toPNG())
    win.setSize(1400, 900)
    await click('[aria-label="Settings"]')
    await click('[role="radio"]:nth-child(2)')
    const showRead = await js("document.querySelector('[aria-label=\"Show read articles\"]').checked")
    if (showRead) await click('[aria-label="Show read articles"]')
    await click('[aria-label="Sources"]')
    const setUrl = async value => js(`(() => {const input=document.querySelector('#feed-url'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event('input',{bubbles:true}));})()`)
    const atomUrl = feedUrl.replace('/feed','/atom')
    await setUrl(atomUrl)
    await click('[aria-label="Add feed"]')
    await wait("document.querySelectorAll('.feed-item').length === 2 && !!document.querySelector('.toast')")
    check('Sources form adds a real Atom feed with its publisher title', await js("Array.from(document.querySelectorAll('.feed-title-row')).some(e=>e.textContent.includes('Atom Verification'))"))
    await fs.writeFile(path.join(profile, 'sources.png'), (await win.webContents.capturePage()).toPNG())
    await setUrl(atomUrl)
    await click('[aria-label="Add feed"]')
    await wait("!!document.querySelector('#add-error')")
    check('Sources displays duplicate subscription error', await js("document.querySelector('#add-error').textContent.includes('already subscribed')"))
    await click('[aria-label="Remove Atom Verification"]')
    await wait("document.querySelectorAll('.feed-item').length === 1")
    check('Sources removes subscription without losing the other source', true)
    await click('[aria-label="Home"]')
    await wait("!!document.querySelector('.feed-area')")
    await click('.sidebar .messenger-toggle')
    await wait("!!document.querySelector('.messenger-tab') && !document.querySelector('.messenger-panel')")
    check('collapsing Messenger detaches the native view and frees feed width', !win.contentView.children.includes(messenger) && await js("document.querySelector('.messenger-space').clientWidth === 44 && document.querySelector('.feed-area').getBoundingClientRect().right > innerWidth - 100"))
    await click('[aria-label="Open Messenger"]')
    await wait("!!document.querySelector('.messenger-panel')")
    check('reopening Messenger reattaches the native view', win.contentView.children.includes(messenger) && await js("document.querySelector('.messenger-space').clientWidth === 420"))
  }
  if (['v04', 'v05', 'v06', 'v07'].includes(process.env.MADO_VERIFY_STAGE)) {
    const messengerId = messenger.webContents.id
    const tabCount = () => js("document.querySelectorAll('.conv-tab:not(.chats-tab)').length")
    const goToConversation = async id => {
      await messenger.webContents.executeJavaScript(`location.href='https://www.facebook.com/messages/t/${id}/'`)
      await waitFor(() => messenger.webContents.getURL().includes(`/messages/t/${id}/`), `conversation ${id}`)
      await wait("!document.querySelector('[aria-label=\"Save current conversation\"]').disabled")
    }
    const clickTabPart = (index, part) => js(`document.querySelectorAll('.conv-tab:not(.chats-tab)')[${index}].querySelector(${JSON.stringify(part)}).click()`)

    check('Messenger header has no redundant navigation controls', await js(`!document.querySelector('[aria-label="Go back"]') && !document.querySelector('[aria-label="Go forward"]') && !document.querySelector('[aria-label="Reload Messenger"]') && !document.querySelector('[aria-label="Close Messenger"]') && !document.querySelector('[aria-label="Back to Messenger"]') && !!document.querySelector('.conv-tab-strip') && !!document.querySelector('.chats-tab')`))
    check('compact tab header ends exactly where the native view begins', await js("Math.abs(document.querySelector('.panel-header').getBoundingClientRect().bottom - 80) < 1") && messenger.getBounds().y === 80)
    check('blocked navigation leaves a discreet recovery control', await js("!!document.querySelector('[aria-label=\"Recover Messenger\"]')"))
    await click('[aria-label="Recover Messenger"]')
    await waitFor(() => new URL(messenger.webContents.getURL()).pathname === '/messages/', 'contextual recovery')
    check('contextual recovery returns to Messages and hides itself', await js("!document.querySelector('[aria-label=\"Recover Messenger\"]')"))

    await goToConversation('123')
    await click('[aria-label="Save current conversation"]')
    await wait("document.querySelectorAll('.conv-tab:not(.chats-tab)').length === 1")
    check('current conversation is saved as a compact labelled tab', await js("Array.from(document.querySelectorAll('.conv-tab:not(.chats-tab) .tab-label')).some(e => e.textContent.includes('Chat 123')) && document.querySelectorAll('.conv-tab:not(.chats-tab) .tab-main')[0].getAttribute('aria-selected') === 'true'"))
    check('tab strip is disabled for duplicate current conversations', await js("document.querySelector('[aria-label=\"Save current conversation\"]').disabled"))

    await goToConversation('456')
    await click('[aria-label="Save current conversation"]')
    await goToConversation('789')
    await click('[aria-label="Save current conversation"]')
    await wait("document.querySelectorAll('.conv-tab:not(.chats-tab)').length === 3")

    await clickTabPart(0, '.tab-main')
    await waitFor(() => messenger.webContents.getURL().includes('/messages/t/123/'), 'switch to first tab')
    check('selecting a tab switches the existing Messenger webContents', messenger.webContents.id === messengerId && await js("document.querySelectorAll('.conv-tab:not(.chats-tab)')[0].classList.contains('active')"))
    await click('.chats-tab')
    await waitFor(() => new URL(messenger.webContents.getURL()).pathname === '/messages/', 'return to conversation list')
    check('Chats tab returns to the normal Messenger conversation list', await js("document.querySelector('.chats-tab').getAttribute('aria-selected') === 'true' && document.querySelector('[aria-label=\"Save current conversation\"]').disabled"))
    await clickTabPart(1, '.tab-main')
    await waitFor(() => messenger.webContents.getURL().includes('/messages/t/456/'), 'switch to second tab')

    await js("window.electronAPI.settings.set('messengerWidth', 320)")
    await delay(100)
    win.webContents.reload()
    await wait("document.querySelector('.messenger-panel')?.clientWidth === 319")
    check('conversation tabs scroll horizontally at minimum panel width', await js("(() => { const s = document.querySelector('.conv-tab-strip'); return getComputedStyle(s).overflowX === 'auto' && s.scrollWidth >= s.clientWidth && document.querySelectorAll('.conv-tab:not(.chats-tab)').length === 3 })()"))
    await fs.writeFile(path.join(profile, 'messenger-tabs-narrow.png'), (await win.webContents.capturePage()).toPNG())

    await js("window.electronAPI.settings.set('messengerWidth', 600)")
    await delay(100)
    win.webContents.reload()
    await wait("document.querySelector('.messenger-panel')?.clientWidth === 599")
    check('tabs and actions stay inside the wide panel header', await js("(() => { const h = document.querySelector('.panel-header').getBoundingClientRect(); const strip = document.querySelector('.conv-tab-strip').getBoundingClientRect(); const actions = document.querySelector('.header-actions').getBoundingClientRect(); return h.right <= innerWidth + 1 && strip.right <= actions.left + 1 })()"))
    await fs.writeFile(path.join(profile, 'messenger-tabs-wide.png'), (await win.webContents.capturePage()).toPNG())

    await clickTabPart(2, '[aria-label^="Close"]')
    await wait("document.querySelectorAll('.conv-tab:not(.chats-tab)').length === 2")
    await clickTabPart(1, '[aria-label^="Close"]')
    await wait("document.querySelectorAll('.conv-tab:not(.chats-tab)').length === 1")
    check('closing tabs leaves other conversations untouched', await tabCount() === 1 && await js("document.querySelectorAll('.conv-tab:not(.chats-tab) .tab-label')[0].textContent.includes('Chat 123')"))
    await clickTabPart(0, '[aria-label^="Pin"]')
    await wait("document.querySelectorAll('.conv-tab:not(.chats-tab)')[0].classList.contains('pinned')")
    check('pinned tab is marked with an active indicator', await js("document.querySelectorAll('.conv-tab:not(.chats-tab) [aria-pressed=\"true\"]').length === 1"))

    const savedBefore = await js('window.electronAPI.conversationTabs.get()')
    const rejected = await js("window.electronAPI.conversationTabs.save([{id:'bad',key:'t/9',url:'https://www.facebook.com/home.php',label:'Bad',pinned:true}]).then(tabs => tabs.length)")
    const restored = await js(`window.electronAPI.conversationTabs.save(${JSON.stringify(savedBefore)}).then(tabs => tabs.length)`)
    check('invalid saved tab URLs are rejected without losing valid tabs', rejected === 0 && restored === 1 && savedBefore[0].pinned === true)

    await fs.writeFile(path.join(profile, 'messenger-tabs-light.png'), (await win.webContents.capturePage()).toPNG())
    await click('[aria-label="Settings"]')
    await click('[role="radio"]:first-child')
    await click('[aria-label="Home"]')
    await wait("document.documentElement.dataset.theme === 'dark'")
    await fs.writeFile(path.join(profile, 'messenger-tabs-dark.png'), (await win.webContents.capturePage()).toPNG())
    check('injected Messenger CSS follows the dark Mado palette', await messenger.webContents.executeJavaScript("getComputedStyle(document.body).getPropertyValue('--web-wash').trim() === '#0f0f1a'"))
    await click('[aria-label="Settings"]')
    await click('[role="radio"]:nth-child(2)')
    await click('[aria-label="Home"]')
    await wait("document.documentElement.dataset.theme === 'light'")

    win.maximize()
    await delay(300)
    check('maximized layout keeps the tab header above native content', await js("Math.abs(document.querySelector('.panel-header').getBoundingClientRect().bottom - 80) < 1") && messenger.getBounds().y === 80)
    await fs.writeFile(path.join(profile, 'messenger-maximized.png'), (await win.webContents.capturePage()).toPNG())
    win.unmaximize()
    win.setSize(1400, 900)
    await js("window.electronAPI.settings.set('messengerWidth', 420)")
    await delay(100)
    win.webContents.reload()
    await wait("document.querySelector('.messenger-panel')?.clientWidth === 419")
  }
  if (['v05', 'v06', 'v07'].includes(process.env.MADO_VERIFY_STAGE)) {
    const press = async (keyCode, modifiers = []) => {
      await win.webContents.focus()
      await win.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers })
      await win.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers })
      await delay(180)
    }
    check('desktop defaults keep normal exit and no tray', await js("window.electronAPI.desktop.getState().then(s => !s.trayActive && !s.closeToTray && !s.messengerUnread)"))
    await press('2', ['control'])
    check('Ctrl+2 opens Sources', await js("!!document.querySelector('.sources-view')"))
    await press('1', ['control'])
    check('Ctrl+1 opens Feed', await js("!!document.querySelector('.feed-area')"))
    await press('F', ['control', 'shift'])
    check('Ctrl+Shift+F focuses feed search', await js("document.activeElement?.getAttribute('aria-label') === 'Search articles'"))
    await press('M', ['control', 'shift'])
    await wait("!!document.querySelector('.messenger-tab')")
    check('Ctrl+Shift+M hides Messenger', true)
    await press('M', ['control', 'shift'])
    await wait("!!document.querySelector('.messenger-panel')")
    check('Ctrl+Shift+M restores Messenger', win.contentView.children.length > 0)

    await js("window.electronAPI.settings.set('trayEnabled', true)")
    await delay(250)
    check('tray icon can be enabled', await js("window.electronAPI.desktop.getState().then(s => s.trayActive)"))
    await js("window.electronAPI.settings.set('trayEnabled', false)")
    await delay(250)
    check('tray icon can be disabled', await js("window.electronAPI.desktop.getState().then(s => !s.trayActive)"))
    await js("window.electronAPI.settings.set('closeToTray', true)")
    await delay(250)
    check('close-to-tray implies a tray icon', await js("window.electronAPI.desktop.getState().then(s => s.trayActive && s.closeToTray)"))
    await js("window.electronAPI.settings.set('closeToTray', false)")
    await delay(250)
    const area = verificationDisplay.workArea
    const savedBounds = {
      x: area.x + 40,
      y: area.y + 40,
      width: Math.max(1000, Math.min(1100, area.width - 80)),
      height: Math.max(700, Math.min(780, area.height - 80)),
    }
    win.setBounds(savedBounds)
    await delay(700)
    const savedState = await js('window.electronAPI.desktop.getState()')
    check('window geometry is persisted after a debounced move/resize', Math.abs(savedState.windowState.x - savedBounds.x) <= 2 && Math.abs(savedState.windowState.y - savedBounds.y) <= 2 && savedState.windowState.maximized === false)
    await fs.writeFile(path.join(profile, 'window-secondary.png'), (await win.webContents.capturePage()).toPNG())

    win.maximize()
    await delay(700)
    check('maximized state is persisted', await js("window.electronAPI.desktop.getState().then(s => s.windowState.maximized === true)"))
    await fs.writeFile(path.join(profile, 'window-maximized.png'), (await win.webContents.capturePage()).toPNG())

    await js("window.electronAPI.messenger.markSeen()")
    await js("(() => { window.electronAPI.messenger.onUnreadChanged(() => {}); return true })()")
    check('unread indicator API is available and clear after mark-seen', await js("window.electronAPI.desktop.getState().then(s => s.messengerUnread === false)"))
    await fs.writeFile(path.join(profile, 'desktop-settings.png'), (await win.webContents.capturePage()).toPNG())
  }
  if (process.env.MADO_VERIFY_STAGE === 'v06') {
    const icoFrames = name => {
      const file = readFileSync(path.resolve('assets', name))
      const count = file.readUInt16LE(4)
      return Array.from({ length: count }, (_, index) => file[6 + index * 16] || 256)
    }
    const iconsLoad = ['icon-small.ico', 'icon-unread-small.ico']
      .every(name => !nativeImage.createFromPath(path.resolve('assets', name)).isEmpty())
    const frames = [...icoFrames('icon-small.ico'), ...icoFrames('icon-unread-small.ico')]
    check('small window/tray icons load from their optimized ICO frames', iconsLoad && frames.length === 6 && frames.every(size => [16, 24, 32].includes(size)))
    win.unmaximize()
    win.setSize(1400, 900)
    await delay(200)
    await click('[aria-label="Sources"]')
    await wait("!!document.querySelector('.source-type-tabs')")
    check('Sources offers RSS, YouTube and Reddit source types', await js("document.querySelectorAll('.source-type-tab').length === 3 && !!document.querySelector('[aria-label=\"Add feed\"]')"))
    await js("window.electronAPI.feeds.add('UCabcdefghijklmnopqrstuv', 'youtube')")
    win.webContents.reload()
    await wait("!!document.querySelector('.feed-area')")
    await click('[aria-label="Sources"]')
    await wait("document.querySelectorAll('.feed-item').length === 2")
    check('YouTube channel is stored as a typed source', await js("Array.from(document.querySelectorAll('.feed-item')).some(item => item.textContent.includes('youtube'))"))
    await click('[aria-label="Home"]')
    await wait("document.querySelectorAll('.article-card').length > 0")
    await wait("document.querySelectorAll('.article-card.content-video').length > 0")
    check('YouTube video appears with a play indicator in the unified feed', await js("!!document.querySelector('.article-card.content-video .play-indicator') && document.querySelector('.article-card.content-video .card-title').textContent.includes('Video One')"))
    await fs.writeFile(path.join(profile, 'unified-feed-youtube.png'), (await win.webContents.capturePage()).toPNG())
    await js("window.electronAPI.feeds.add('technology', 'reddit')")
    win.webContents.reload()
    await wait("document.querySelectorAll('.article-card').length > 0")
    await wait("document.querySelectorAll('.article-card.content-post, .article-card.content-image').length > 0")
    check('Reddit post appears in the same chronological feed', await js("!!document.querySelector('.article-card .source-type-badge.reddit, .article-card.content-post, .article-card.content-image')"))
    await fs.writeFile(path.join(profile, 'unified-feed-mixed.png'), (await win.webContents.capturePage()).toPNG())

    await js("(() => { const s=document.querySelector('[aria-label=\"Filter by source type\"]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'youtube'); s.dispatchEvent(new Event('change',{bubbles:true})); return true })()")
    await wait("document.querySelectorAll('.article-card').length === 1 && !!document.querySelector('.article-card.content-video')")
    check('source-type filter shows only videos', true)
    await js("(() => { const s=document.querySelector('[aria-label=\"Filter by source type\"]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'all'); s.dispatchEvent(new Event('change',{bubbles:true})); return true })()")
    await wait("document.querySelectorAll('.article-card').length > 2")
    await js("document.querySelector('.feed-container').scrollTop = 400")
    const unifiedScroll = await js("document.querySelector('.feed-container').scrollTop")
    await click('.article-card.content-video .card-title')
    await wait("!!document.querySelector('.video-view')")
    check('video item opens a user-initiated viewer with no embedded player', await js("!!document.querySelector('.video-view button') && !document.querySelector('iframe, video') && document.documentElement.dataset.theme === 'light'"))
    await fs.writeFile(path.join(profile, 'video-reader.png'), (await win.webContents.capturePage()).toPNG())
    await click('.reader-toolbar button:first-child')
    await wait("!document.querySelector('.article-reader')")
    check('Back to Feed keeps the unified feed scroll position', await js(`document.querySelector('.feed-container').scrollTop === ${unifiedScroll}`))
    await click('.article-card.content-post .card-title, .article-card.content-image .card-title')
    await wait("!!document.querySelector('.reader-discussion')")
    check('Reddit post shows supplied text and an explicit discussion action', await js("document.querySelector('.reader-body').textContent.includes('controlled Reddit post body') && document.querySelector('.reader-discussion').textContent.includes('View Discussion')"))
    await fs.writeFile(path.join(profile, 'reddit-reader.png'), (await win.webContents.capturePage()).toPNG())
    await click('.reader-toolbar button:first-child')

    await js('window.electronAPI.app.reset()')
    await wait("window.electronAPI.feeds.get().then(feeds => feeds.length === 6)")
    check('Reset All Data restores defaults without arbitrary settings keys', await js("window.electronAPI.feeds.get().then(feeds => feeds.every(feed => feed.type === 'rss')) && window.electronAPI.settings.get().then(settings => settings.theme === 'dark' && settings.reset === undefined)"))
  }
  if (process.env.MADO_VERIFY_STAGE === 'v07') {
    const feedUrl = await js("window.electronAPI.feeds.get().then(f => f[0].url)")
    const categoryResult = await js("window.electronAPI.categories.create('Gaming').then(r => JSON.stringify({ id: r.category?.id, count: r.categories.length }))")
    const categoryId = JSON.parse(categoryResult).id
    check('categories can be created and listed', !!categoryId && JSON.parse(categoryResult).count === 1)
    await js(`window.electronAPI.categories.assign(${JSON.stringify(feedUrl)}, [${JSON.stringify(categoryId)}])`)
    check('category assignments ignore unknown ids', await js(`window.electronAPI.categories.assign(${JSON.stringify(feedUrl)}, [${JSON.stringify(categoryId)}, 'cat:missing']).then(f => f[0].categoryIds.length === 1)`))
    check('category rename and delete preserve subscriptions', await js(`window.electronAPI.categories.rename(${JSON.stringify(categoryId)}, 'Games').then(() => window.electronAPI.categories.remove(${JSON.stringify(categoryId)})).then(r => r.feeds.length === 1 && r.categories.length === 0)`))
    const beforeSave = JSON.parse(await js("window.electronAPI.articles.get().then(a => JSON.stringify({ id: a[0].id, read: a[0].isRead }))"))
    check('saving keeps read status unchanged', await js(`window.electronAPI.articles.get().then(a => window.electronAPI.saved.save(a[0])).then(saved => window.electronAPI.articles.get().then(next => saved !== null && next.find(x => x.id === ${JSON.stringify(beforeSave.id)}).isRead === ${beforeSave.read}))`))
    await js('window.electronAPI.articles.get()')
    await js("window.electronAPI.settings.set('feedFilterMode', 'saved')")
    win.webContents.reload()
    await wait("!!document.querySelector('.article-card') && !!document.querySelector('[aria-label=\"Show saved items\"]')")
    check('saved filter shows saved content after restart', await js("document.querySelectorAll('.article-card').length === 1 && !!document.querySelector('.article-card.saved')"))
    await js("window.electronAPI.settings.set('feedFilterMode', 'all')")
    win.webContents.reload()
    await wait("!!document.querySelector('.feed-area')")
    await js("window.electronAPI.views.create({ name: 'Tech Desk', categoryIds: [], sourceIds: [], contentTypes: [], typeFilter: 'all' })")
    check('custom feed views persist and can be renamed/deleted', await js(`window.electronAPI.views.get().then(views => {
      const id = views[0]?.id;
      return !!id && window.electronAPI.views.update(id, { name: 'Desk' }).then(() => window.electronAPI.views.get()).then(next => next[0]?.name === 'Desk' && window.electronAPI.views.remove(id)).then(remaining => remaining.length === 0)
    })`))
    const discovery = await js("window.electronAPI.sources.discover('https://example.org/discover').then(r => JSON.stringify({ count: r.sources.length, kind: r.sources[0]?.kind, message: r.message }))")
    const discoveryResult = JSON.parse(discovery)
    check('source discovery finds advertised RSS feeds', discoveryResult.count === 1 && discoveryResult.kind === 'rss' && /feed/i.test(discoveryResult.message))
    await click('[aria-label="Sources"]')
    await wait("!!document.querySelector('.organize-section')")
    check('Sources exposes categories, custom feeds and OPML actions', await js("!!document.querySelector('[aria-label=\"New category name\"]') && !!document.querySelector('[aria-label=\"New feed name\"]') && !!document.querySelector('[aria-label=\"Import OPML\"]') && !!document.querySelector('[aria-label=\"Export OPML\"]')"))
    await fs.writeFile(path.join(profile, 'v07-sources.png'), (await win.webContents.capturePage()).toPNG())
    await click('[aria-label="Home"]')
    await wait("!!document.querySelector('.feed-area')")
    await click('[aria-label="Advanced filters"]')
    check('advanced filters expose date presets', await js("document.querySelectorAll('[aria-label=\"Date presets\"] button').length === 3"))
    check('config export API is available', await js("typeof window.electronAPI.config.export === 'function'"))
    await click('[aria-label="Show saved items"]')
    await wait("document.querySelector('.saved-filter-btn')?.getAttribute('aria-pressed') === 'true'")
    await wait("!!document.querySelector('[aria-label=\"Saved sort\"]')")
    check('saved view exposes sorting control', await js("document.querySelector('[aria-label=\"Saved sort\"]').options.length === 3"))
    await click('[aria-label="Show saved items"]')
    check('saved item survives unsave round trip', await js(`(async () => { const items = await window.electronAPI.articles.get(); await window.electronAPI.saved.unsave(items[0].id); const next = await window.electronAPI.articles.get(); return next.some(x => x.saved) === false })()`))

    // V0.9 first-run and update checks.
    await js("window.electronAPI.settings.set('onboardingComplete', false)")
    win.webContents.reload()
    await wait("!!document.querySelector('[role=\"dialog\"]')")
    check('first-run guide introduces feed, messenger and rules', await js("document.querySelectorAll('.onboarding-concepts article').length === 3"))
    check('first-run guide moves focus into the dialog', await js("document.activeElement?.closest('[role=\"dialog\"]') !== null"))
    await click('.onboarding-secondary')
    await wait("!document.querySelector('[role=\"dialog\"]')")
    check('first-run guide can be skipped and remembered', await js("window.electronAPI.settings.get().then(s => s.onboardingComplete === true)"))
    await click('[aria-label="Settings"]')
    await wait("!!document.querySelector('[aria-label=\"Check for updates\"]')")
    check('update check reports no configured endpoint', await js("window.electronAPI.updates.check().then(r => r.configured === false && r.available === false && r.releaseUrl === null)"))
    await click('[aria-label="Check for updates"]')
    await wait("!!document.querySelector('.update-result')")
    check('update result is shown in Settings', await js("document.querySelector('.update-result').textContent.includes('No official release source')"))
    await click('[aria-label="Reopen welcome guide"]')
    await wait("!!document.querySelector('[role=\"dialog\"]')")
    await click('.onboarding-secondary')
  }
  await delay(400) // Finish queued preference writes before the restart check.
  await fs.writeFile(path.join(profile, 'results.json'), JSON.stringify({ checks: logs, external }, null, 2))
  console.log('ELECTRON VERIFICATION PASSED')
  if (!process.env.MADO_VERIFY_HOLD) { server.close(); app.quit() }
} catch (error) {
  console.error(error)
  await fs.writeFile(path.join(profile, 'failure.txt'), error.stack)
  server.close(); app.exit(1)
}

}
run().catch(error => { console.error(error); app.exit(1) })
