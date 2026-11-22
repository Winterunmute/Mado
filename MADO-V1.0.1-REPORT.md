# Mado V1.0.1 — Messenger Fixes (published)

## Confirmed root causes

### Whitespace above Messenger

The WebContentsView bounds were correct: Mado starts the native view at 36px titlebar + 44px tab bar. In an authenticated session, Facebook set `--header-height: 56px` for its hidden global banner. Mado hid the visible banner but the shell still reserved that height, pushing the conversation list down by 56px.

### Conversation tabs returning to the list

Facebook's current Messenger UI uses SPA routes such as `/messages/e2ee/t/<id>/`. Calling `webContents.loadURL()` for a saved conversation caused Facebook to redirect the full page load back to `/messages/`. Live route inspection confirmed that `history.pushState()` plus a `popstate` event keeps the conversation route and displays the composer.

## Files changed

- `src/main/index.ts` — serialized SPA tab navigation, completion verification, stale-event suppression.
- `src/main/messenger-style.ts` — scoped header-height/layout override (whitespace fix preserved).
- `src/renderer/components/MessengerPanel.tsx` — resynchronize active state after failed tab navigation.
- `tests/conversation-tabs.test.mjs` — encrypted-route key/tab coverage.
- `tests/policies.test.mjs` — classifier and SPA-navigation assertions.
- `scripts/verify-electron.mjs` — use the smallest display and keep verification windows hidden/unfocused by default so runs do not interrupt the user's game.
- `package.json`, `package-lock.json`, Sidebar/Settings — version 1.0.1 and installer metadata.
- `README.md`, `CHANGELOG.md`, `.github/workflows/release.yml`, this report.

## Navigation behavior

Before: tab click → full `loadURL()` → Facebook redirect → conversation list; active indicator changed incorrectly.

After: tab click → queued `history.pushState()` + `popstate` → route verified → active state published. Chats still intentionally returns to the list. Invalid routes produce a recovery notice.

## Automated results

- `npm.cmd run typecheck`: PASS
- `npm.cmd run build`: PASS
- `npm.cmd test`: PASS, 37/37
- `node --check scripts/verify-electron.mjs`: PASS
- Electron GUI after the fixes, on the smaller display: V0.4 46/46, V0.5 58/58, V0.7 75/75.
- V0.3 and V0.6 were interrupted by display-capture/focus instability while the user's game was active; they were not re-run after the harness was changed to keep windows hidden/unfocused. All Electron processes were stopped afterwards. Rerun those two suites when the desktop is free.

## Live privacy-safe checks

Route templates only were inspected; no message content, cookies, tokens or participant data were read or logged.

- Header variable in authenticated Messenger: `0px`; conversation shell top `0px`, list top `16px`, no bottom clipping.
- A → B → A through the real IPC path: each route matched its target.
- Chats → A → Chats → B: list/conversation/list/conversation observed correctly.
- Rapid navigation: final route matched the last selected tab.
- Narrow (320px) and wide (600px) panels, light/dark themes: layout geometry unchanged.

## Manual Facebook acceptance checklist

The user should confirm with real conversations:

1. Save conversations A and B.
2. Click A → A's chat is displayed.
3. Click B → B's chat is displayed.
4. Click A again → A's chat is displayed.
5. Click Chats → conversation list appears.
6. Click B → B's chat appears.
7. Restart Mado and repeat.
8. Confirm message composer, attachments and scrolling work.
9. Confirm pinned/renamed tabs and recovery control.

## Limitations

Facebook can change SPA routes or CSS at any time. The fix is scoped to current Messenger structure with semantic role-based selectors; no broad DOM rewrite or private API is used.

## Publication

- Commit: `6fdc4ed` on `main`; tag: `v1.0.1`.
- Release: https://github.com/Winterunmute/Mado/releases/tag/v1.0.1
- Installer: https://github.com/Winterunmute/Mado/releases/download/v1.0.1/Mado-Setup-1.0.1.exe
- Installer SHA-256: `44520ae24d9ebc9fd0fa3b0e5d013306bd57899be7c91eb0ffcd29f6adae0989` (matches the release asset digest).
- The tagged release workflow failed at its duplicate-release guard because PowerShell returned `gh release view`'s non-zero exit code; the release and checksum were published manually from the locally verified installer. The workflow guard was corrected in a follow-up commit.
