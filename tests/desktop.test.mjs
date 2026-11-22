import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'

async function module(path) {
  const source = await fs.readFile(new URL(path, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  })
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
}

const {
  sanitizeWindowState,
  resolveWindowBounds,
  centerOnDisplay,
  stateFromBounds,
} = await module('../src/main/window-state.ts')
const { actionForInput, SHORTCUT_HELP } = await module('../src/main/shortcuts.ts')
const {
  isNotificationOriginAllowed,
  unreadCountFromTitle,
  shouldShowUnreadNotification,
} = await module('../src/main/notification-policy.ts')

const displays = [
  { id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1040 } },
  { id: 2, workArea: { x: 1920, y: 0, width: 1280, height: 700 } },
]

test('saved window state is clamped and maximized state is preserved', () => {
  const state = sanitizeWindowState({ x: -5000, y: -5000, width: 100, height: NaN, maximized: 'yes' })
  assert.deepEqual(state, { x: -5000, y: -5000, width: 1000, height: 900, maximized: false })
  assert.deepEqual(sanitizeWindowState(null), { x: null, y: null, width: 1400, height: 900, maximized: false })
  assert.equal(stateFromBounds({ x: 100, y: 120, width: 1200, height: 800 }, true).maximized, true)
})

test('off-screen geometry is recentered and visible geometry is kept', () => {
  const safe = sanitizeWindowState({ x: 9000, y: 9000, width: 1200, height: 800, maximized: false })
  assert.deepEqual(resolveWindowBounds(safe, displays, 1), centerOnDisplay(1200, 800, displays[0].workArea))
  const secondary = sanitizeWindowState({ x: 1960, y: 20, width: 1100, height: 720, maximized: false })
  assert.deepEqual(resolveWindowBounds(secondary, displays, 1), { x: 1960, y: 20, width: 1100, height: 720 })
})

test('shortcuts map only to the intended actions', () => {
  const base = { type: 'keyDown', control: true }
  assert.equal(actionForInput({ ...base, key: '1' }), 'open-feed')
  assert.equal(actionForInput({ ...base, key: '2' }), 'open-sources')
  assert.equal(actionForInput({ ...base, key: '3' }), 'open-settings')
  assert.equal(actionForInput({ ...base, key: 'r' }), 'refresh-feed')
  assert.equal(actionForInput({ ...base, shift: true, key: 'M' }), 'toggle-messenger')
  assert.equal(actionForInput({ ...base, shift: true, key: 'f' }), 'focus-search')
  assert.equal(actionForInput({ type: 'keyDown', key: 'Escape' }), 'back-from-reader')
  assert.equal(actionForInput({ ...base, key: 'm' }), null)
  assert.equal(actionForInput({ ...base, alt: true, key: '1' }), null)
  assert.equal(actionForInput({ type: 'keyUp', key: '1' }), null)
  assert.equal(SHORTCUT_HELP.length, 7)
})

test('notification policy uses only safe origins, numeric titles and cooldowns', () => {
  for (const url of [
    'https://www.facebook.com/messages/t/1/',
    'https://messenger.com/t/1',
  ]) assert.equal(isNotificationOriginAllowed(url), true)
  for (const url of [
    'https://facebook.com.evil.example/messages/',
    'http://www.facebook.com/messages/',
    'https://user:pass@facebook.com/messages/',
    'javascript:alert(1)',
  ]) assert.equal(isNotificationOriginAllowed(url), false)

  assert.equal(unreadCountFromTitle('(3) Messenger'), 3)
  assert.equal(unreadCountFromTitle('(120) Messenger'), 99)
  assert.equal(unreadCountFromTitle('Alice and Bob — Messenger'), 0)
  const options = { enabled: true, count: 2, previousCount: 1, messengerFocused: false, now: 20_000, lastNotifiedAt: 0 }
  assert.equal(shouldShowUnreadNotification(options), true)
  assert.equal(shouldShowUnreadNotification({ ...options, enabled: false }), false)
  assert.equal(shouldShowUnreadNotification({ ...options, messengerFocused: true }), false)
  assert.equal(shouldShowUnreadNotification({ ...options, previousCount: 2 }), false)
  assert.equal(shouldShowUnreadNotification({ ...options, now: 5_000 }), false)
})
