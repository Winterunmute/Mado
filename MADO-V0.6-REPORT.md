# Mado V0.6 — Unified Personal Content Feed Report

**Date:** 2026-11-22
**Scope:** Extend the working V0.5 RSS reader into one chronological, personally curated feed with RSS/Atom, YouTube channel and Reddit community sources. Preserve the existing article reader, Messenger panel, desktop integration, local storage model and security boundaries. Build, verify, document and stop.

---

## 1. Implemented source adapters

A lightweight adapter layer was added under `src/main/sources/` without replacing the existing feed implementation:

| File | Responsibility |
|---|---|
| `model.ts` | Source/content types, stable IDs, legacy-source normalization, deduplication and read-state lookup |
| `rss-adapter.ts` | Wraps the existing `fetchFeed()` parser; emits normalized `article` items |
| `youtube-adapter.ts` | Resolves supported channel inputs, fetches YouTube's public channel Atom feed, parses `yt:videoId` and media thumbnails, emits `video` items |
| `reddit-adapter.ts` | Resolves subreddit names/URLs, fetches public community RSS, extracts post text/preview/author, emits `post`, `image` or `link` items |
| `index.ts` | Caching, minimum refresh intervals, four-at-a-time refresh scheduling, per-source error capture and stale-content fallback |

All adapters emit the same `ContentItem` shape. Source-specific distinctions are retained through `sourceType`, `contentType`, `author` and `metadata`; videos and posts are not presented as articles.

---

## 2. Supported input formats

### RSS / Atom
- Full `http://` or `https://` feed URL, with no embedded credentials.
- Existing subscriptions are preserved and migrated.

### YouTube
- Bare canonical channel ID, e.g. `UCX6OQ3DkcsbYNE6H8uQQuVA`.
- `https://www.youtube.com/channel/UC...`
- `https://www.youtube.com/feeds/videos.xml?channel_id=UC...`
- `m.youtube.com` and `youtube.com` host variants.

`@handle` URLs are deliberately rejected with a clear message: they cannot be resolved reliably without an additional lookup mechanism. Canonical channel IDs are accepted instead.

### Reddit
- Bare subreddit name, e.g. `technology`.
- `/r/technology`.
- `https://www.reddit.com/r/technology/...`
- `https://old.reddit.com/r/technology/...`

The adapter builds `https://www.reddit.com/r/<name>/new/.rss`.

---

## 3. Known platform/API restrictions

- No Google account, YouTube Data API key or billed API was introduced. YouTube integration uses YouTube's public channel RSS/Atom feed.
- No Reddit authentication, unofficial API, scraping engine or paid API was introduced. Reddit integration uses Reddit's public community feed.
- YouTube `@handle` resolution is unsupported; use a canonical channel ID or `/channel/UC...` URL.
- During live checks, Reddit returned `404` for `.../new/.rss` and `.../.rss`, `429` for `.../new.rss`, and an HTML welcome page from `old.reddit.com`. This appears to be access/rate-limit behaviour from this environment rather than a parser defect. The app surfaces the failure per source and keeps the last successful fetch.
- Facebook remains unchanged: no posts, comments, broad notifications, unofficial Messenger protocol or credential access was added.

---

## 4. Unified content model and migration strategy

`ContentItem` contains:

- stable `id` derived from source identity plus item link;
- `sourceId`, `sourceType` and `sourceName`;
- `title`, `description`, `contentHtml`, `thumbnail`, `link`;
- `pubDate`, `author`, `contentType` and `metadata`;
- `feedUrl`, `feedTitle` and `isRead`.

`SourceSubscription` contains a stable `id`, `type`, feed URL, user-facing source URL, title, enabled state, `lastFetched`, `lastError` and optional metadata.

Migration is backward compatible:

- `readFeeds()` accepts the old plain array and the older `{ feeds: [...] }` shape.
- Missing `type` values default to `rss`; missing IDs are generated from type plus URL.
- Writes use `{ version: 2, feeds: [...] }`.
- Read state accepts both new content IDs and legacy link keys, so existing RSS read history survives refresh and restart.
- Invalid saved source entries are skipped; malformed URLs fall back safely for titles.

---

## 5. Feed and reader UI changes

- **Sources view:** now offers Add Source tabs for RSS / Website, YouTube Channel and Reddit Community, type-specific placeholders and validation, type badges, source URLs, enabled state, refresh status/errors and remove actions.
- **Unified feed:** RSS articles, YouTube videos and Reddit posts appear in one chronological list. No recommendations, engagement optimization or personalized ranking.
- **Filters:** existing All/Unread and search controls are joined by source-type and individual-source selects. Search includes title, description, source and author.
- **Cards:** subtle type differentiation only. Videos show a thumbnail with a play indicator and a **Watch** action; Reddit posts show community/author context and a **View post** action; RSS keeps the established article card.
- **Reader routing:** RSS continues through the Readability-based sanitized reader. YouTube opens a user-initiated viewer with thumbnail and explicit **Watch on YouTube** action; no iframe/video player is auto-created. Reddit shows supplied post text plus an explicit **View Discussion on Reddit** action.
- **Navigation:** Messenger stays mounted while reading. Back to Feed preserves scroll position, filters and search. The existing reader URL validation, HTML sanitization and private-address protections were not changed.
- **Reset All Data:** now requires two confirmations, restores default sources/preferences/read state/tabs/window state and preserves the separate `persist:messenger` Facebook session. `settings:set` now validates keys against an explicit allowlist in the main process.

---

## 6. Performance, refresh and caching considerations

- Sources refresh concurrently with a limit of four active requests.
- Per-type minimum refresh intervals prevent repeated network work: RSS 1 minute, YouTube and Reddit 5 minutes.
- Full refresh bypasses the interval cache; adding or refreshing one source clears only that source's cache.
- On failure, `fetchSourcesConcurrently()` returns the last good items together with an error, so other sources continue and stale content remains visible with a per-source error.
- Deduplication is keyed by stable content ID before rendering.
- Thumbnails use lazy loading and `referrerPolicy="no-referrer"`.
- Pagination/virtualization was not added: the current fixture feed is 24 items and live YouTube returned 15. The simpler filtered list was kept because there is no evidence yet that virtualization is required.

---

## 7. Build and automated test results

Commands were run from `C:\Users\Ricka\Desktop\Dev\Mado` with `NODE_OPTIONS=--preserve-symlinks --preserve-symlinks-main`.

| Check | Result |
|---|---|
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run build` | Passed — renderer, Electron main, preload and assets |
| `npm.cmd test` | **24/24 passed** |

Focused tests added or extended:

- legacy source migration and versioned normalization;
- YouTube channel ID/URL validation and rejection of handles;
- Reddit name/URL validation;
- media thumbnail normalization for rss-parser object/array shapes;
- source-specific failure isolation and cached-content fallback;
- stable content IDs, deduplication and legacy/new read-state keys;
- mixed-source filtering by type, source, unread state and search.

Existing tests for the reader, desktop policies, shortcuts, conversation tabs and window state still pass.

---

## 8. Electron GUI verification

Harness: `scripts/verify-electron.mjs` with isolated `.verification/v03`, `v04`, `v05` and `v06` profiles and deterministic local fixtures. Diagnostic flags `--no-sandbox --disable-gpu --in-process-gpu` were used only inside this tool sandbox; production Electron security settings were unchanged. No real Facebook account was used.

Per the standing instruction to use the second smaller screen, the V0.5/V0.6 harness selected the smaller secondary display (`1195910118`, `1920x1040` work area).

| Stage | Result |
|---|---|
| V0.3 regression | `ELECTRON VERIFICATION PASSED`, **31/31** |
| V0.4 regression | `ELECTRON VERIFICATION PASSED`, **46/46** |
| V0.5 regression | `ELECTRON VERIFICATION PASSED`, **58/58** |
| V0.5 restart | **6/6** — Light/Unread, read status, Messenger size/visibility, maximized and saved geometry, normal-exit default |
| V0.6 | `ELECTRON VERIFICATION PASSED`, **68/68** |

One V0.5 run printed all 58 passes and wrote `results.json` but exited with Windows code `-1073741819` during Electron shutdown. It was not reproduced in three subsequent full V0.5 runs or the restart run; all final tabulated results are from clean exits.

V0.6 specifically verified: the optimized ICO files contain 16/24/32px frames and load through Electron; three source types in Sources; typed YouTube subscription; video card with play indicator; Reddit post in the same feed; source-type filtering; user-initiated video view with no embedded player; feed scroll preservation; Reddit text view with discussion action; and reset restoring defaults while rejecting arbitrary settings keys.

### Icon integration

The user-supplied 887×887 `icon.png` and `icon-unread.png` were preserved unchanged. `scripts/build-small-icons.py` aligned the unread artwork (+110px horizontally) so the calligraphy matches the normal icon exactly, cropped to a common 619px square to remove transparent margins, applied a light 30% stroke reinforcement, and wrote 16/24/32px `icon-small.ico` and `icon-unread-small.ico`. The V0.6 GUI harness asserts that both ICO files contain all three frames and load through Electron. `BrowserWindow` and the tray now use the ICO variants; native notifications keep the full-resolution PNG. The legacy `generate-icon.mjs` was converted to a no-op guard so it cannot overwrite the user's artwork. Pixel-level ASCII previews at 16/24/32 confirmed the symbol fills the frame and the red dot remains visible, but a human visual check of the actual Windows taskbar/tray was not possible in this session.

Screenshots written to `.verification/v06/`: `unified-feed-youtube.png`, `unified-feed-mixed.png`, `video-reader.png`, `reddit-reader.png`, plus existing reader/Messenger/window captures. Screenshots were captured but not visually inspected in this session; layout claims rest on DOM and computed-style assertions.

The restart harness was corrected to persist its fixture port across processes because V0.6 read-state IDs include source identity. This was a test-harness fix only.

---

## 9. Live-source checks actually performed

- **YouTube:** fetched `https://www.youtube.com/feeds/videos.xml?channel_id=UCX6OQ3DkcsbYNE6H8uQQuVA` through the real adapter. Result: **15 videos** normalized; first item `Can I Beat Magnus Carlsen?`, video ID `WjCH5JUNzao`, with a resolved thumbnail URL. This was a live read-only check; no account or API key was used.
- **Reddit:** attempted `https://www.reddit.com/r/technology/new/.rss` through the real adapter and via direct HTTP requests with a plain application User-Agent. Results were `404` and `429`; `.../.rss` also returned `404`/`429`, `.../new.rss` returned `429`, and `old.reddit.com` returned an HTML welcome page. Live Reddit normalization is therefore **not verified** from this environment.
- Existing RSS fixture checks and V0.3 remote feed checks remain green.

---

## 10. Remaining manual verification requirements

1. Add a Reddit community from a network where Reddit public feeds are accessible and confirm posts, previews and **View Discussion**.
2. Add a YouTube channel using a real canonical channel ID in the normal app UI and confirm thumbnails and **Watch on YouTube** in the default browser.
3. Confirm that existing user subscriptions and read history survive a real V0.5 → V0.6 launch without the verification profile.
4. Visually review the V0.6 screenshots for card spacing, thumbnail crops and dark/light contrast.
5. Repeat the V0.5 manual Windows/Facebook checks: tray menu clicks, notifications with Focus Assist, start-minimized, monitor disconnect/recovery and shortcuts while the Messenger composer has focus.
6. Confirm Reset All Data in a disposable profile, including that the Messenger login remains available.

---

## 11. Known limitations

- Live Reddit access from this environment is restricted or rate-limited; the adapter and fixtures are verified, live content is not.
- YouTube `@handle` URLs are rejected; canonical IDs are required.
- YouTube playback uses an explicit external action rather than an in-app embedded player. This avoids autoplay, duplicate players and unnecessary privileged remote content.
- Reddit text is shown from the public feed; comments and the full Reddit interface are intentionally not recreated.
- No virtualization or pagination was added; a much larger future feed may require it.
- Screenshots were captured but not visually inspected.
- Electron 31 remains older than current releases; upgrading is a separate compatibility task.
- Normal app launch remains invisible to this sandbox; GUI automation used documented diagnostic flags.

---

## 12. Recommended next improvements

1. Re-test Reddit from an unrestricted network and adjust only the public-feed URL/error messaging if Reddit changes its supported endpoints.
2. If required, add a supported YouTube handle-resolution step using a documented endpoint, while keeping canonical IDs as the stable identity.
3. Add incremental rendering only if real user feeds grow enough to show slowdown.
4. Review the V0.6 screenshots visually and adjust card density if needed.
5. Complete the outstanding real-account Messenger/tray/notification manual tests before any V0.7 desktop work.
6. Plan an Electron upgrade with WebContentsView, notification and Facebook compatibility testing.

---

## 13. Handoff notes

- No user data, Messenger session or existing subscription was modified by verification; all Electron runs used isolated `.verification/*` profiles.
- Source files changed for V0.6 are listed in sections 1 and 5; version was bumped to `0.6.0` in `package.json`, the lockfile and the UI.
- `MADO-V0.6-REPORT.md` and `README.md` are the user-facing deliverables for this version.
- Published to the private GitHub repository `https://github.com/Winterunmute/Mado.git` on branch `main`. The initial commit is `0571f2d`; no verification profiles, build output or `node_modules` were committed.
- The user replaced `assets/icon.png` and `assets/icon-unread.png` with same-named 887×887 calligraphy PNGs. Those full-resolution originals are preserved unchanged. `scripts/build-small-icons.py` derives aligned, tightly cropped 16/24/32px ICO variants (`icon-small.ico`, `icon-unread-small.ico`) for the Windows taskbar and tray; the unread artwork is aligned to the normal artwork so only the red dot differs. The legacy `generate-icon.mjs` is now a no-op guard so it cannot overwrite the user's icons. `scripts/copy-assets.mjs` copies all four assets on build, and source/copied hashes were checked.
