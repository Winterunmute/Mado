import test from 'node:test'
import assert from 'node:assert/strict'
import { checkForUpdates, compareVersions, configuredRelease } from '../dist/main/updates.js'

test('update checking is unavailable when no trusted release source is configured', async () => {
  delete process.env.MADO_RELEASES_API
  const result = await checkForUpdates('0.9.0')
  assert.equal(result.configured, false)
  assert.equal(result.available, false)
  assert.equal(result.releaseUrl, null)
  assert.match(result.message, /No official release source/)
})

test('configured release source only accepts GitHub releases latest API', () => {
  process.env.MADO_RELEASES_API = 'https://api.github.com/repos/Winterunmute/Mado/releases/latest'
  assert.deepEqual(configuredRelease(), {
    apiUrl: 'https://api.github.com/repos/Winterunmute/Mado/releases/latest',
    releaseUrl: 'https://github.com/Winterunmute/Mado/releases/latest',
  })
  process.env.MADO_RELEASES_API = 'https://example.org/latest'
  assert.equal(configuredRelease(), null)
  delete process.env.MADO_RELEASES_API
})

test('semver comparison works for update decisions', () => {
  assert.equal(compareVersions('0.10.0', '0.9.0'), 1)
  assert.equal(compareVersions('v0.9.0', '0.9.0'), 0)
  assert.equal(compareVersions('0.8.9', '0.9.0'), -1)
})
