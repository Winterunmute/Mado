# Mado V0.3 — Finalize & Verify Report

**Date:** 2026-11-21
**Scope:** Finish and verify the already-implemented V0.3 work. No redesign, no feature additions, no architecture investigation, and no weakening of existing security protections.
**Outcome:** Buildable, tested, and ready for manual daily-use testing. No application bugs were found during final verification.

---

## 1. Existing findings confirmed

I first read `MADO-V0.2-REPORT.md`, the V0.2 reference review, the existing V0.3 verification harness/results, and the relevant implementation and test files. The reported state was accurate:

- V0.2 items (shared read state, unified read filter, theme system, dedicated Sources manager, scrolling fixes, Messenger resizing/navigation guards, relative Vite asset base, opt-in auto-refresh) are present in the code and covered by the v02/v03 GUI checks.
- V0.3 reader features are present: Mozilla Readability extraction in `src/main/reader.ts`, sanitization/URL safety in `src/main/reader-content.ts`, the in-app reader in `src/renderer/components/ArticleReader.tsx`, scroll-preserving Back to Feed in `FeedArea.tsx`, and RSS fallback/Open in Browser wiring through the preload and validated `shell:open-external` IPC handler.
- The prior agent's `.verification/v03/results.json` recorded a full `ELECTRON VERIFICATION PASSED` run. A stale `failure.txt` from an earlier pointer-drag attempt was also present; its timestamp predates the successful run and the successful run explicitly contains the pointer-drag check.

No existing reader, navigation, or Messenger code was rewritten.

---

## 2. Features actually completed in V0.3

- **In-app article reading** using `@mozilla/readability` with `linkedom` as an inert DOM. Articles open in the main area, not in a new window.
- **Back to Feed** with exact `feed-container` scroll restoration and focus return, including the All/Unread preference active when the article was opened.
- **Open in Browser** fallback routed through the main process's HTTP(S)-only, credential-rejecting `openExternalUrl()` validator.
- **RSS/Atom content fallback** when full-article fetching fails (blocked HTTP, paywall, timeout, non-HTML, private address, etc.), with a clear notice, publisher attribution, and browser action.
- **Light/dark reader styling** following the app theme and persisting across renderer reloads and full application restarts.
- **Reader security:** sanitized output only, resolved relative resource URLs, removal of scripts/events/styles/ids/media/forms/SVG, public-address checks on fetch and image requests (including redirects), DNS-rebinding-safe lookup, paywall/hidden-content respect, size/time limits, and a renderer autoplay policy requiring user activation.
- **Verification assets:** `scripts/verify-electron.mjs` (isolated fixture-driven Electron integration test), `tests/reader.test.mjs`, and captured screenshots/results under `.verification/v03/`.

---

## 3. Bugs discovered and fixes applied

**No application bugs were confirmed in this final pass.** The implementation under test behaved correctly for every item exercised.

One **verification coverage gap** was found and fixed in the test harness only:

- The existing Electron script checked Messenger resizing and native-view bounds but did **not** exercise collapse/reopen. I added two checks to `scripts/verify-electron.mjs`:
  - collapsing Messenger detaches the native `WebContentsView` and frees feed width;
  - reopening Messenger reattaches the same native view.
- I also extended the full-restart stage to assert that Messenger visibility and width survive an application restart.

These are test-only changes. No product source file was modified.

Cleanup performed:

- Removed the stale `.verification/v03/failure.txt` (a superseded failed-run artifact).
- Removed `.verification/npm-cache/` and `.verification/npm-logs/` (~2.9 MB of disposable npm cache/log files created by the earlier workaround).
- Preserved `.verification/build-path-hook.cjs`, both stage profiles (`v02`, `v03`), screenshots, `results.json`, and `restart-results.json`.

---

## 4. Build and unit test results

All commands ran from `C:\Users\Ricka\Desktop\Dev\Mado`. PowerShell's `npm.ps1` execution policy requires `npm.cmd`; `NODE_OPTIONS=--preserve-symlinks --preserve-symlinks-main` was used for the Node/esbuild path restriction in this environment.

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm.cmd run typecheck` | **Passed** (exit 0) |
| Build | `npm.cmd run build` | **Passed** — Vite renderer + both Electron TypeScript builds + preload copy |
| Unit/integration tests | `npm.cmd test` | **Passed** — 9 tests, 0 failures |

The 9 tests cover filter/read-state consistency, Messenger-only navigation classification (including redirects, malformed URLs, and unsafe schemes), Messenger CSS safety, Readability extraction, sanitizer rejection of active/local/unsafe content, paywall handling, private/credential URL rejection, and sanitized RSS fallback.

Unlike the earlier session, the full build succeeded without a temporary `subst` drive or `MADO_PRESERVE_SYMLINKS` hook; the symlink-related `NODE_OPTIONS` were sufficient. The documented `.verification/build-path-hook.cjs` remains available but was not needed.

---

## 5. Electron GUI verification results

Invocation used (isolated profile, controlled RSS/Messenger fixtures only):

```powershell
$env:MADO_VERIFY_STAGE='v03'
$env:NODE_OPTIONS='--preserve-symlinks --preserve-symlinks-main'
& '.\node_modules\.bin\electron.cmd' --no-sandbox --disable-gpu --in-process-gpu scripts/verify-electron.mjs

# then, to verify full-process restart persistence:
$env:MADO_VERIFY_RESTART='1'
& '.\node_modules\.bin\electron.cmd' --no-sandbox --disable-gpu --in-process-gpu scripts/verify-electron.mjs
```

The diagnostic flags are confined to this restricted sandbox harness; production sandbox settings were not changed. The harness intercepts only synthetic `example.org` article fixtures and a local Messenger-shaped page. No Facebook credentials, cookies, or conversations were accessed, inspected, exported, or logged.

**Stage 1: `ELECTRON VERIFICATION PASSED` — 31 checks.** Machine-readable results: `.verification/v03/results.json`.

Verified:

1. **RSS feeds load and display** — 24 readable, scrolling cards from a controlled RSS feed.
2. **Read/unread filters** — marking read immediately removes the card in Unread; refresh preserves read status; renderer reload restores Unread and persisted read state.
3. **Sources management** — dedicated subscription view, disable removes articles, re-enable restores them, Atom feed added with publisher title, duplicate-subscription error, remove without losing the other source.
4. **Settings scrolling** — independent scroll area and reachable final section at 1000×700.
5. **Light/dark themes** — light computed surface color applied, survives renderer reload, and dark reader palette applied through the UI.
6. **In-app article content** — extracted article with 20 clean headings, independent scroll, no scripts/media, and focus moved to the article heading.
7. **Back to Feed** — restores the exact saved `scrollTop` and the All preference.
8. **Fallback and Open in Browser** — HTTP 403 produces sanitized RSS-content fallback with notice/attribution; browser action dispatches only the validated original URL.
9. **Messenger while reading** — the same native `webContents` remains attached and usable while the reader is open.
10. **Resizing/collapsing** — native view bounds below titlebar/toolbar, keyboard resize, pointer drag, feed stays outside the panel at maximum width, collapse detaches the native view and frees width, reopen reattaches it.
11. **Navigation protection and recovery** — top-level Facebook home blocked; SPA home transition recovers to `/messages/`; blocked-navigation reporting remains wired.
12. **Security detail in the reader** — no injected script executed (`window.__readerScript` remains undefined), no `video`/`audio`/`iframe` in extracted content, no unsafe image/link URLs, no cookie or authorization headers on article fetches, and late article completion cannot replace a newer selection.

**Stage 2: full Electron process restart — 3 checks passed.** Machine-readable results: `.verification/v03/restart-results.json`.

- Light theme and Unread filter restored.
- Persisted read status restored.
- Messenger visibility and width restored.

Screenshots (dark/light feed, reader light/dark/fallback/minimum, settings minimum, sources, messenger) remain in `.verification/v03/`.

---

## 6. Remaining manual verification requirements

These cannot be established by the isolated fixtures and must be checked in normal daily use:

1. **Facebook login/checkpoint/2FA** and session persistence across a real full quit/relaunch. Do not automate with real credentials.
2. **Live Messenger conversation behavior:** switching threads, composer, attachments, images/video, reactions, and theme changes. Facebook's CSS variables and selectors are third-party interfaces and may need maintenance.
3. **Navigation edge cases:** real Facebook SPA route changes, history Back/Forward, login redirects, CAPTCHA/checkpoint routes, and whether the current route allowlist disrupts the user's account. Confirm **Back to Messenger** appears and recovers when navigation is blocked.
4. **Real external browser launch** from reader links, cards, and Messenger's Open in Browser action. The harness verifies the validated URL is passed to the shell handler but does not open a real browser.
5. **Autoplay in live content:** the app-level autoplay policy and sanitizer were verified, but real Messenger media playback should be observed once with a normal account.
6. **Real feeds:** confirm the six default feeds and user-added sources behave as expected with live network content; the harness uses controlled local fixtures.

**Manual smoke so far (2026-11-21):** after a normal launch produced no visible window in this tool sandbox, the app was relaunched with `--no-sandbox --disable-gpu --in-process-gpu`. The window titled **Mado (窓)** appeared and the user reported it looking good. That flagged instance later exited with no crash output; its log showed repeated `[Messenger] Load finished` events. No real Facebook login or conversation testing was performed in the flagged instance. The normal-sandbox terminal command in section 5 remains the recommended way to test a real account.

---

## 7. Known issues

- **Settings → Reset All Data is currently ineffective.** `Settings.tsx` calls `api.settings.set('reset', true)`, and the main-process `settings:set` handler simply persists that key; it does not clear feeds, read state, or settings. This was confirmed by source inspection, is outside the V0.3 verification scope, and was deliberately **not changed** here because implementing it would delete user data. Treat the button as non-functional until a dedicated, explicitly authorized reset IPC path is implemented.
- **Arbitrary setting keys are accepted** by `settings:set` (the `reset` symptom above). Not security-critical for the local IPC surface, but worth tightening with an allowlist later.
- **README is stale in minor places:** it describes version 0.1.0 installer output and does not list the V0.3 in-app reader. Functional documentation was not changed in this pass.
- **Sandbox launch limitation:** normal Chromium renderer launch fails in this tool sandbox (`render-process-gone`, exitCode 49); GUI verification used the documented command-line diagnostic flags only. This is an environment limitation, not an application finding.
- **Electron 31** is older than current Electron releases; plan any upgrade separately and revalidate WebContentsView and Facebook compatibility.

---

## 8. Recommended next development priorities

1. Perform the manual daily-use checks in section 6 before starting V0.4.
2. If accepted, implement a real, confirmation-gated `reset` IPC handler and allowlist `settings:set` keys; add a verification check that does not touch real user data.
3. Update README/version copy to match V0.3 (reader features, installer version).
4. Only then scope V0.4. Do not change the Messenger architecture or reader security model without a new decision record.

---

## 9. Handoff notes

- No Git repository is initialized in the project directory, so there is no status/diff to report. Nothing was initialized, committed, pushed, or deleted beyond the disposable cache/log artifacts and stale `failure.txt` described in section 3.
- All requested checks completed successfully. No verification step was left unexecuted; only the live Facebook/manual-browser items in section 6 remain by design.
