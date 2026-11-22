# MADO-01 — RSS Feed Verification & Stabilization

**Date:** 2026-11-12

## Problems confirmed

- The renderer contained a CommonJS `require()` call despite running as an isolated Vite renderer, and the sidebar rendered `ChevronLeft`/`ChevronRight` without importing them. These are startup-time faults that can prevent the React interface, including the RSS area, from rendering while the native Messenger view still appears.
- Runtime inspection confirmed the primary blank-screen cause: Electron 31 rejected both sandboxed preload scripts because the build emitted ES modules. `window.electronAPI` was therefore undefined, and `MessengerPanel` threw while mounting, blanking the React root.
- Adding a source updated the local subscription list but did not refresh the article store; removing or disabling a source could leave its articles visible until a later refresh.
- Feed requests in the main process ran sequentially, and individual failures were only logged. If every enabled source failed, the renderer could show an empty feed without an actionable error.

## Root causes

- A stale context lookup was left in `App.tsx`; it was unused and referenced a module-private context through `require`.
- Sidebar navigation referenced two missing icon imports.
- The Electron TypeScript build used NodeNext in a project marked `type: module`, but sandboxed preloads need CommonJS output on this Electron version.
- `FeedManager` updated only its own source-list state after changes.
- `getAllArticles()` awaited each source in sequence and swallowed fetch failures after logging them.

## Changes made

- Removed the renderer `require()` lookup and imported the missing sidebar icons.
- Added a CommonJS preload build and `.cjs` output paths while keeping context isolation, sandboxing, and disabled Node integration.
- Synchronized article/source state after adding, removing, enabling, disabling, and refreshing feeds.
- Fetch enabled sources concurrently, retain successful partial results, and surface an error if all enabled sources fail.
- Prevent duplicate subscriptions and corrected the renderer API type import and small related type errors.
- Confirmed `electron-store` persists subscriptions and read state locally; article read/unread state continues to be keyed by article link.

## Tests and build results

- Live RSS check: The Verge feed parsed **10 articles**.
- Live Atom check: Mozilla Planet feed parsed **75 articles**.
- Headless Electron runtime check: renderer mounted the Home/Feed UI and rendered **171 article cards** through the preload IPC bridge.
- `npm run build`: **passed** (Vite production build and Electron TypeScript compilation).
- `npm run typecheck`: **passed**.
- `npm run lint`: unavailable because `eslint` is not installed in the project dependencies.
- No automated test script is defined in `package.json`.

Runtime inspection confirmed the preload failure and React exception. After correcting the preload output, a headless Electron check verified the feed renderer and article cards. Messenger login persistence was not tested across an app restart, and no screenshot was captured.

## Remaining limitations

- Feed subscription CRUD and read-state restart persistence were verified from their IPC/store implementation, not by manually restarting the GUI.
- Auto-refresh remains unimplemented despite the persisted setting.
- The app has no automated test suite, and linting needs ESLint added/configured before it can run.
