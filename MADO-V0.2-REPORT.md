# Mado V0.2 implementation report

Date: 2026-11-21. Implemented and validated before starting V0.3. Live Facebook acceptance remains manual.

## Changes implemented

- Read state now belongs to the shared React store. Marking read immediately removes the article from Unread; cards no longer maintain a conflicting copy. Refresh overlays in-session changes and reads persisted status after network completion. Main-process read updates are atomic. Mark-all operates on the displayed articles without refetching feeds.
- All/Unread and Settings → Show Read Articles use one persisted preference. Search combines with that preference. Empty Unread explains how to revisit articles.
- Theme updates the root theme attribute and color scheme. Existing dark variables remain; light colors and contrast, controls, shadows, and native window chrome are coordinated. Preferences load even when fetching articles fails.
- Sources now renders a dedicated, scrollable subscription manager using the existing shared feed actions. It supports URL validation, RSS/Atom parsing before subscribing, duplicate rejection, enable/disable, remove, individual/all refresh, source names, last-check timestamps, and operation errors/loading feedback.
- Removed the layout rule that forced Settings overflow to hidden. Settings and Sources have independent scroll areas. Scoped conflicting toggle/header styles. Sidebar collapses at small window widths; toolbar responds to actual available feed width.
- Fixed stale-state Messenger dragging using pointer capture; kept keyboard resizing and the 320–600px range. Added a 36px draggable titlebar so native caption buttons do not obscure Messenger controls. Native view starts below both titlebar and toolbar.
- Preserved the persistent Messenger partition, WebContentsView, context isolation, sandbox and disabled Node integration. Preserved navigation, redirect, popup and SPA recovery guards. Facebook home/feed is blocked even during authentication; explicit login/checkpoint routes remain allowed. Authentication routes that change on Meta's side still require live checks.
- Messenger styling uses replaceable Electron insertCSS sheets, Facebook theme variables, and semantic global-banner selectors. It does not read messages or credentials, manipulate conversation DOM, or hide generic conversation navigation. Login pages receive no injected sheet. Recovery stays available as an accessible icon at narrow widths.
- Messenger status is queried on renderer remount so an already loaded native view does not stay labelled Loading. Aborted navigations no longer show false load failures.
- Corrected Vite's production asset base to relative paths for Electron loadFile(). Added a renderer CSP.
- Connected the existing opt-in auto-refresh preference to a cleaned-up timer.

## Verification actually performed

- `npm run typecheck`: passed.
- `npm test`: 4 focused policy/filter/theme tests passed.
- `npm run build`: passed with the Windows sandbox path workaround described below; renderer and both Electron/preload compilation steps completed.
- Real production Electron renderer/preload/IPC/store integration: 13 checks passed using controlled RSS and Messenger-shaped fixtures. Checked readable, scrollable cards; immediate Unread removal; refresh and renderer-restart persistence; Sources routing and disable/enable; Settings scrolling and its final section at 1000×700; computed light colors and persistence; feed/Messenger separation with a 600px panel; native-view bounds; and cosmetic banner hiding while retaining conversation navigation/composer.
- Inspected Electron capturePage images for dark/light feed, minimum-size Settings, and the Messenger styling fixture. Files and machine-readable results are under `.verification/v02/`. App capturePage excludes the native child view; its image was captured separately. Native desktop automation did not expose these sandbox-launched windows.

## Environment qualifications

PowerShell's npm.ps1 policy requires `npm.cmd`. This environment denies Node/esbuild access to an ancestor directory. Typecheck/tests use `NODE_OPTIONS=--preserve-symlinks --preserve-symlinks-main`. Full build ran through a temporary Q: mapping to this workspace, `MADO_PRESERVE_SYMLINKS=1`, and a temporary Node preload that restores the physical working directory for tsc. The temporary root hook and drive mapping were removed. The hook source is `.verification/build-path-hook.cjs`; normal installations should use the standard npm commands.

Normal sandboxed Chromium renderer launch was attempted and failed with `render-process-gone: launch-failed, exitCode: 49`; the GPU process also failed in this restricted environment. Diagnostic fixture verification used `--no-sandbox --disable-gpu --in-process-gpu` only on the command line. The harness intercepts Messenger HTTPS with a local synthetic page and opens an isolated workspace profile. Production sandbox settings were not weakened; no user cookies or conversations were accessed. Do not use those diagnostic flags with a real Messenger account.

## Manual acceptance still required

1. Launch normally outside the tool sandbox; verify login/checkpoint/2FA and session persistence across full quit/relaunch.
2. Verify live Facebook banner selectors, conversation switching, composer, attachments, media and theme changes. CSS variables/selectors are best-effort third-party interfaces and may need maintenance. No live authenticated styling/functionality pass is claimed.
3. Try home/feed navigation, SPA transitions and history, then Back to Messenger; verify login redirects do not become stranded by the stricter home policy.
4. Drag the divider over the live native view, test keyboard resizing, and test a real external browser launch. Fixture tests do not establish real Messenger attachments, browser launch or authentication.

No Graphify run, reference-code copying, Git commits or pushes. No My Facebook feature added.
