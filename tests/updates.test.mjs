import test from 'node:test'
import assert from 'node:assert/strict'
import { checkForUpdates, compareVersions, configuredRelease } from '../dist/main/updates.js'

const source = {
  apiUrl: 'https://api.github.com/repos/Winterunmute/Mado/releases/latest',
  releaseUrl: 'https://github.com/Winterunmute/Mado/releases/latest',
}

test('official GitHub release source is configured by default', () => {
  delete process.env.MADO_RELEASES_API
  assert.deepEqual(configuredRelease(), source)
})

test('release source rejects malformed or untrusted URLs', () => {
  process.env.MADO_RELEASES_API = 'https://example.org/latest'
  assert.equal(configuredRelease(), null)
  process.env.MADO_RELEASES_API = 'http://api.github.com/repos/Winterunmute/Mado/releases/latest'
  assert.equal(configuredRelease(), null)
  delete process.env.MADO_RELEASES_API
})

test('update check handles latest, outdated, invalid metadata and API errors', async () => {
  const originalFetch = globalThis.fetch
  const withFetch = async (payload, status = 200) => {
    globalThis.fetch = async () => ({ ok: status >= 200 && status < 300, status, json: async () => payload })
    return checkForUpdates('1.0.0', source)
  }
  try {
    assert.match((await withFetch({ tag_name: 'v1.0.0' })).message, /up to date/)
    const newer = await withFetch({ tag_name: 'v1.1.0' })
    assert.equal(newer.available, true)
    assert.equal(newer.latestVersion, '1.1.0')
    assert.equal(newer.releaseUrl, source.releaseUrl)
    assert.match((await withFetch({ tag_name: 'not-a-version' })).message, /failed/i)
    assert.match((await withFetch({}, 503)).message, /503/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('semver comparison works for update decisions', () => {
  assert.equal(compareVersions('0.10.0', '0.9.0'), 1)
  assert.equal(compareVersions('v1.0.0', '1.0.0'), 0)
  assert.equal(compareVersions('0.8.9', '0.9.0'), -1)
})
