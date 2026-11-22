// Update checks use the official public Mado repository. A different trusted
// GitHub Releases endpoint can be supplied at build/test time with MADO_RELEASES_API.

export interface ReleaseSource {
  apiUrl: string
  releaseUrl: string
}

export interface UpdateCheckResult {
  configured: boolean
  available: boolean
  currentVersion: string
  latestVersion: string | null
  releaseUrl: string | null
  message: string
}

const RELEASE_API = /^https:\/\/api\.github\.com\/repos\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/releases\/latest$/
const OFFICIAL_RELEASE_API = 'https://api.github.com/repos/Winterunmute/Mado/releases/latest'

export function configuredRelease(): ReleaseSource | null {
  const raw = process.env.MADO_RELEASES_API?.trim() || OFFICIAL_RELEASE_API
  if (!raw) return null
  const match = RELEASE_API.exec(raw)
  if (!match) return null
  return {
    apiUrl: raw,
    releaseUrl: `https://github.com/${match[1]}/${match[2]}/releases/latest`,
  }
}

export function compareVersions(left: string, right: string): number {
  const parse = (value: string) => value.replace(/^v/, '').split(/[-+]/)[0].split('.').map(Number)
  const a = parse(left)
  const b = parse(right)
  for (let index = 0; index < 3; index++) {
    const difference = (a[index] || 0) - (b[index] || 0)
    if (difference !== 0) return difference
  }
  return 0
}

export async function checkForUpdates(
  currentVersion: string,
  source: ReleaseSource | null = configuredRelease(),
): Promise<UpdateCheckResult> {
  if (!source) {
    return {
      configured: false,
      available: false,
      currentVersion,
      latestVersion: null,
      releaseUrl: null,
      message: 'No official release source is configured for this build.',
    }
  }
  try {
    const response = await fetch(source.apiUrl, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Mado-Updater' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) throw new Error(`Release source returned ${response.status}`)
    const payload = await response.json() as { tag_name?: unknown }
    const tag = typeof payload.tag_name === 'string' ? payload.tag_name : ''
    const match = /^v?(\d+\.\d+\.\d+)/.exec(tag)
    if (!match) throw new Error('Release source did not provide a valid version')
    const latestVersion = match[1]
    const available = compareVersions(latestVersion, currentVersion) > 0
    return {
      configured: true,
      available,
      currentVersion,
      latestVersion,
      releaseUrl: source.releaseUrl,
      message: available
        ? `Mado ${latestVersion} is available.`
        : `Mado ${currentVersion} is up to date.`,
    }
  } catch (error) {
    return {
      configured: true,
      available: false,
      currentVersion,
      latestVersion: null,
      releaseUrl: null,
      message: `Update check failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    }
  }
}
