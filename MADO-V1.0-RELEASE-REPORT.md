# Mado V1.0 — Release Report

## 1. V1.0 changes

- YouTube `@handle`, `youtube.com/@handle`, `www.youtube.com/@handle`, scheme-less channel URLs and canonical IDs resolve to stable channel IDs and RSS feed URLs.
- Reddit subscriptions now use the canonical `/r/<name>/.rss` endpoint and degrade gracefully when Reddit returns 404/429; provider-specific messages and an **Open on Reddit** action were added.
- Official GitHub Releases update source configured for `Winterunmute/Mado`.
- MIT license added with copyright holder Rickard Borchers.
- GitHub Actions workflows added for Windows build verification and tagged release publication.
- Historical per-version reports were consolidated into `ARCHITECTURE.md`, `DEVELOPMENT.md`, `CHANGELOG.md`, `README.md`, `PRIVACY.md`, `THIRD_PARTY_NOTICES.md` and `RELEASE_CHECKLIST.md`.

## 2. YouTube outcome

`resolveYouTubeChannelAsync` uses the existing bounded public-page fetch (12s timeout, 2MB cap, public DNS checks) to find a canonical `channel/UC...` ID from a public handle page, then builds the standard YouTube RSS URL. No private API, authentication bypass or paid service is used.

Live check passed:

- `https://www.youtube.com/@TheSergeantSteve` → `UCuobtuGxJny9V5lX5a1ieuw`
- `youtube.com/@TheSergeantSteve` and `www.youtube.com/@TheSergeantSteve` → same ID
- Public channel feed returned 15 videos with titles.

## 3. Reddit outcome

Live checks from this environment returned 404 for `www.reddit.com/r/<name>/.rss`, 429 for `/new/.rss`, and 200 HTML (not RSS) for `old.reddit.com`. No compliant direct fetch path is reliably available here. Mado now keeps Reddit subscriptions, explains provider-specific failures, opens the community on Reddit, and never surfaces a raw IPC status error for expected 404/429 cases. Other source types remain unaffected.

## 4. Confirmed fixes and regression testing

| Check | Result |
|---|---|
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run build` | PASS |
| `npm.cmd test` | PASS, 36/36 |
| `npm run benchmark` | PASS |
| `npm audit --omit=dev` | 0 vulnerabilities |
| V0.3 GUI | 31/31 |
| V0.4 GUI | 46/46 |
| V0.5 GUI | 58/58 |
| V0.5 restart | 6/6 |
| V0.6 GUI | 68/68 |
| V0.7 GUI | 75/75 |

The first combined GUI run hit a transient `UnknownVizError` in V0.3/V0.4; both stages passed on isolated reruns with the same flags. No code change was required.

## 5. Security and privacy verification

- No high-confidence secrets (GitHub tokens, AWS keys, private keys, client secrets) were found in tracked files across all Git commits.
- Benign fixtures containing `user:pass@example` strings were reviewed and are test-only.
- Historical reports contained local developer paths but no credentials, Messenger data or private content.
- Electron security settings, IPC validation, public-address checks, sanitizer, CSP and Messenger isolation were reconfirmed.
- `PRIVACY.md` was finalized for public release.

## 6. Repository cleanup and license

- Obsolete per-version reports and handoffs were removed from the working tree; their history remains in Git.
- Consolidated documentation is listed in README.
- MIT license confirmed by the owner and added as `LICENSE` with copyright `2026 Rickard Borchers`.

## 7. Windows installer results

- `release/Mado-Setup-1.0.0.exe`, 127,557,023 bytes.
- Packaged executable metadata: `Mado`, `1.0.0.0`, author Rickard Borchers.
- ASAR contains compiled application files, renderer, preloads and Mado icons; no root reports, tests, source, verification profiles or Git metadata.
- Isolated packaged-app smoke test passed.
- SHA-256: `c229d1dfcf7fcaf445d6022c89e6348e4af43574eeb82bef368e630460d5d65c`

## 8. GitHub Actions

- `.github/workflows/build.yml` validates pushes and PRs with `npm ci`, typecheck, build, tests and an installer artifact. No release permissions.
- `.github/workflows/release.yml` triggers only on `v*.*.*` tags, verifies the tag matches package version, runs the same gates, packages, computes `SHA256SUMS.txt`, refuses duplicate releases and publishes installer/checksum with `GITHUB_TOKEN`.

## 9. Repository and release publication

- Repository: https://github.com/Winterunmute/Mado
- Intended final visibility: public
- Release tag: `v1.0.0`
- Release title: `Mado v1.0.0 — Your Window to the World`
- Installer URL: https://github.com/Winterunmute/Mado/releases/download/v1.0.0/Mado-Setup-1.0.0.exe

## 10. Update-check integration

The app now checks `https://api.github.com/repos/Winterunmute/Mado/releases/latest` and links to `https://github.com/Winterunmute/Mado/releases/latest`. It compares stable versions and never downloads or installs executables. Before the release existed, the live check correctly reported the missing release; after publication, it should report Mado 1.0.0 as up to date.

## 11. Manual verification still required

- Clean Windows 10/11 machine installation and upgrade over an older installation.
- Real Facebook Messenger login, conversations and attachments.
- Windows notifications, tray behavior and multi-monitor restoration.
- Windows SmartScreen behavior for the unsigned installer.
- Live Reddit availability from the target user's network.

## 12. Known limitations and future improvements

- Installer is unsigned; SmartScreen warnings are expected until code signing is configured.
- Reddit RSS may remain unavailable due to platform/network restrictions.
- Messenger real-account behavior cannot be safely automated.
- A stable signed release pipeline with a code-signing certificate is the primary V1.1 preparation task.
