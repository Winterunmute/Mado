# MADO-02 — Electron Security & Messenger Session Review

**Date:** 2026-11-12

## Current architecture and verified configuration

- The main process creates a `BrowserWindow` for the local React renderer and a separate `WebContentsView` for `https://www.facebook.com/messages/`.
- Messenger uses the persistent, isolated session partition `persist:messenger`; its cookies are stored by Electron for reuse between launches.
- Both views enable context isolation, sandboxing, and disable Node integration. Sandboxed preloads are emitted as CommonJS `.cjs` files, as required by Electron 31. Messenger also sets `webSecurity: true`, disables insecure-content loading and experimental features, and uses a minimal preload bridge.
- The Messenger view remains mounted when the React application switches between Feed, Sources, Settings, and My Facebook. Closing the panel detaches the view rather than destroying its web contents.
- RSS/app external links and Messenger popups are routed through the system browser. Messenger main-frame navigation is restricted to HTTPS Facebook domains; other HTTP(S) URLs are externalized.

## Changes made

- Replaced the deprecated Messenger `new-window` handler with `setWindowOpenHandler`; popups are denied in-app and opened externally only for HTTP(S) URLs.
- Restricted Messenger in-app navigation to the exact `facebook.com` host or its subdomains over HTTPS, preventing lookalike domains from matching.
- Added HTTP(S)-only validation to the shared external-link IPC handler.
- Restored configured Messenger width and visibility at startup and retained the selected width during window resizing.
- Inset the native view below the Messenger header and away from the resize handle so renderer controls remain usable. Main-frame load failures remove the native view so the renderer's error state can be shown.
- Fixed removal of the Messenger load-error IPC listener.
- Fixed the confirmed preload startup failure: the prior ES-module preloads were rejected by Electron's sandboxed preload loader, leaving `electronAPI` unavailable and crashing the React root. The build now emits and loads CommonJS preloads without weakening sandbox settings.

## Session persistence and manual verification

The persistent partition provides the required persistence mechanism, but login survival across an actual application restart was **not manually verified**. Do not treat the prototype report's prior claim as a test performed in this review.

To verify manually:

1. Launch Mado and sign in to Messenger in the embedded panel only if it requests login. Confirm the conversation list loads; use a non-sensitive test conversation if checking messaging.
2. Switch among Feed, Sources, Settings, and My Facebook; confirm the same Messenger session remains available.
3. Quit the application completely, relaunch it, and confirm Messenger remains signed in and the conversation list is available.
4. Resize the application and drag the Messenger divider; confirm the embedded view tracks the window and the header controls remain usable.
5. Open a Messenger link that leaves Facebook and confirm it opens in the system browser; confirm a non-HTTP(S) popup is not launched.

## Tests and build results

- `npm run build`: **passed**.
- `npm run typecheck`: **passed**.
- Headless Electron runtime check confirmed the repaired preload bridge and rendered Feed UI; it used a separate diagnostic profile and did not verify Facebook login persistence.
- `npm run lint`: unavailable because `eslint` is not installed in the project dependencies.
- No automated test script is defined in `package.json`.

## Remaining risks and recommended follow-up

- Session persistence is supported by configuration but needs the restart procedure above for empirical confirmation.
- No explicit permission allowlist/deny handler is configured for the Messenger session. Review browser permissions if notifications, camera, microphone, or other privileged capabilities are needed.
- Messenger remains a third-party remote web application; Meta may change or restrict its embedded-browser behavior.
- Electron 31 is an old major version. Plan a separately scoped, compatibility-tested upgrade to a maintained Electron release rather than mixing a framework upgrade into this stabilization task.
