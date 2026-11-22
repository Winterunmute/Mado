# Mado V0.8 — Performance, Stability & UX Polish

## 1. Baseline assessment

- Verified the V0.7 working tree before changes: `typecheck`, `build`, and 32/32 unit tests passed.
- Git was already initialized with a V0.6 remote. A local-only baseline commit was created: `6085c3d` (`Mado V0.7: categories, saved content, custom feeds, OPML and discovery`). No push, remote change, or history rewrite was performed.
- Inspected the existing Electron GUI harness (`scripts/verify-electron.mjs`) and deterministic fixtures.
- V0.7 GUI guarantees were recorded as 67/67; V0.8 adds checks and reaches 70/70.

## 2. Performance measurements

Added `scripts/benchmark.mjs` (`npm run benchmark`) for deterministic local measurement with 5,000 mixed RSS/YouTube/Reddit-shaped items.

| Operation | Before | After | Change |
|---|---:|---:|---:|
| Combined filter, 5k items (100 runs) | 0.350 ms avg | 0.370 ms avg | within noise |
| Source dedupe, 5k items (20 runs) | 0.500 ms avg | 0.600 ms avg | within noise |
| Source normalize, 40 sources (100 runs) | 0.030 ms avg | 0.020 ms avg | within noise |
| Saved-map normalize, 500 items (50 runs) | 4.940 ms avg | 1.460 ms avg | ~70% faster |
| Mark-all-read lookup, 5k × 500 (20 runs) | 11.000 ms avg | 0.200 ms avg | ~98% faster |

The combined filter itself was already fast; the meaningful renderer bottleneck was repeated filtering and rendering on every keystroke. `FeedArea` now memoizes filter options/results and uses `useDeferredValue` for search input, while rendering the first 100 results with a “Show 100 more” control. Small feeds are unaffected; large collections avoid mounting thousands of cards at once. No virtualization library, database, or state library was introduced.

## 3. Confirmed bugs and fixes

- **Saved-map normalization was slow** because each character was filtered into a new array. Replaced with a compiled control-character regular expression and retained truncation limits.
- **Mark-all-read used `Array.includes` inside a 5,000-item map.** Replaced with a `Set`, with a benchmark showing the improvement above.
- **RSS source add accepted private-network URLs.** `feeds:add` now uses the existing `publicWebUrl` guard, rejecting loopback, link-local, private, credential-bearing, and non-HTTP(S) targets. A verification-only `MADO_ALLOW_LOCAL_SOURCES=1` flag lets deterministic fixture tests use 127.0.0.1; packaged builds never set it.
- **Stale status information:** the Settings data list omitted V0.7 saved/category/view files and the reset hint understated what is cleared. Updated.
- **Electron verification hard-coded the V0.7 output path and missed new controls.** Added V0.8 checks to the V0.7 stage and repaired fixture expectations after the Electron upgrade.

## 4. UX improvements

- Saved view now has sorting controls: **Newest first**, **Oldest first**, and **Title A–Z**, persisted as `savedSort`.
- Date filtering includes **Today**, **Last 7 Days**, and **Last 30 Days** presets using local dates; custom date inputs remain available.
- Custom-feed editor now exposes the existing provider/source-type constraint (`All`, RSS, YouTube, Reddit).
- Active custom views and the Saved view are shown in the feed title.
- Large filtered feeds render incrementally with a clear “X of Y” count and an explicit “Show 100 more” action.
- No ranking, recommendations, autoplay, or engagement-based ordering was added.

## 5. Source-adapter reliability

- Verified RSS/Atom, YouTube, Reddit, unified refresh caching, concurrent refresh with bounded parallelism, failure isolation, stable IDs, read-state persistence, duplicate handling, OPML validation, and discovery fixtures through the existing suites.
- Live-source results are unchanged from V0.6/V0.7: a live YouTube channel feed parsed successfully with thumbnails; Reddit remained blocked/rate-limited (404/429) from this environment. Mado treats that as a platform/network limitation, not a source failure that affects RSS or YouTube.
- The private-address guard was applied to the remaining RSS add path. Reader extraction, source discovery, OPML import, and article image requests already used public-address validation with bounded redirects.

## 6. Security and dependency findings

- `npm audit --omit=dev`: **0 production vulnerabilities** after upgrades.
- Upgraded `sanitize-html` from 2.11.0 to 2.18.2 to address the published moderate advisories affecting <=2.17.7. Existing sanitizer tests still pass.
- Upgraded Electron from 31.7.7 to 45.4.1 and electron-builder from 24.13.3 to 26.18.0. The jump was required because sanitize-html 2.18 uses ESM-only htmlparser2, which Electron 31's Node 20 cannot `require`; Electron 45's newer Node runtime resolves this. WebContentsView, preload, IPC, notifications, tray, session isolation, and all GUI suites were re-verified.
- Remaining audit findings are development/build-time only: esbuild/Vite dev-server advisory and minimatch advisory through electron-builder's packaging helpers. No forced upgrade was run; Vite 8 would be a broad breaking migration.
- Reconfirmed: context isolation, sandboxing, no Node integration for remote pages, strict Messenger navigation policy, isolated `persist:messenger` partition, external-link validation, bounded redirects, SSRF checks, article sanitization, CSP, and confirmation-gated reset.

## 7. Storage and backup changes

- Added **Export Mado Configuration** in Settings. It writes a native-dialog-selected JSON file containing subscriptions, categories, saved items, custom views, and preferences.
- The export explicitly excludes Messenger cookies, tokens, session data, and messages.
- Reset text now accurately describes V0.7 data stores and still preserves the Messenger session.

## 8. Automated test results

| Check | Result |
|---|---|
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run build` | PASS |
| `npm.cmd test` | PASS, 32/32 |
| `npm run benchmark` | PASS, deterministic fixture output above |
| `npm audit --omit=dev` | 0 vulnerabilities |

## 9. Electron GUI verification

All stages ran with isolated `.verification/*` profiles and deterministic local fixtures:

| Stage | Result |
|---|---|
| V0.3 | 31/31 |
| V0.4 | 46/46 |
| V0.5 | 58/58 |
| V0.5 restart | 6/6 |
| V0.6 | 68/68 |
| V0.7 (including V0.8 additions) | 70/70 |

New V0.8 GUI checks cover date presets, config export API availability, Saved sorting UI, and unsave round-trip. Screenshots were captured by the harness, but this session could not visually inspect images; layout claims rest on DOM and computed-style assertions. Stale `failure.txt` files from earlier failed iterations remain until release cleanup.

## 10. Real-world checks and remaining manual tests

- Not automated: real native save dialog for config export, real website discovery, live Facebook login/Messenger rendering, tray/notification behavior with an authenticated account, multi-monitor layouts, and real uninstall/reinstall behavior.
- Screenshots in `.verification/v07/` are available for later visual review.
- No real Facebook credentials or personal profiles were used.

## 11. Known limitations

- Saved snapshots preserve metadata, not vanished full article/video content.
- Custom-view source-type constraint is now exposed only when creating a view; editing reuses creation state rather than a dedicated edit form.
- Search deferral and incremental rendering improve large feeds but were not profiled with a real 100k-item account.
- Dev-only dependency advisories remain; production dependencies are clean.
- Electron 45 is a large jump from 31. All available automated regressions pass, but real-world Windows behavior still needs beta verification.

## 12. Recommended V0.9 tasks

1. Build and test a proper NSIS installer with Mado icons and version 0.9.0.
2. Verify install, restart, upgrade-over-old-version, uninstall, and data retention with isolated profiles.
3. Add a safe “Check for Updates” action with no configured endpoint by default.
4. Add lightweight first-run onboarding and reopenable help.
5. Prepare privacy, attribution, changelog, and release-checklist documentation.
6. Complete packaged-app regression checks and a release-candidate report.
