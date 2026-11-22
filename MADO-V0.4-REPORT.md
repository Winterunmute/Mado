# Mado V0.4 — Messenger UX & Integration Report

**Date:** 2026-11-21
**Scope:** Messenger conversation tabs, minimal panel header, panel spacing/fit, theme integration, responsive polish. Existing RSS feed, article reader, settings, WebContentsView architecture, and navigation security were preserved.

---

## 1. Features implemented

### Conversation tabs (primary feature)
- A compact, horizontally scrollable tab strip sits above the embedded Messenger content.
- **Save current conversation** creates a local shortcut from the current validated Messenger conversation URL.
- Multiple tabs can be saved; selecting a tab navigates the **same** `WebContentsView` to that conversation.
- Tabs can be renamed locally (double-click the label, Enter to commit, Escape to cancel) and pinned/unpinned with a star control.
- Each tab has a close control. Closing a tab only removes the local shortcut; it never modifies or deletes a Facebook conversation.
- A permanent **Chats** tab returns to the normal `https://www.facebook.com/messages/` conversation list.
- The active tab has an accent border, background, and `aria-selected="true"`; pinned tabs show a filled star.
- Saved tabs, local labels, and pin state are persisted in a dedicated local store (`messenger-tabs.json`) and restored after a full application restart.
- Tabs are validated on load: non-Messenger URLs, credentials, HTTP, lookalike hosts, duplicate keys, and bad metadata are rejected.

### Messenger header simplification
- Removed the redundant **Home**, **Back**, **Forward**, **Reload**, and **Close (X)** controls.
- The header now contains only: a small Messenger glyph, the conversation tab strip, a Save control, and a contextual recovery alert.
- Messenger can still be hidden/shown from the existing sidebar **Hide/Show Messenger** control.
- Automatic navigation recovery was left intact. When a blocked navigation or load failure occurs, a discreet warning icon remains until the user selects it or deliberately chooses another conversation/Chats. It returns to Messages without restoring the old toolbar.

### Panel spacing and fit
- Reduced the Mado Messenger header from 48px to 44px; the native view now begins at y=80 instead of y=84 (36px app titlebar + 44px compact header).
- The tab strip occupies the header row rather than adding a second row, so the native Messenger view did not need to move downward.
- Added full-height/overflow and thin scrollbar rules to the injected Messenger CSS so embedded content can use the available panel height.

### Theme integration
- Extended `messengerStyle(theme)` with both Mado palettes: surfaces, text, dividers, accent, buttons, search, overlays, hover/press tints, and scrollbar colors.
- The injected CSS follows the app theme through the existing `applyTheme()`/`insertCSS()` path; no conversation DOM is read.

---

## 2. Conversation-tab design and limitations

- **One session, one WebContentsView.** Tabs are managed navigation shortcuts, not independent browser processes or live parallel conversations. All tabs share the persistent `persist:messenger` session and Facebook authentication.
- **Conversation identity** is derived from the normalized path after `/messages/` (for example `t/123` or `abc-def`). This handles both the current `/messages/t/<id>/` form and shorter `/messages/<id>/` routes without assuming a single Facebook URL format.
- **Labels** fall back to `Chat <short id>` because conversation names are not read from Facebook. Users can rename tabs locally. No message content, participant list, or conversation history is scraped.
- **Persistence** stores all open tabs, not only pinned ones; pin state persists with them. Invalid entries are dropped before use.
- **Stale links** that are syntactically valid but no longer open a conversation in Facebook will surface Messenger's own load failure; the contextual recovery control returns to Messages. Tab data itself is validated in the main process before being saved or navigated.

---

## 3. Messenger layout findings

- The native view's top offset came from Mado's own `TITLEBAR_HEIGHT + MESSENGER_HEADER_HEIGHT` calculation (36 + 48 = 84), not from the resize handle or feed layout. This was confirmed in `src/main/index.ts` and `MessengerPanel.css`.
- The existing cosmetic injection hides Facebook's global banner, but no live authenticated DOM was available in this environment, so a further Facebook-internal spacing override would have been speculative and risked clipping Messenger's own controls.
- Decision: reduce Mado's own header height and add conservative full-height/scrollbar CSS; do not add brittle global transforms or guessed `@media`/`:has()` overrides inside Facebook. Manual verification below covers the real-app empty-space question.

---

## 4. CSS/theme adaptations

- `src/main/messenger-style.ts` now maps Mado's dark/light values onto Facebook CSS custom properties and adds scrollbar styling.
- Existing guardrails remain: login pages receive no injected sheet; generic `[role="navigation"]` and conversation controls are not hidden; only the global Facebook banner/left Facebook nav selectors are hidden.
- `src/renderer/components/MessengerPanel.css` implements the compact header, scrollable tab strip, active/pinned indicators, narrow-width container queries, and the warning recovery button.

---

## 5. Security and navigation considerations

- Context isolation, sandboxing, disabled Node integration, and the persistent Messenger partition are unchanged.
- The existing `classifyMessengerNavigation()` policy remains the navigation security boundary. It was not weakened.
- New main-process IPC:
  - `messenger:navigate` accepts only URLs classified as `allow` **and** recognized as Messenger content URLs.
  - `messenger:get-location` and the `messenger-location-changed` event publish only validated Messenger content URLs; authentication URLs, redirectors, and arbitrary navigation targets are never sent to the renderer.
  - `messenger-tabs:save` revalidates every tab and derives its key from the URL rather than trusting renderer-supplied metadata.
- No credentials, tokens, cookies, messages, or conversation contents are read, logged, exported, or persisted by V0.4 code.
- No broad camera/microphone/screen permissions were added. Autoplay remains restricted by the existing app-level policy.

---

## 6. Automated tests and build results

Commands run from `C:\Users\Ricka\Desktop\Dev\Mado` with `NODE_OPTIONS=--preserve-symlinks --preserve-symlinks-main` (Windows environment workaround).

| Check | Result |
|---|---|
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run build` | Passed (Vite renderer, Electron main, preload copy) |
| `npm.cmd test` | **12/12 passed** |

New/updated unit coverage:
- Conversation URL classification for `/messages/t/<id>/`, `/messages/<id>/`, query/hash forms, list URLs, lookalike hosts, HTTP, credentials, and `javascript:` URLs.
- Fallback labels and location metadata.
- Tab sanitization: invalid URLs, mismatched keys, duplicates, label truncation, and pinned-first ordering.
- Messenger CSS palette variables and absence of conversation/toolbar hiding.

---

## 7. Actual Electron GUI verification

Harness: `scripts/verify-electron.mjs`, using isolated `.verification/v03` and `.verification/v04` profiles with controlled RSS and Messenger-shaped fixtures. Diagnostic flags `--no-sandbox --disable-gpu --in-process-gpu` were used only in this sandbox; production settings were not weakened. No real Facebook account was used.

```powershell
$env:MADO_VERIFY_STAGE='v04'
& '.\node_modules\.bin\electron.cmd' --no-sandbox --disable-gpu --in-process-gpu scripts/verify-electron.mjs

# full-process restart persistence:
$env:MADO_VERIFY_RESTART='1'
& '.\node_modules\.bin\electron.cmd' --no-sandbox --disable-gpu --in-process-gpu scripts/verify-electron.mjs
```

### V0.4 stage
- **46/46 checks passed**, `ELECTRON VERIFICATION PASSED`.
- Results: `.verification/v04/results.json`; restart: `.verification/v04/restart-results.json`.
- Verified:
  - minimal header (no old navigation/close buttons);
  - header bottom at y=80 matching the native view;
  - saving the current conversation as a labelled tab;
  - duplicate-save disabled state;
  - switching tabs in the same `webContents.id`;
  - Chats returning to `/messages/`;
  - horizontal scroll at 320px panel width;
  - no header overlap at 600px width;
  - closing tabs without affecting others;
  - pin indicator and persistence;
  - invalid saved URLs rejected without losing valid tabs;
  - discreet recovery control after blocked navigation and successful recovery;
  - injected CSS following the dark palette;
  - maximized layout header/native-view alignment;
  - full restart restoring pinned tabs, theme, filter, read state, and Messenger visibility/width.

### Regression stage
- V0.3 suite rerun: **31/31 checks passed**, plus **3/3** restart checks. Results remain in `.verification/v03/`.

### Screenshots captured
`.verification/v04/` contains `messenger-tabs-narrow.png`, `messenger-tabs-wide.png`, `messenger-tabs-light.png`, `messenger-tabs-dark.png`, `messenger-maximized.png`, plus the V0.3 feed/reader/settings captures. These were produced by Electron `capturePage()`. **Visual image inspection was not possible in this session** (the agent model could not load image input), so the layout claims above rest on DOM geometry/computed-style assertions and the captured files, not on a human/agent image review.

---

## 8. Manual test steps (real Facebook required)

1. Launch normally (no diagnostic flags) from a terminal:
   ```powershell
   cd C:\Users\Ricka\Desktop\Dev\Mado
   $env:NODE_OPTIONS='--preserve-symlinks --preserve-symlinks-main'
   & '.\node_modules\.bin\electron.cmd' .
   ```
2. Sign in to Messenger and open a conversation. Confirm **Save current conversation** becomes enabled and creates a tab.
3. Open two or more conversations, save them, and switch between tabs. Confirm the message composer, attachments, images, and scrolling still work.
4. Rename a tab by double-clicking its label; pin a favorite; close another tab and verify the Facebook conversation itself is untouched.
5. Click **Chats** and verify the normal conversation list returns.
6. Collapse/expand Messenger from the sidebar at 320px, 420px, 600px, windowed, and maximized sizes. Check for clipped tabs or overlapping controls.
7. Try Facebook home/feed navigation and history/SPA transitions. Confirm automatic recovery and, if it appears, the discreet warning icon.
8. Quit and relaunch the app. Confirm pinned/open tabs, labels, theme, read state, and Messenger login persist.
9. Verify the large empty area above the real Messenger chat list. If it remains, note whether it is inside Facebook's own shell; only then consider a narrowly scoped follow-up override.

---

## 9. Known limitations

- Tabs are shared-session shortcuts, not independent live conversations.
- Conversation names are not read from Facebook; labels are URL-derived until renamed.
- Facebook route formats and UI internals can change; tab URL validation and label extraction may need updates.
- The root cause of the maximized empty band cannot be confirmed without a live authenticated DOM; no speculative Facebook-internal override was added.
- Screenshot files were captured but not visually inspected in this session.
- Settings → **Reset All Data** remains a placeholder (documented in the V0.3 report) and was deliberately not changed here.
- Normal sandbox launch is not visible from this tool environment; flagged launch remains necessary for automated GUI checks here.
- Electron 31 remains older than current releases.

---

## 10. Recommended next steps for V0.5

1. Complete the real-account manual checklist, especially tab switching with live conversations and the maximized empty-space question.
2. If needed, add a narrowly targeted Messenger CSS override based on a real authenticated DOM capture, with manual regression checks for composer and conversation list.
3. Implement a confirmation-gated reset IPC and allowlist `settings:set` keys (long-standing V0.3 issue).
4. Consider tab drag reordering and keyboard tab navigation once live usage confirms the current strip works well.
5. Keep the navigation policy, session isolation, and no-scraping rules unchanged unless a new decision record is made.

---

## 11. Handoff notes

- No Git repository is initialized in the project directory; nothing was initialized, committed, or pushed.
- No user files were deleted. A stale `.verification/v04/failure.txt` from a superseded test-harness assertion was removed after the final passing run.
- All requested automated checks completed. Remaining items are the live-Facebook manual tests in section 8.
