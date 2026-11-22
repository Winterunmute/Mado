# Mado Privacy Statement (draft for public release)

Mado is a local-first desktop application. It does not create an account, send telemetry, show advertising, or rank content for engagement. Your feed data stays in a per-user application data directory on your Windows device.

## What Mado stores locally

Under `%APPDATA%\Mado\mado\` Mado stores:

- `feeds.json` — RSS/Atom, YouTube and Reddit subscriptions with category assignments.
- `read-state.json` — read/unread state by content ID.
- `saved.json` — saved item metadata snapshots (title, link, source, dates). It does not store full offline copies of copyrighted articles or videos.
- `categories.json` and `feed-views.json` — categories and custom feed definitions.
- `settings.json` — preferences, filters, Saved sort order and onboarding state.
- `messenger-tabs.json` — local conversation shortcut labels and ordering.
- `window-state.json` — window position, size and maximized state.

Messenger authentication lives separately in Electron's `persist:messenger` partition (`%APPDATA%\Mado\Partitions\messenger\`). Mado does not read or export its cookies, tokens or message content.

## External connections

Mado contacts services only for features you use:

- Your configured RSS/Atom feed URLs, YouTube channel feeds and Reddit community feeds.
- A website URL when you explicitly use **Discover** to find advertised RSS/Atom feeds.
- The article URL when you open an item in the in-app reader. Readability extraction runs locally after Mado fetches the public page.
- Facebook/Messenger when you choose to open or use the Messenger panel.
- GitHub Releases only if a trusted release API endpoint is configured for update checks. No endpoint is configured in the default V0.9 build.

Mado has no analytics, advertising trackers or telemetry. The external platforms above process requests according to their own privacy policies. Facebook, Google/YouTube and Reddit may set cookies or log access when Mado contacts them.

## Notifications

Messenger notifications are off by default. When enabled, Mado uses the page title's unread count to show a generic Windows notification without message previews. Web notification permission is denied inside Messenger to avoid duplicate or content-bearing notifications.

## Backup and reset

**Settings → Export Mado Configuration** writes subscriptions, categories, saved metadata, custom feeds and preferences to a JSON file you choose. It never includes Messenger cookies, tokens, session data, messages or read-state secrets.

**Settings → Reset All Data** requires two confirmations and clears feed, read, saved, category, view, tab, filter and window data. It deliberately preserves the Messenger session so a reset does not sign you out of Facebook.

Uninstalling the Mado application does not automatically delete application data. Users who want to remove local data should use Reset All Data before uninstalling, or manually remove `%APPDATA%\Mado` after backing up anything they want to keep.

## Security boundaries

Remote Messenger content and the local renderer both run with context isolation, sandboxing and Node integration disabled. IPC input is allowlisted and validated. Feed, reader, discovery and OPML URLs are restricted to public HTTP(S) addresses in normal builds. Article HTML is sanitized and unsafe resource schemes are removed.

This statement was reviewed for the V1.0 public release. The installer is currently unsigned; this does not change Mado's local data handling but is documented in the release notes.
