import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'

async function sourceModule(path) {
  const source = await fs.readFile(new URL(path, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  })
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
}

const {
  conversationKeyFromUrl,
  isConversationUrl,
  conversationLabel,
  locationFromUrl,
  sanitizeConversationTabs,
  MESSENGER_LIST_URL,
} = await sourceModule('../src/main/conversation-tabs.ts')

test('conversation keys accept known Messenger path shapes and reject unsafe URLs', () => {
  assert.equal(conversationKeyFromUrl('https://www.facebook.com/messages/t/123/'), 't/123')
  assert.equal(conversationKeyFromUrl('https://facebook.com/messages/abc-def?lid=1'), 'abc-def')
  assert.equal(conversationKeyFromUrl('https://www.facebook.com/messages/t/123/?x=1#frag'), 't/123')
  assert.equal(conversationKeyFromUrl('https://www.facebook.com/messages/e2ee/t/abcdefghijklmnop/'), 'e2ee/t/abcdefghijklmnop')
  assert.equal(conversationKeyFromUrl(MESSENGER_LIST_URL), null)
  for (const url of [
    'https://www.facebook.com/',
    'https://www.facebook.com/home.php',
    'https://m.facebook.com/messages/t/123/',
    'http://www.facebook.com/messages/t/123/',
    'https://facebook.com.evil.example/messages/t/123/',
    'https://user:pass@facebook.com/messages/t/123/',
    'javascript:alert(1)',
    'not a url',
  ]) {
    assert.equal(conversationKeyFromUrl(url), null, url)
    assert.equal(isConversationUrl(url), false, url)
  }
})

test('fallback labels and location metadata are compact and safe', () => {
  assert.equal(conversationLabel('t/123456789012345'), 'Chat 123456789012')
  const location = locationFromUrl('https://www.facebook.com/messages/t/123/')
  assert.deepEqual(location, {
    url: 'https://www.facebook.com/messages/t/123/',
    key: 't/123',
    isList: false,
  })
  assert.deepEqual(locationFromUrl(MESSENGER_LIST_URL), {
    url: MESSENGER_LIST_URL,
    key: null,
    isList: true,
  })
  assert.deepEqual(locationFromUrl('https://www.facebook.com/home.php'), {
    url: null,
    key: null,
    isList: false,
  })
})

test('saved tabs are validated, deduplicated, pinned first and safely labelled', () => {
  const tabs = sanitizeConversationTabs([
    { id: 'a', key: 't/1', url: 'https://www.facebook.com/messages/t/1/', label: '  Ada  ', pinned: false },
    { id: 'b', key: 't/2', url: 'https://www.facebook.com/messages/t/2/', label: 'Bob', pinned: true },
    { id: 'e', key: 'e2ee/t/abcdefghijklmnop', url: 'https://www.facebook.com/messages/e2ee/t/abcdefghijklmnop/', label: 'Encrypted', pinned: false },
    { id: 'c', key: 't/1', url: 'https://www.facebook.com/messages/t/1/', label: 'Duplicate', pinned: true },
    { id: 'bad', key: 't/9', url: 'https://www.facebook.com/home.php', label: 'Bad', pinned: true },
    { id: 'wrong', key: 't/8', url: 'https://www.facebook.com/messages/t/7/', label: 'Wrong key', pinned: false },
    { id: 'script', key: 't/6', url: 'javascript:alert(1)', label: 'Script', pinned: false },
    { id: 'long', key: 't/5', url: 'https://www.facebook.com/messages/t/5/', label: 'x'.repeat(80), pinned: false },
  ])
  assert.deepEqual(tabs.map(tab => tab.id), ['b', 'a', 'e', 'long'])
  assert.equal(tabs[0].pinned, true)
  assert.equal(tabs[1].label, 'Ada')
  assert.equal(tabs[2].key, 'e2ee/t/abcdefghijklmnop')
  assert.equal(tabs[3].label.length, 40)
  assert.deepEqual(sanitizeConversationTabs('not an array'), [])
})
