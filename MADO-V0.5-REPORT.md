# Mado V0.5 — Desktop Integration & Polish Report

**Date:** 2026-11-22
**Scope:** Persistent window state, optional Windows tray, keyboard shortcuts, privacy-safe Messenger activity cues, startup/recovery improvements and desktop polish. RSS, reader, Messenger tabs, navigation policy and visual identity were preserved.

---

## 1. Implemented features

- **Persistent window state:** width, height, position and maximized state saved to `window-state.json` after a 400ms debounce and restored on startup. Saved bounds are validated against available displays; off-screen windows are recentered on an available display. Minimum size is enforced and maximized state is reapplied.
- **System tray (opt-in):** original Mado icon, Show/Hide/Quit menu, double-click restore. Settings for **Show tray icon**, **Close to tray** and **Start minimized**. Default remains normal exit; close-to-tray automatically activates the tray icon. Explicit Quit always terminates the app.
- **Keyboard shortcuts:** handled in the main process via `before-input-event` on both the renderer and Messenger webContents, then dispatched to the renderer. Works with either surface focused. Final mappings are listed in section 4.
- **Messenger activity cues:** optional generic Windows notification when Messenger's unread indicator increases, plus a small header dot and tray icon dot. No message previews, sender names or conversation content are used.
- **Startup/recovery:** duplicate windows and Messenger views are prevented; hidden windows are reused; auto-refresh pauses while the window is hidden; explicit quit cleans up tray and window state.
- **Desktop polish:** window title and original icon, Settings sections for Desktop/Notifications/Shortcuts, consistent version 0.5.0, and a compact unread indicator in the Messenger header.

---

## 2. Window/tray lifecycle architecture

- `src/main/window-state.ts` contains pure geometry validation, visibility checking and display recentering. `store.ts` persists sanitized state.
- `createWindow()` reuses an existing window, restores validated bounds, reapplies maximized state, sets the Mado icon/title and registers shortcut handling.
- Move/resize/maximize/unmaximize events debounce a state write. `before-quit` performs a final synchronous capture and destroys the tray.
- `src/main/tray.ts` owns one tray instance, rebuilds its menu, and swaps to an unread-dot icon. It never reads Facebook data.
- With close-to-tray disabled, closing the window sets the quitting flag and exits normally. With it enabled, close hides the window; tray **Quit Mado** sets the quitting flag and exits. `activate` shows the existing hidden window instead of creating a duplicate.

---

## 3. Notification and unread-state findings

- Electron exposes supported native notifications; Facebook's embedded UI does **not** provide a reliable, documented new-message event without DOM scraping. The implemented bridge reads only the numeric prefix of the Messenger document title (for example `(3) Messenger`) and ignores all other title text.
- Web notification permission is denied for the Messenger session, preventing duplicate Facebook-generated notifications and avoiding broad permission grants. No unofficial protocol or background polling was added.
- Notifications are opt-in, generic (“You have new Messenger activity”), suppressed when Messenger is focused, deduplicated with a 10-second cooldown, and clicking one focuses Mado/Messenger. Windows Focus Assist/Do Not Disturb remains under Windows control.
- The unread indicator is a simple dot, not a numeric count, because third-party title formats can be unreliable. It clears when a tab, Chats, recovery, or `messenger:markSeen` is used.
- Live Facebook notification delivery and Windows notification appearance still require a real-account manual test.

---

## 4. Final keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+1` | Open Feed |
| `Ctrl+2` | Open Sources |
| `Ctrl+3` | Open Settings |
| `Ctrl+R` | Refresh RSS feed |
| `Ctrl+Shift+M` | Show / hide Messenger |
| `Ctrl+Shift+F` | Focus feed search |
| `Esc` | Return from article reader to Feed (main renderer only; Messenger keeps its own Escape behaviour) |

`Alt` and `Meta` combinations are ignored to avoid OS and text-editing conflicts. No global system-wide shortcuts were registered.

---

## 5. Security considerations

- Context isolation, sandboxing, disabled Node integration, persistent isolated Messenger partition, validated navigation and narrow IPC were preserved.
- New IPC is read-only (`desktop:get-state`), simple boolean settings, or explicit local actions (`messenger:mark-seen`). No credential, token, cookie or conversation data crosses it.
- Notification permission is denied to remote Messenger content; no camera, microphone or screen-capture permissions were granted.
- Window state stores only geometry booleans/numbers; no Messenger data is persisted in it.
- Icons are original Mado window glyphs generated locally; no Meta marks are used.

---

## 6. Build/test results

Commands run from the project directory with `NODE_OPTIONS=--preserve-symlinks --preserve-symlinks-main`.

| Check | Result |
|---|---|
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run build` | Passed (renderer, Electron main, preload, assets) |
| `npm.cmd test` | **16/16 passed** |

New tests cover window-state clamping, off-screen recovery, visible-bounds retention, maximized state, shortcut mapping, notification origin checks, unread title parsing and notification cooldown/duplicate suppression.

---

## 7. Actual Windows/Electron GUI verification

Harness: `scripts/verify-electron.mjs` with isolated `.verification/v03`, `v04`, `v05` profiles and controlled fixtures. Diagnostic flags `--no-sandbox --disable-gpu --in-process-gpu` were used only inside this tool sandbox; production security settings were unchanged. No real Facebook account was used.

Per the instruction to use the second smaller screen, the V0.5 harness selected the smaller secondary display (`1920x1040` work area) and placed verification windows there. Restart verification did not reposition the window so restoration could be measured.

- **V0.5 stage:** `ELECTRON VERIFICATION PASSED`, **58/58 checks** (`.verification/v05/results.json`).
- **V0.5 restart:** **6/6 checks** (`.verification/v05/restart-results.json`), including maximized state, saved size, normal-exit default, theme, filter, read state and Messenger settings.
- **Regressions:** V0.4 **46/46 + 4/4**; V0.3 **31/31 + 3/3**.

Verified in V0.5: default no-tray/normal-exit state; Ctrl+2/Ctrl+1/Ctrl+Shift+F/Ctrl+Shift+M dispatch; tray enable/disable and close-to-tray activation; debounced geometry persistence; maximized persistence; unread indicator API and clear. Screenshots: `window-secondary.png`, `window-maximized.png`, `desktop-settings.png` in `.verification/v05/`. The captured images were not visually inspected in this session; layout claims rest on assertions and captured files.

---

## 8. Manual tests still needed

1. Launch normally (without diagnostic flags) and verify window size/position/maximized state restore after a full quit.
2. Move Mado to a display that is later disconnected or change resolution; confirm a usable recentered window.
3. Enable **Close to tray**, close the window, verify Messenger stays signed in, then Show from tray and Quit explicitly.
4. Enable **Start minimized**, quit and relaunch; confirm the window starts hidden and tray Show restores it.
5. With a real Facebook account, enable notifications, receive a new message, confirm a single generic Windows notification appears, clicking it focuses Messenger, and no message preview is shown. Test with Focus Assist enabled.
6. Verify the header/tray unread dot appears, then clears when a tab or Chats is selected.
7. Exercise all shortcuts with both feed and Messenger focused, including while typing in the composer.
8. Confirm RSS/reader/Messenger tabs still work after a live restart.

---

## 9. Known limitations

- Title-prefix based unread detection depends on Facebook's document title format and may be inaccurate or absent for some accounts/locales. No numeric count is shown for that reason.
- Actual tray menu clicks, Windows notification appearance and Focus Assist behaviour were not automated; only tray activation state and the notification API path were verified.
- Off-screen recovery is unit-tested with synthetic display geometry; a real monitor-disconnect test remains manual.
- Screenshots were captured but not visually inspected in this session.
- Settings → **Reset All Data** remains a placeholder from earlier versions and was not changed.
- Normal launch remains invisible to this sandbox; GUI automation uses the documented diagnostic flags.
- Electron 31 remains older than current releases.

---

## 10. Recommended V0.6 preparation

1. Complete the live-account notification and tray manual checks before adding further desktop features.
2. If Facebook title-based unread detection proves unreliable, consider an explicit user-driven “mark unread activity” cue rather than scraping.
3. Add a real, confirmation-gated reset implementation and allowlist `settings:set` keys.
4. Prepare the reserved YouTube/Reddit source work as separate adapters; do not mix it into desktop integration.
5. Plan an Electron upgrade separately with WebContentsView, notifications and Facebook compatibility testing.

---

## 11. Handoff notes

- No Git repository is initialized; nothing was committed or pushed.
- Original icons are generated by `scripts/generate-icon.mjs` and copied to `dist/assets/` during build.
- All requested automated checks completed successfully; remaining items are the live Windows/Facebook manual tests above.
