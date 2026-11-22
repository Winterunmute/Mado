# MADO-03 — Reference Research & V0.2 Improvement Roadmap

**Research date:** 2026-11-12  
**Scope:** Read-only inspection. The three shallow clones are outside the project at `C:\Users\Ricka\AppData\Local\Temp\Mado-reference-review`. No reference dependencies were installed and no reference code was executed.

## 1. Executive summary

Mado should keep its existing Electron `WebContentsView` Messenger panel and React RSS renderer. The reference clients offer useful navigation patterns, but none enforces the product’s actual requirement—Messenger conversations without Facebook’s general feed—by itself. The best starting point is a main-process URL policy that classifies redirects and popups, supplemented by an always-visible **Back to Messenger** action and a post-navigation recovery check for Facebook SPA transitions. CSS hiding can reduce Facebook chrome but must not be the security or navigation boundary.

The reported RSS symptom is consistent with the current layout: `FeedArea` maps all 171 articles into a vertical flex container, while `.article-card` is a shrinkable flex item with `overflow: hidden`. With many cards, flex shrinking can reduce each card to a thin strip and clip its contents. This is a strong source-based diagnosis, not a computed-style measurement from the user’s latest GUI. The fixed Messenger panel also covers part of the full-width feed because the React layout does not reserve its width. Fix and visually verify these separately.

**Recommended next:** restore card heights; reserve the Messenger column and make the feed header responsive; then enforce Messenger-only navigation with recovery. Remove the explicitly unwanted My Facebook placeholder as part of the P1 cleanup.

## 2. Mado’s current confirmed problems

| Finding | Evidence and assessment |
|---|---|
| Articles are selected and mapped to cards | `FeedArea.tsx` displays `filteredArticles.length` and maps that same array to `ArticleCard`. Thus “171 articles” indicates a populated filtered array; it does not prove that the cards have usable visual dimensions. |
| Likely card collapse | `FeedArea.css` makes `.feed-container` a vertical flex scroller. `ArticleCard.css` gives `.article-card` `overflow: hidden`, but no non-shrinking flex basis or minimum height. All 171 cards are rendered at once; the `IntersectionObserver` callback and `handleLoadMore` are empty. This combination can shrink and clip flex items. **High-confidence hypothesis; confirm with computed heights and a GUI test.** |
| Feed and Messenger overlap | `.messenger-panel` is fixed-position, while the native `WebContentsView` is placed over the right side of the window in `main/index.ts`. The feed/main area does not reserve the panel width. This can hide feed content and header controls under Messenger; it does not by itself explain near-zero card heights. |
| Small-window breakpoints are ineffective | The Electron window has `minWidth: 1000`; the feed header, app layout, and Messenger narrow-window rules activate at `max-width: 900px`. Those rules cannot run at the minimum window width. At that width the sidebar is 220px, Messenger defaults to 420px, and the feed has little unobscured room. |
| Messenger can leave the intended surface | `isMessengerUrl()` in `main/index.ts` permits every HTTPS Facebook subdomain and path. Only `will-navigate` is handled; there is no `will-redirect` or same-document SPA route recovery. Facebook home/news-feed routes therefore remain in the embedded view. Back/Forward can also traverse existing history. This is a confirmed gap in the current policy. |
| My Facebook is a live placeholder | `Sidebar.tsx`, `App.tsx`, `types.ts`, `MyFacebook.tsx`, and `MyFacebook.css` implement the unwanted route and UI. Remove it in V0.2; do not replace it with posts, comments, or a Facebook feed. |
| Sources/settings need follow-through | The `Sources` route renders `FeedArea` rather than a distinct source organizer. Search covers title, description, and source name only. The persisted `showReadArticles` setting is not applied in `FeedArea`; auto-refresh is documented as unimplemented in MADO-01. |
| No inline RSS video is currently rendered | Article descriptions are reduced to text and thumbnails are CSS backgrounds; cards do not embed feed HTML or video. Therefore autoplay suppression is not currently a card-rendering requirement. Keep future rich media click-to-play by default. |

The available CSS uses light text on dark surfaces and defines title, metadata, description, and action styles. A global typography/color defect is not evident in source. The reported “thin lines” more strongly implicate flex sizing and clipping than article parsing or missing React mapping.

## 3. Reference comparison and useful techniques

Reference snapshots: Chatpane `e23a403` (2026-11-11, v3.2.0, MIT); Caprine `c99ffb8` (2026-01-15, v2.60.4, MIT); Messenger Desktop `07fbfc6` (2026-10-27, v3.0.0, MIT). Links are commit-pinned.

| Project / source | Technique and fit for Mado | Complexity, brittleness, risks, license |
|---|---|---|
| [Chatpane `src-tauri/src/window.rs`](https://github.com/kristofferR/Chatpane/blob/e23a403/src-tauri/src/window.rs) and [`url_rules.rs`](https://github.com/kristofferR/Chatpane/blob/e23a403/src-tauri/src/url_rules.rs) | Tauri’s `on_navigation` delegates to a pure URL classifier; external web links open in the system browser and unsafe schemes are blocked. Redirect URLs are unwrapped and tested. This is a useful policy shape, but it is Tauri/Wry/Rust, not drop-in Electron code. Importantly, Chatpane’s `is_internal()` still accepts all Facebook paths; its stricter `is_messenger_content_url()` is used for recovery/watchdog logic, not as the general navigation allowlist. It does **not** solve Messenger-only navigation as configured. | Medium to adapt. URL parsing and pure route tests are durable; Facebook paths and link shims change. Do not copy its broad Facebook-domain rule as the V0.2 policy. MIT; retain notices if copying code. |
| [Chatpane link handling](https://github.com/kristofferR/Chatpane/blob/e23a403/inject/src/messenger/features/link-handling.ts) and [media autoplay](https://github.com/kristofferR/Chatpane/blob/e23a403/inject/src/messenger/features/media-autoplay.ts) | Capture-phase click handling sends external links to native code; autoplay protection observes added videos and suppresses `play()` absent recent trusted input. Concepts may help for SPA links or future Messenger autoplay controls, but Electron’s main-process navigation handlers should remain primary. Mado does not currently embed RSS video. | Link handling: Medium, depends on page DOM/events. Autoplay patch: Medium/Large, monkey-patches media behavior and may break calls or user-initiated playback. Both require manual checks across Messenger updates. MIT attribution for copied code. |
| [Caprine `source/index.ts`](https://github.com/raztronaut/caprine/blob/c99ffb8/source/index.ts), [`source/autoplay.ts`](https://github.com/raztronaut/caprine/blob/c99ffb8/source/autoplay.ts), [`css/browser.css`](https://github.com/raztronaut/caprine/blob/c99ffb8/css/browser.css) | Uses Electron `setWindowOpenHandler`, externalizes many links, and injects CSS after DOM readiness. Its popup exception for a call window and autoplay toggle show relevant UX tradeoffs. The inspected version loads `messenger.com`, unlike Mado’s current Facebook Messages URL; its `will-navigate` logic is not a Messenger-only route policy and is not redirect/recovery handling. CSS includes Facebook-generated class selectors. | Small to imitate superficially, but not recommended as a base: old target URL, broad hostname checks, incomplete redirect handling, and selector fragility. Autoplay handling depends on Messenger’s internal DOM. MIT with Sindre Sorhus and Razi Syed copyright notices if code is reused. |
| [Messenger Desktop `src/main/main.ts`](https://github.com/WinTer1165/Messenger-Desktop-Client-Unofficial/blob/07fbfc6/src/main/main.ts) and [`src/main/navigation.ts`](https://github.com/WinTer1165/Messenger-Desktop-Client-Unofficial/blob/07fbfc6/src/main/navigation.ts) | Closest Electron reference: uses `WebContentsView`, a persistent Messenger session, `will-navigate` and `will-redirect`, redirect unwrapping, popup classification, and `restoreIfStranded()` after an external navigation is blocked. Its recovery pattern fits Mado well. Its in-app classifier is still host-based and allows Facebook pages outside Messenger, so Mado needs a narrower path policy. | Medium to adapt selectively. Redirect parsing and recovery are maintainable if kept pure and tested; Facebook routes and call popups remain platform-sensitive. MIT. |
| Messenger Desktop [`window-manager.ts`](https://github.com/WinTer1165/Messenger-Desktop-Client-Unofficial/blob/07fbfc6/src/main/window-manager.ts), [`menu.ts`](https://github.com/WinTer1165/Messenger-Desktop-Client-Unofficial/blob/07fbfc6/src/main/menu.ts), `main.ts` session setup | Demonstrates debounced, display-validated window bounds, shortcuts registered on each focused `webContents`, and an explicit session permission handler. These patterns are compatible with Mado. The reference automatically grants a broad permission list including media and screen capture; do not copy that policy without user consent and testing. | Window state: Small/Medium. Shortcuts: Small. Permission design: Medium and security-sensitive. MIT. |

**Conclusion:** reuse the ideas, not a client. Keep Mado’s existing `WebContentsView` and persistent session. The references’ broad “Facebook is in-app” policies conflict with Mado’s product boundary.

## 4. Recommended technical approaches

### Messenger-only navigation

1. Introduce a pure main-process URL policy that parses URLs and checks protocol, exact host boundaries, and route. Permit Messenger conversation routes plus the minimum tested login/checkpoint/auth routes; do not treat all `facebook.com` pages as Messenger.
2. Apply it to top-level `will-navigate` and `will-redirect`. Handle same-document Facebook SPA route changes with `did-navigate-in-page` as a recovery signal; this event is post-navigation, so it supplements rather than replaces pre-navigation checks.
3. Keep `setWindowOpenHandler`, classify the destination before acting, open only validated web links externally, and reject unsafe schemes. Unwrap known Facebook redirectors only after parsing and validating the resolved HTTP(S) destination.
4. On an unexpected route or failed recovery, reload the canonical Messages URL in the same persistent session and show a visible **Back to Messenger** control. Keep recovery separate from history Back/Forward.
5. Restrict only top-level navigation. Do not block Messenger’s subresource traffic needed for `fbcdn`/`fbsbx` images and attachments, or the tested CAPTCHA/authentication flow. Do not grant camera, microphone, notifications, or screen capture automatically.
6. Optionally hide clearly identified Facebook navigation chrome with minimal semantic selectors, but treat those selectors as cosmetic and revalidate them after Facebook UI changes. Navigation enforcement must work even when CSS breaks.

### RSS and layout

- First validate the flex-collapse hypothesis in DevTools: compare `.article-card` bounding heights, `flex-shrink`, and `.feed-container` scroll height with 171 items. Test a non-shrinking card rule and verify text, not just borders. Remove the empty observer/pagination code or implement it only if measured performance requires it.
- Then reserve the Messenger width in the React layout so the feed header/cards never extend underneath the native view. Derive the reserved width from the same visible/width settings used for `WebContentsView` bounds.
- Make the toolbar respond to the **usable feed width**, not just window width. At 1000px, ensure the Feed title, search, filters, and Manage action wrap/collapse without being covered.
- Once geometry is correct, improve card hierarchy with stable thumbnail aspect ratios, readable source/date metadata, unclipped title/excerpt, and keyboard-accessible article links/actions. Keep article text sanitized/plain and do not embed arbitrary feed HTML.
- Keep the feed as the main window’s primary scroll surface. Messenger remains a fixed, resizable secondary panel and must not steal feed width or article scroll.

## 5. Prioritized V0.2 roadmap

### P0 — Broken behavior and critical correctness

1. **M03-P0-01 — Restore article card height and scrolling**  
   **Problem:** 171 shrinkable flex items plus `overflow: hidden` are a strong explanation for the reported border-only rows; all cards render at once.  
   **Approach:** Confirm computed sizing, prevent card flex-shrink, preserve intrinsic content height, and remove or implement the no-op observer. Avoid virtualization unless profiling shows it is needed.  
   **Files:** `src/renderer/components/FeedArea.tsx`, `FeedArea.css`, `ArticleCard.css`.  
   **Complexity:** Small. **Dependencies:** None. **Risks:** Too-tall cards or excessive memory if lazy rendering is added unnecessarily.  
   **Acceptance:** With 171 live articles, first/middle/last cards show readable title, source, date, and excerpt; each card has a content-sized nontrivial height; the feed scrolls to the last item without clipped text.

2. **M03-P0-02 — Reserve Messenger space and make the feed responsive**  
   **Problem:** The fixed DOM panel/native view overlays a full-width feed; controls can be hidden behind Messenger. The 900px responsive breakpoints are unreachable with a 1000px minimum window.  
   **Approach:** Make the visible Messenger width part of the app’s layout budget; coordinate React and native view bounds; add responsive toolbar behavior at practical usable widths. Preserve the current resize/toggle UX.  
   **Files:** `src/renderer/App.tsx`, `src/renderer/styles/app.css`, `FeedArea.css`, `MessengerPanel.tsx`, `MessengerPanel.css`, `src/main/index.ts`.  
   **Complexity:** Medium. **Dependencies:** None; validate with M03-P0-01. **Risks:** Bounds drift during resize or hiding Messenger.  
   **Acceptance:** At 1000×700 and the default size, Feed controls and card text remain outside the native Messenger rectangle; resizing/toggling Messenger updates the feed width correctly with no horizontal clipping.

### P1 — Core experience

3. **M03-P1-01 — Keep Messenger inside Messenger, with recovery**  
   **Problem:** The current host-only policy allows the Facebook home/news feed, and misses redirects and SPA route changes.  
   **Approach:** Implement and unit-test the narrow URL classifier; add redirect and same-document recovery handling; add a visible **Back to Messenger** action. Preserve the session and test login, conversations, attachments, and supported media.  
   **Files:** `src/main/index.ts`, `src/main/preload.ts`, `src/renderer/lib/api.ts`, `src/renderer/components/MessengerPanel.tsx`; add a focused navigation-policy module/test.  
   **Complexity:** Large. **Dependencies:** None. **Risks:** Overly strict paths can break login/checkpoints, conversation links, attachments, or calls; route allowlist will need maintenance.  
   **Acceptance:** Clicking Facebook home/feed or navigating there by history/SPA does not leave a feed displayed in Mado; Messenger threads, authentication, and attachments still work; external links open only through validated HTTP(S) handling; recovery returns to Messages.

4. **M03-P1-02 — Remove the My Facebook placeholder**  
   **Problem:** The navigation entry and implementation contradict the explicit product scope.  
   **Approach:** Remove its route/import/nav item and unused component/style; retain Feed, Sources, Settings, and Messenger. Remove stale UI copy that promises personal posts/comments.  
   **Files:** `src/renderer/App.tsx`, `components/Sidebar.tsx`, `types.ts`, `components/MyFacebook.tsx`, `MyFacebook.css`, relevant README/prototype copy.  
   **Complexity:** Small. **Dependencies:** None. **Risks:** Stale route references or documentation.  
   **Acceptance:** No My Facebook entry or route remains; all retained navigation and Messenger behavior still work.

5. **M03-P1-03 — Improve article-card hierarchy and interaction**  
   **Problem:** After geometry is fixed, the feed still needs a deliberate reading hierarchy and robust narrow-width behavior. Current title is a clickable heading rather than a semantic link; thumbnail sizing/metadata can be refined.  
   **Approach:** Set consistent image ratios/fallbacks, typography and spacing; use keyboard-accessible link/button semantics; keep excerpts readable and actions clear. Avoid a dashboard-like redesign.  
   **Files:** `src/renderer/components/ArticleCard.tsx`, `ArticleCard.css`, `FeedArea.css`.  
   **Complexity:** Medium. **Dependencies:** M03-P0-01 and P0-02. **Risks:** Changing card density may increase scroll length or alter saved preferences.  
   **Acceptance:** Cards are scannable at all densities, images do not distort layout, titles/actions are keyboard-operable, and content remains readable at minimum window size.

### P2 — Desktop polish

6. **M03-P2-01 — Persist and validate main-window geometry**  
   **Problem:** Mado starts at fixed 1400×900 and does not persist position/size.  
   **Approach:** Persist bounds/maximized state with debounced move/resize writes; validate saved position against current displays and recenter if off-screen.  
   **Files:** `src/main/index.ts`, `src/main/store.ts`, a focused window-state helper.  
   **Complexity:** Medium. **Dependencies:** None. **Risks:** Bad saved coordinates after display changes; ensure safe defaults.  
   **Acceptance:** Size/position restore after restart; disconnected-monitor state recenters while keeping a usable size.

7. **M03-P2-02 — Make feed preferences and Sources useful**  
   **Problem:** `showReadArticles` is stored but not applied; auto-refresh is not implemented; Sources currently renders the same Feed view and there are no categories/source groups.  
   **Approach:** Define and implement preference behavior; give Sources a real source-management view or remove the duplicate nav item; add lightweight groups only if useful for a personal curated list.  
   **Files:** `src/renderer/components/FeedArea.tsx`, `FeedManager.tsx`, `Sidebar.tsx`, `Settings.tsx`, `src/main/index.ts`, store/hooks.  
   **Complexity:** Medium. **Dependencies:** P0 layout. **Risks:** Ambiguous “show read” semantics and surprising background network activity.  
   **Acceptance:** Every visible setting has verified behavior; Sources provides distinct subscription management; auto-refresh is opt-in and reports failures.

8. **M03-P2-03 — Add focused desktop shortcuts and Messenger status cues**  
   **Problem:** No global app shortcuts, tray state, unread badge, or native Messenger notification integration exists.  
   **Approach:** Start with a small shortcut set bound to both focused surfaces; later add opt-in Messenger notifications/unread cues through an explicit permission path, without reading message DOM or scraping private conversations.  
   **Files:** `src/main/index.ts`, `src/main/preload.ts`, renderer API/components, settings/store.  
   **Complexity:** Medium (shortcuts); Large (notifications/unread). **Dependencies:** P1 navigation/route behavior. **Risks:** Duplicate notifications, focus conflicts, privacy leakage, or brittle page integration.  
   **Acceptance:** Shortcuts work with either feed or Messenger focused; notification behavior is opt-in, permissioned, deduplicated, and does not expose message content unexpectedly.

9. **M03-P2-04 — Define least-privilege media permissions**  
   **Problem:** Mado has no explicit Messenger session permission policy.  
   **Approach:** Add a permission handler with origin checks and user-mediated grants only for features actually needed. Keep attachments working; separately decide whether calls/screen sharing are supported. RSS cards currently contain no inline video, so do not add a page monkey-patch for RSS.  
   **Files:** `src/main/index.ts` (Messenger session setup), Settings/UI only if a permission preference is needed.  
   **Complexity:** Medium. **Dependencies:** Manual Messenger attachment/call tests. **Risks:** Denying a required permission may break calls or media; broad automatic grants are unsafe.  
   **Acceptance:** Unknown permissions are denied; any supported media permission is requested in context and verified without breaking attachments or authentication.

### P3 — Future ideas

10. **M03-P3-01 — Add OPML import/export**  
    **Problem:** Curated sources are local and manually managed.  
    **Approach:** Support a user-selected OPML file with validation and duplicate handling; export subscriptions without accounts/cloud sync.  
    **Files:** `src/main/index.ts`, preload/API, `FeedManager.tsx`, feed types.  
    **Complexity:** Medium. **Dependencies:** P2 Sources design. **Risks:** Malformed files and untrusted URLs; validate protocols before saving.  
    **Acceptance:** Import/export round-trips RSS/Atom subscriptions locally and rejects malformed or unsupported entries with clear feedback.

## 6. Three highest-value tasks to do next

1. **M03-P0-01:** Stop the article cards collapsing and verify 171 readable items in a real window.
2. **M03-P0-02:** Reserve Messenger’s width so the primary feed and controls are not obscured.
3. **M03-P1-01:** Enforce Messenger-only navigation and provide a clear recovery action.

Remove My Facebook (M03-P1-02) is a small, explicit scope cleanup and should be included in the same V0.2 delivery.

## 7. Rejected or deferred approaches

- **Do not replace `WebContentsView` with a custom Messenger API, scrape, or rebuild the chat UI.** The existing embedded session works and the references do not establish a need for replacement.
- **Do not rely only on CSS to remove Facebook navigation.** Selectors are brittle and do not prevent URL changes.
- **Do not copy a hostname-only allowlist.** Both Chatpane’s internal URL policy and Messenger Desktop’s in-app host matching can leave normal Facebook pages in-app.
- **Do not copy Caprine’s `messenger.com` flow as-is.** Its inspected source targets a different URL and its navigation/autoplay handling depends on older page behavior.
- **Do not add inline article HTML/video or autoplay suppression now.** Mado currently renders text and image thumbnails, not feed embeds. If richer media is introduced, use sanitized content and click-to-play.
- **Defer full unread-message counts, notification mirroring, and tray behavior until privacy and permission semantics are specified.** Avoid scraping conversations or intercepting credentials/tokens.
- **Do not introduce a database, accounts, or cloud sync.** None is needed for this roadmap.

## 8. Security, licensing, and maintenance

- Mado’s `shell:open-external` currently restricts external links to HTTP(S), and Messenger uses context isolation, sandboxing, and disabled Node integration. Preserve these controls.
- Messenger navigation needs a route policy, not a larger “trusted Facebook” host list. Ensure policy applies to top-level navigation only so required media subresources and login/captcha frames are not accidentally blocked.
- Mado has no explicit session permission handler. Do not copy Messenger Desktop’s broad auto-grant list for camera, microphone, notifications, clipboard, and screen capture.
- Facebook’s UI, route structure, tracking redirects, and CSS selectors are third-party interfaces and can change without notice. Keep policy helpers small, add unit cases for malformed/lookalike URLs, and maintain a manual login/thread/attachment recovery checklist.
- All inspected repositories declare MIT. If code—not just ideas—is reused, preserve its copyright and license notice and review the exact copied portion. No reference code was copied for this research.
- Mado’s Electron 31 dependency is substantially older than the Electron 38 version in the Messenger Desktop snapshot. Plan any upgrade separately, check the supported/security-maintenance window, and verify WebContentsView, preload, and Facebook compatibility before shipping.

## 9. Uncertainties requiring manual GUI testing

- Measure actual `.article-card` heights, scroll height, and computed flex rules in the affected build; the flex-collapse explanation is source-based and highly plausible but not yet measured against the reported thin-line window.
- Verify the fixed native view’s overlap at 1000×700, 1400×900, collapsed sidebar, Messenger hidden, and each panel width.
- Test Facebook login/checkpoint, thread navigation, same-document SPA changes, external link redirects, attachments/downloads, image/video playback, and recovery without reusing or inspecting credentials.
- Confirm which Facebook routes/subdomains are required for the user’s actual Messenger account. The proposed route allowlist must not disrupt login, encrypted chats, media, or attachment delivery.
- Confirm desired behavior for `showReadArticles`, automatic refresh, unread notification previews, and whether Messenger calls/screen sharing are in V0.2.
- Production build and typecheck success do not establish these visual or interactive behaviors; acceptance must include a real Electron-window check.
