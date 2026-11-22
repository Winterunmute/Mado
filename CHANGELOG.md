# Changelog

Historical summary compiled from Git history and consolidated release documentation. Entries are intentionally concise.

## V1.0.1 — Messenger Fixes

- Removed the 56px whitespace above Messenger by clearing Facebook's reserved global-header height on Messenger pages only.
- Fixed conversation tabs by using SPA history navigation instead of full conversation reloads that Facebook redirects to the message list.
- Serialized tab navigation and synchronized active state with the displayed route.

## V1.0 — Public Release

- YouTube `@handle`, scheme-less and `www.youtube.com/@handle` subscriptions resolve to canonical channel IDs through a bounded public-page lookup.
- Reddit subscriptions degrade gracefully when Reddit blocks RSS with 404/429; provider-specific messages and **Open on Reddit** were added.
- Official GitHub Releases update source configured.
- MIT license added, with copyright holder Rickard Borchers.
- GitHub Actions workflows for Windows build verification and tagged releases.
- Public repository, release notes, checksum and installer publication.
- Consolidated architecture, development and release documentation.

## V0.9 — Distribution & Release Preparation

- Windows NSIS installer configuration with Mado product name, version 0.9.0, application icon and Start Menu/desktop shortcuts.
- Local-only release build script: `npm run dist:win`.
- Lightweight first-run guide with skip/reopen support and no forced Messenger sign-in.
- Optional update check that reports “no official release source configured” by default and never downloads installers.
- Privacy statement, third-party notices, changelog and V1.0 release checklist.
- Installer packaging verification and isolated packaged-app smoke check.

## V0.8 — Performance, Stability & UX Polish

- Deterministic benchmark script and measured performance baseline.
- Faster saved-map normalization and mark-all-read lookup.
- Memoized/deferred feed filtering and incremental rendering for large feeds.
- Saved sort controls, date presets, custom-feed provider constraint and config export.
- Electron 45.4.1, electron-builder 26.18.0 and sanitize-html 2.18.2 upgrades.
- RSS add SSRF guard and verification-only local fixture allowance.

## V0.7 — Your Feed, Your Rules

- User-defined categories with multi-source assignment.
- Saved content with metadata snapshots and Saved view.
- Custom feed views and combined advanced filters.
- OPML import/export and bounded source discovery.
- Sidebar/category/view navigation and V0.7 storage migration.

## V0.6 — Unified RSS, YouTube and Reddit

- One chronological feed for RSS/Atom articles, YouTube videos and Reddit posts.
- YouTube channel ID/URL adapter with thumbnails and user-initiated external watch action.
- Reddit community adapter with post text and external discussion action.
- Optimized calligraphy-style tray icons with unread variant.
- Unified source management, failure isolation and content-type labels.

## V0.5 — Messenger Tabs and Desktop Reliability

- Persistent Messenger conversation tabs with pin/rename/close actions.
- Messenger navigation recovery and Messenger-only routing.
- Multi-monitor-safe window state restoration.
- Privacy-safe Messenger unread cues and optional Windows notifications.

## V0.4 — Reader, Themes and Desktop Integration

- In-app Readability-based sanitized article reader with browser fallback.
- Dark/light theme, feed density controls and improved card layout.
- System tray, close-to-tray and start-minimized options.
- Keyboard shortcuts and Settings reference.

## V0.3 — Foundations

- Local-first RSS feed subscriptions and read-state persistence.
- Embedded Messenger panel using Electron `WebContentsView`.
- Source management, refresh and basic filtering/search.
- Initial isolated Electron verification harness.

## V0.2 and earlier — Prototypes

- Desktop shell, initial calligraphy icon assets and early feed/Messenger prototypes.
- Reports are retained in the repository for historical context.
