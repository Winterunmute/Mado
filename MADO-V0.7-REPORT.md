# Mado V0.7 — Your Feed, Your Rules Report

**Date:** 2026-11-22
**Scope:** Personal categories, saved content, combined filters, custom feed views, OPML portability and bounded source discovery. V0.6 RSS/YouTube/Reddit content, the reader, Messenger, local-first storage and the calligraphy icons were preserved.

## 1. Implemented features

- **User-defined categories:** create, rename and delete; assign a source to multiple categories; remove assignments without deleting subscriptions. **All** remains implicit.
- **Saved content:** save/unsave articles, videos and posts from cards or the reader. Saved state is independent of read state and survives restarts. Saved snapshots keep metadata when an item leaves the feed; those cards show **Saved copy**.
- **Combined filtering:** All/Unread/Saved, category, source type, subscription, content type, search and publication date range. Active filters are visible as chips; **Clear Filters** restores defaults.
- **Custom feed views:** named views based on categories and/or sources with optional content-type constraints. They reuse the main filter engine; **All feed** and **Saved** are always available.
- **OPML:** safe local import with folders/categories, duplicate detection and validation; standards-shaped export of RSS/Atom subscriptions. Native YouTube/Reddit feeds are not exported as RSS.
- **Source discovery:** detects advertised RSS/Atom links and direct feeds, classifies YouTube/Reddit inputs through V0.6 adapters, and keeps manual entry available.
- **Interface:** Saved/category/view sidebar navigation, compact advanced filters, saved indicators, improved empty states and V0.7 version metadata.

## 2. Architecture and storage changes

New pure modules under `src/main/organize/`: `categories.ts`, `saved.ts`, `views.ts`, `opml.ts`, `discovery.ts`. New local electron-store files: `categories.json`, `saved.json`, `feed-views.json`. Feed storage moved to `{ version: 3, feeds }` with `categoryIds` on every source. Settings gained persisted `feedViewId`, `feedFilterMode`, `feedCategoryFilter`, `feedSourceTypeFilter`, `feedSourceFilter`, `feedDateFrom` and `feedDateTo`; all are allowlisted and validated in the main process.

`src/renderer/lib/article-filter.ts` is the single filter engine used by all and custom views. Saved-only snapshots are merged into `getAllArticles()` when they are no longer returned by a source, marked `available: false`, so the Saved view remains useful without storing full copyrighted content.

## 3. Migration behavior

- V0.6 plain arrays and `{ version: 2, feeds }` are still read; missing types default to `rss` and missing `categoryIds` become empty arrays.
- Writes use version 3; migration is repeatable and never removes sources or read history.
- Legacy `showReadArticles` still works; `feedFilterMode` is authoritative when present.
- Reset All Data clears the new stores only after two confirmations and still preserves the `persist:messenger` session.

## 4. Filtering and custom-feed semantics

Filters are intersections: an item must satisfy the active mode, category, source type, source, content type, custom view membership, date range and search query. Custom views match when an item belongs to any selected category **or** any selected source; if either list is empty, that dimension is unrestricted. Chronological order is unchanged. No ranking, recommendations or engagement signals were added.

## 5. OPML and discovery results

OPML import uses Electron's native open dialog and inert XML parsing. It recognizes nested outline folders and `category` attributes, reports imported/duplicate/invalid counts, rejects private URLs and skips native YouTube/Reddit feed URLs with a reason. Export uses the save dialog and writes only RSS/Atom sources. No imported URL is fetched automatically.

Discovery fetches at most one page plus three redirects with a 10-second timeout, 1.5 MB response cap, public-address DNS checks, no credentials and a browser-like User-Agent. It parses only `link rel="alternate"` feed advertisements and never runs scripts or performs general scraping.

## 6. Build and automated tests

Commands run with `NODE_OPTIONS=--preserve-symlinks --preserve-symlinks-main`.

| Check | Result |
|---|---|
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run build` | Passed |
| `npm.cmd test` | **32/32 passed** |

New deterministic tests cover category normalization/CRUD shapes, multiple assignments, combined filters, saved snapshots/read-state independence, custom views, OPML import/export, discovery parsing/classification, malformed inputs, duplicate detection and V0.7 storage migration. Existing RSS/YouTube/Reddit, reader, desktop and Messenger tests still pass.

## 7. Electron GUI verification

Harness: `scripts/verify-electron.mjs` with isolated `.verification/*` profiles and controlled fixtures. Diagnostic Electron flags were used only in the sandbox; production security settings are unchanged. V0.5/V0.7 selection used the smaller secondary display.

| Stage | Result |
|---|---|
| V0.3 regression | 31/31 |
| V0.4 regression | 46/46 |
| V0.5 regression | 58/58 |
| V0.5 restart | 6/6 |
| V0.6 regression | 68/68 |
| V0.7 | **67/67** |

V0.7 verified category create/rename/delete and assignment validation, save/read-state independence, saved filter persistence after reload, custom feed CRUD, source discovery from a fixture page, Sources management controls and unsave round trip. Screenshots were captured to `.verification/v07/` but not visually inspected; assertions used DOM and computed styles.

## 8. Security considerations

Context isolation, sandboxing, disabled Node integration, the isolated Messenger partition, navigation guards, narrow IPC, reader sanitization and public-address checks were preserved. All new IPC validates inputs in the main process. OPML/discovery parse untrusted XML/HTML inertly, reject private/credential-bearing URLs and never fetch imported OPML URLs. No Facebook data was inspected, exported or logged.

## 9. Known limitations

- Native file dialogs were not automated; OPML UI paths were verified by API and pure-function tests.
- Source discovery was verified against a fixture, not a live public website.
- "Saved copy" items retain metadata but cannot retrieve a vanished full article.
- Custom view editing uses compact inline controls rather than a wizard; source-type constraints are supported by the model but not exposed in the creation form.
- A Messenger screenshot was skipped once in the sandbox because the display capture surface was unavailable; assertions were unaffected.
- Live Facebook and Windows notification/tray manual checks remain from earlier versions.

## 10. Remaining manual checks

1. Import/export a real OPML file through the native dialogs.
2. Discover feeds from a real website and add one selected result.
3. Verify saved video and Reddit items after their sources are removed in a disposable profile.
4. Exercise narrow/wide Messenger panels, maximized window and both themes visually.
5. Repeat real-account Messenger login, notification and tray checks.

## 11. Recommended V0.8 work

1. Expose custom-view source-type editing and date presets in the UI.
2. Add per-category colors and drag ordering.
3. Add saved-item search and sort controls.
4. Revisit live Reddit access when platform restrictions change.
5. Consider virtualized rendering only if real feeds become large enough to justify it.
