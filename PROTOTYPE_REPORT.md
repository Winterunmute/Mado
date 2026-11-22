# Mado V0.1 — Prototype Report

**Date**: 2026-11-12  
**Version**: 0.1.0  
**Platform**: Windows 11 (tested)  
**Electron**: 31.x | **React**: 19.x | **TypeScript**: 5.5 | **Vite**: 5.x

---

## 1. Implemented Features

### 1.1 RSS Feed System ✅
- **Feed Management**: Add/remove/toggle feeds via modal dialog
- **Fetching**: Real RSS/Atom parsing via `rss-parser` in main process (bypasses CORS)
- **Parsing**: Title, link, pubDate, description, thumbnail extraction (enclosure, media:thumbnail, media:content, img tags)
- **Sanitization**: `sanitize-html` strips unsafe tags/attrs; allowed: b, i, em, strong, p, br, a, ul, ol, li, blockquote, code, pre
- **Aggregation**: Multi-feed merge sorted by publication date (newest first)
- **Read State**: Per-article read/unread persisted locally; survives restart
- **Filters**: All / Unread toggle; search across title, description, source
- **Density**: Compact / Comfortable / Spacious card layouts
- **Refresh**: Manual per-feed or global; auto-refresh interval setting (5min–1hr)
- **Default Feeds**: 6 verified working feeds (The Verge, Ars Technica, Kotaku, PC Gamer, TechCrunch, WIRED)

### 1.2 UI / Layout ✅
- **Sidebar**: Collapsible (260px → 64px), navigation (Feed, My Facebook, Sources, Settings), Messenger toggle, theme toggle
- **Feed Area**: Header with title, count, search, filter, density, refresh, manage, mark-all-read; scrollable article list
- **Article Cards**: Thumbnail (when available), source badge, date, title, description, read toggle, "Read more" external link
- **Messenger Panel**: Fixed right panel, resizable (320–600px), collapsible to tab, header with back/forward/reload/close
- **Settings**: Theme, feed density, messenger visibility/width, auto-refresh, show-read toggle, data reset
- **My Facebook**: Placeholder with links to profile/messages, future possibilities list
- **Responsive**: Works at 1920×1080 and down to ~900px; sidebar auto-collapses on narrow windows
- **Theming**: CSS variables, dark default, light mode, smooth transitions

### 1.3 Local Persistence ✅
- **electron-store** in `%APPDATA%\Mado\`:
  - `feeds.json` — array of `{url, title, enabled, lastFetched}`
  - `read-state.json` — object `{ [link]: true }`
  - `settings.json` — all preferences
- **Messenger Partition**: `persist:messenger` — isolated cookies/session for Facebook login persistence

### 1.4 IPC & Security ✅
- **Context Isolation**: Enabled for both renderer and Messenger view
- **Sandbox**: Enabled
- **Node Integration**: Disabled for remote content
- **Preload Scripts**: Typed `electronAPI` bridge (feeds, articles, settings, messenger, shell)
- **Messenger Preload**: Minimal, only console forwarding
- **Navigation Guards**: External links → `shell.openExternal`; non-Facebook URLs blocked in Messenger view
- **User-Agent**: Chrome 126 on Windows for both RSS fetch and Messenger view

---

## 2. Messenger Integration Results

### 2.1 Approach
Used **`WebContentsView`** (Electron 31's modern embedded browser) with:
- Dedicated `BrowserWindow` content view child
- Partition `persist:messenger` for cookie persistence
- Custom preload (`messenger-preload.ts`) — no privileged APIs exposed
- Standard Chrome User-Agent string

### 2.2 Test Results (Manual)

| Test | Result | Notes |
|------|--------|-------|
| Load `https://www.facebook.com/messages/` | **Success** | Page loads, shows login or conversation list |
| Login flow (email/password/2FA) | **Works** | Standard Facebook login works in embedded view |
| Session persistence | **Works** | Cookies saved in partition; survives app restart |
| Send/receive messages | **Works** | Basic messaging functional |
| Conversation list navigation | **Works** | Clicking conversations loads thread |
| Back/Forward buttons | **Works** | IPC → `webContents.goBack()/goForward()` |
| Reload button | **Works** | IPC → `webContents.loadURL()` |
| Resize panel | **Works** | Drag handle + keyboard arrows (320–600px) |
| Collapse/expand | **Works** | Sidebar toggle + panel close button |
| External links in Messenger | **Opens in browser** | `shell.openExternal` via nav guard |
| Non-Facebook navigation | **Blocked → browser** | `will-navigate` guard |

### 2.3 Known Limitations

| Limitation | Severity | Workaround |
|------------|----------|------------|
| Facebook may serve "unsupported browser" page | Medium | User-Agent mimics Chrome 126; usually works |
| Login checkpoint/challenge (2FA, captcha) | Medium | Works in embedded view; if blocked, use "Open in Browser" |
| Voice/video calls | High | Not supported in WebContentsView; use browser |
| Some React-based UI transitions lag | Low | Acceptable for reading/messaging |
| Memory usage higher than native app | Medium | Single WebContentsView; acceptable for prototype |
| `webview` tag deprecated | N/A | Correctly used `WebContentsView` instead |

### 2.4 Fallback Behavior
If Messenger fails to load (network error, blocked, etc.):
1. Error state shows in panel with error code/description
2. **"Try Again"** button → reloads Messenger URL
3. **"Open in Browser"** button → opens `https://www.facebook.com/messages/` in default browser
4. Panel remains usable for retry; doesn't crash app

---

## 3. My Facebook Feasibility

### 3.1 Investigation Summary
- **Official Graph API**: Requires App Review, limited to Pages/Business, not personal profiles
- **Personal Profile APIs**: Deprecated (2018); no current official access to user's own posts/comments
- **Web Scraping**: Against ToS; fragile; requires login cookies; breaks on UI changes
- **Embedded Web View**: Same as Messenger — can load `facebook.com/me` but:
  - Full news feed loads (not desired)
  - No programmatic access to post data
  - Navigation guards would need complex URL filtering

### 3.2 V0.1 Implementation
- **My Facebook section exists** in sidebar and routing
- **Two action cards**: "Your Profile" → `facebook.com/me`, "Messages" → `facebook.com/messages`
- **Future possibilities documented** in UI (chronological posts, comment threads, compose)
- **No scraping, no unofficial APIs, no auth bypass**

### 3.3 Recommendation for Future
- Monitor Meta for **Personal Profile API** or **Messenger Platform** updates
- Consider **browser extension** companion for content extraction (user-consented)
- Accept that "My Facebook" may remain **link-out only** for personal profiles

---

## 4. Tests Performed

| Test | Status | Details |
|------|--------|---------|
| `npm run dev` (dev mode) | ✅ Pass | Vite HMR + Electron both start |
| `npm run build` (production) | ✅ Pass | Vite + tsc both succeed |
| `npm run preview` | ✅ Pass | Production build serves correctly |
| App launch (built) | ✅ Pass | Electron loads `dist/renderer/index.html` |
| Add feed (valid URL) | ✅ Pass | Feed added, articles fetched |
| Add feed (invalid URL) | ✅ Pass | Client-side validation + server error handling |
| Remove feed | ✅ Pass | Removed from list, articles gone |
| Toggle feed enabled | ✅ Pass | Articles appear/disappear |
| Refresh single feed | ✅ Pass | New articles fetched |
| Refresh all feeds | ✅ Pass | All enabled feeds refreshed |
| Mark article read/unread | ✅ Pass | State toggles, persists after restart |
| Mark all read | ✅ Pass | All visible articles marked |
| Filter All/Unread | ✅ Pass | List updates correctly |
| Search articles | ✅ Pass | Filters by title/description/source |
| Density change | ✅ Pass | Card layout updates immediately |
| Theme toggle | ✅ Pass | Dark ↔ Light, persists |
| Messenger show/hide | ✅ Pass | Panel + tab toggle |
| Messenger resize | ✅ Pass | Drag + keyboard |
| Messenger back/forward/reload | ✅ Pass | IPC calls work |
| External article links | ✅ Pass | `shell.openExternal` |
| Settings persist | ✅ Pass | All settings survive restart |
| Data reset | ✅ Pass | Clears all stores, reloads defaults |
| Window resize | ✅ Pass | Messenger bounds update |
| Sidebar collapse | ✅ Pass | 260px ↔ 64px, layout adjusts |
| RSS error handling | ✅ Pass | Broken feed shows error, others load |

---

## 5. Known Issues

| Issue | Component | Severity | Notes |
|-------|-----------|----------|-------|
| Auto-refresh not implemented | FeedArea | Low | Setting exists but no background timer hooked up |
| No keyboard shortcuts | Global | Low | Could add Cmd/Ctrl+R for refresh, etc. |
| Feed favicon not shown | ArticleCard | Low | Could extract from feed or domain |
| No unread count badge | Sidebar | Low | Could show on "Home" nav item |
| Messenger load error codes not user-friendly | MessengerPanel | Low | Raw codes like -3, -105 shown |
| No drag-to-reorder feeds | FeedManager | Low | Nice-to-have |
| No OPML import/export | FeedManager | Low | Standard RSS feature |
| Date-fns locale not configurable | Global | Low | Uses system locale |

---

## 6. Suggested Next Steps

### Priority 1 (Core Polish)
1. **Hook up auto-refresh** — `setInterval` in main process using `autoRefreshInterval` setting
2. **Add unread badge** — Count unread articles, show on sidebar "Home" item
3. **Improve Messenger error UX** — Map common error codes to friendly messages
4. **Add keyboard shortcuts** — Refresh (R), Search (/), Toggle Messenger (M)

### Priority 2 (Quality of Life)
5. **Feed favicons** — Fetch `/favicon.ico` or use Google favicon service
6. **Drag-to-reorder feeds** — `@dnd-kit` or native HTML5 DnD
7. **OPML import/export** — Standard format for feed portability
8. **Article "save for later"** — Star/bookmark separate from read state

### Priority 3 (Architecture)
9. **TypeScript strictness** — Enable `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`
10. **Unit tests** — Vitest for store, RSS parsing, utils
11. **E2E tests** — Playwright for critical paths (add feed, read article, messenger)
12. **CI/CD** — GitHub Actions for build + test on push

### Priority 4 (My Facebook)
13. **Monitor Meta APIs** — Watch for personal profile access
14. **Browser extension companion** — Opt-in content extraction for user's own posts
15. **Design "My Posts" view** — If API becomes available, design chronological post list with comment threads

---

## 7. Success Criteria Assessment

| Criterion | Target | Achieved | Notes |
|-----------|--------|----------|-------|
| Launch on Windows | ✅ | ✅ | Tested on Win11 |
| Browse curated RSS feed | ✅ | ✅ | 6 default feeds + custom |
| Real article fetching | ✅ | ✅ | rss-parser + sanitize-html |
| Read state persistence | ✅ | ✅ | electron-store |
| Messenger alongside feed | ✅ | ✅ | WebContentsView, resizable |
| Manual FB login works | ✅ | ✅ | Partition persists session |
| Send/receive messages | ✅ | ✅ | Basic messaging verified |
| No cloud/backend | ✅ | ✅ | 100% local |
| Pleasant browsing feel | ✅ | ✅ | Card UI, dark theme, animations |
| Production build succeeds | ✅ | ✅ | `npm run build` passes |

---

## 8. Conclusion

**Mado V0.1 is a functional prototype** demonstrating the core vision: a personal desktop window combining user-curated RSS content with Facebook Messenger access.

**What works well**: RSS pipeline (fetch → parse → sanitize → display), local persistence, Messenger embedding with WebContentsView, clean React + Electron architecture, responsive dark-themed UI.

**What's honest**: Messenger works but has platform-dependent limitations; "My Facebook" is a placeholder with documented constraints; auto-refresh and some polish features deferred.

**Ready for**: Daily personal use as an RSS reader + Messenger companion; further iteration on the roadmap above.

---

*Report generated as part of Mado V0.1 prototype delivery.*