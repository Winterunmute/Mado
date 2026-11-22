# Mado (窓) — Your Window to the World

A personal desktop application combining a unified, personally curated feed (RSS/Atom, YouTube and Reddit) with Facebook Messenger. V0.7 adds user-defined categories, saved content, custom feed views, combined filters, OPML and source discovery.

## Features

- **Unified Content Feed**: RSS/Atom articles, YouTube videos and Reddit posts in one chronological, non-algorithmic feed
- **Categories**: create, rename and delete categories; assign sources to several categories; filter by category
- **Saved Content**: save articles, videos and posts for later with read state kept separate; saved metadata survives source removal
- **Custom Feed Views**: named views based on categories, sources and content types, alongside All feed and Saved
- **Advanced Filters**: combine All/Unread/Saved, category, source type, source, content type, search and date range
- **OPML**: import/export RSS subscriptions with folder/category information and duplicate reporting
- **Source Discovery**: find advertised RSS/Atom feeds from a website URL; platform URLs route to existing adapters
- **Source Adapters**: Extensible local adapters for RSS/Atom, YouTube channels and Reddit communities
- **YouTube Channels**: Follow by canonical channel ID or channel URL; video cards, thumbnails and user-initiated **Watch on YouTube**
- **Reddit Communities**: Follow by name or URL; post text, previews, author context and **View Discussion**
- **In-app Reader**: Sanitized Readability article reader, Reddit text view and explicit external actions; no autoplay or embedded players
- **Content Cards**: Readable cards with type-specific labels, thumbnails, play indicators and read/unread states
- **Source Management**: Add, remove, enable/disable and refresh individual or all sources; per-source errors are shown
- **Read State Persistence**: Items remember read/unread status across restarts and source refreshes
- **Filter & Search**: Filter all/unread, by source type or individual source; search titles, descriptions, sources and authors
- **Adjustable Density**: Compact, comfortable, or spacious article layouts
- **Dark/Light Theme**: Toggle between themes with persistence
- **Facebook Messenger Panel**: Embedded Messenger with resize/collapse, conversation tabs, and a minimal header
- **Conversation Tabs**: Save, switch, rename, pin and close Messenger conversation shortcuts locally; pinned/open tabs persist across restarts
- **Reset All Data**: Confirmation-gated local reset of sources, read state, preferences, tabs and window state; Messenger session is preserved
- **Local Storage**: All data stored locally using electron-store (no cloud, no accounts)
- **Window Memory**: Window size, position and maximized state are restored safely across displays
- **System Tray (optional)**: Show/hide/quit from the tray, optional close-to-tray and start-minimized
- **Keyboard Shortcuts**: Ctrl+1/2/3, Ctrl+R, Ctrl+Shift+M/F and Esc
- **Messenger Activity Cues**: Optional privacy-safe Windows notification and unread dot (no message previews)
- **External Links**: Articles open in your default browser

## Screenshots

*[Add screenshots here after running the app]*

## Quick Start

### Prerequisites

- **Node.js 20+** (LTS recommended)
- **Windows 11** (tested)
- **Git** (for cloning)

### Installation

```bash
# Clone the repository
git clone https://github.com/Winterunmute/Mado.git
cd Mado

# Install dependencies
npm install

# Development mode (runs Vite dev server + Electron)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

### Development Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server + Electron (with hot reload) |
| `npm run dev:vite` | Start Vite dev server only (port 5173) |
| `npm run dev:electron` | Start Electron (waits for Vite on port 5173) |
| `npm run build` | Build both renderer (Vite) and main (TypeScript) |
| `npm run build:vite` | Build renderer only |
| `npm run build:electron` | Compile main process TypeScript |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint on source files |
| `npm run typecheck` | Type-check without emitting |

## Project Structure

```
Mado/
├── assets/                      # Original 窓 PNGs plus derived 16/24/32px ICO variants
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # Main entry point, window management, IPC
│   │   ├── preload.ts           # Preload script (renderer ↔ main bridge)
│   │   ├── messenger-navigation.ts # Messenger-only URL policy and recovery classification
│   │   ├── messenger-preload.ts # Preload for Messenger WebContentsView
│   │   ├── messenger-style.ts   # Cosmetic theme injection for Messenger
│   │   ├── conversation-tabs.ts # Pure tab key/label/persistence helpers
│   │   ├── window-state.ts      # Geometry validation and off-screen recovery
│   │   ├── shortcuts.ts         # Shortcut mapping and help text
│   │   ├── notification-policy.ts # Unread title parsing and notification rules
│   │   ├── tray.ts              # Windows tray lifecycle
│   │   ├── reader.ts / reader-content.ts # Article extraction and sanitization
│   │   ├── rss.ts               # RSS/Atom fetching & parsing (rss-parser + sanitize-html)
│   │   ├── sources/             # Unified adapters: model, RSS, YouTube, Reddit, refresh cache
│   │   ├── organize/            # Categories, saved content, custom views, OPML, discovery
│   │   └── store.ts             # Local JSON storage (electron-store)
│   ├── renderer/                # React frontend
│   │   ├── components/          # React components
│   │   │   ├── ArticleCard.tsx  # Individual article/video/post display
│   │   │   ├── ArticleReader.tsx # Sanitized in-app article reader
│   │   │   ├── FeedArea.tsx     # Main feed view with controls
│   │   │   ├── FeedManager.tsx  # Sources view for RSS/YouTube/Reddit subscriptions
│   │   │   ├── MessengerPanel.tsx # Embedded Messenger panel
│   │   │   ├── Settings.tsx     # App preferences
│   │   │   └── Sidebar.tsx      # Left navigation sidebar
│   │   ├── hooks/
│   │   │   └── useStore.tsx     # Global state management (React Context)
│   │   ├── lib/
│   │   │   ├── api.ts           # Typed IPC bridge (electronAPI)
│   │   │   └── utils.ts         # Formatting, truncation, classNames
│   │   ├── styles/
│   │   │   ├── global.css       # CSS variables, reset, scrollbars
│   │   │   └── app.css          # App layout styles
│   │   ├── App.tsx              # Root component
│   │   ├── main.tsx             # React entry point
│   │   └── types.ts             # Shared TypeScript interfaces
│   ├── index.html               # HTML template
│   ├── vite.config.ts           # Vite configuration
│   ├── tsconfig.json            # Renderer TypeScript config
│   └── tsconfig.electron.json   # Main process TypeScript config
├── dist/                        # Build output (gitignored)
├── package.json
└── README.md
```

## Technology Stack

- **Electron 31** — Desktop app framework
- **React 19** — UI library
- **TypeScript 5.5** — Type safety
- **Vite 5** — Build tool & dev server
- **electron-store 10** — Local JSON persistence
- **rss-parser 3.13** — RSS/Atom feed parsing
- **sanitize-html 2.11** — XSS-safe content sanitization
- **date-fns 3.6** — Date formatting
- **lucide-react 0.441** — Icons

## Default Sources

The app ships with these example RSS feeds:

| Feed | Category |
|------|----------|
| The Verge | Technology |
| Ars Technica | Technology |
| Kotaku | Gaming |
| PC Gamer | Gaming |
| TechCrunch | Technology |
| WIRED | Technology/Science |

You can add/remove RSS feeds, YouTube channels and Reddit communities via the **Sources** section or the **Manage** button in the feed header. No YouTube or Reddit source is enabled by default.

## Unified Feed & Sources

The Feed view combines all enabled sources in chronological order. It never recommends, ranks or engages-optimizes content; you decide what to follow.

- **RSS / Atom:** full feed URL. Existing subscriptions and read history migrate automatically.
- **YouTube:** canonical channel ID (`UC...`), `youtube.com/channel/UC...`, or the public `feeds/videos.xml?channel_id=...` URL. `@handle` URLs are not accepted because they cannot be resolved reliably.
- **Reddit:** subreddit name, `/r/name`, or a reddit.com/old.reddit.com community URL. Public feed access can be rate-limited or blocked by Reddit depending on network and policy.

Use the source-type and source selectors in the feed header to narrow the combined feed, alongside the existing All/Unread and search controls. Videos show a play indicator and open a user-initiated **Watch on YouTube** action; Reddit posts show supplied text and **View Discussion on Reddit**. Mado does not autoplay embedded video.

## Organizing Your Feed

V0.7 adds user-controlled organization without changing chronological order:

- **Categories** are created in Sources and assigned per source. Deleting a category never deletes a subscription.
- **Saved** is available from the sidebar, feed view selector or Saved filter button. Saving does not mark an item read.
- **Custom Feeds** are created in Sources from selected categories, sources and an optional content type. Switch views from the sidebar or feed header.
- **Advanced Filters** are behind the sliders button; active filters appear as chips and **Clear Filters** restores the default view.
- **OPML** import/export is available in Sources. Only RSS/Atom subscriptions are exported; native YouTube/Reddit sources are not misrepresented as RSS.
- **Discover** (magnifier in the RSS Add Source field) lists RSS/Atom feeds advertised by a website. YouTube and Reddit URLs are recognized automatically.

## Messenger Integration

The Messenger panel uses Electron's `WebContentsView` with:

- **Isolated partition** (`persist:messenger`) — separate cookie/session storage
- **Sandboxed & context-isolated** — no Node.js access for remote content
- **Custom User-Agent** — mimics Chrome on Windows
- **Navigation guards** — Messenger-only URLs in-app; other links open in the default browser
- **Conversation tabs** — compact, horizontally scrollable shortcuts backed by the same `WebContentsView`; Chats returns to the normal conversation list
- **Contextual recovery** — a discreet alert action appears if Messenger is stranded; automatic recovery still runs first
- **Resize handle** — drag to adjust panel width (320–600px)
- **Collapse/expand** — hide or show the panel from the sidebar's Hide/Show Messenger control
- **Activity cue** — a small header dot shows unread Messenger activity; clicking a tab or Chats clears it

Conversation tabs are local shortcuts that navigate one shared Messenger session; they are not independent live conversations and do not read or store message content.

## Desktop Integration

- The main window's position, size and maximized state are saved locally after a short debounce and restored on launch; off-screen positions are recentered on an available display.
- **Close to tray** and **Start minimized** are opt-in. By default, closing the window exits Mado normally. Tray **Quit Mado** always exits.
- Windows notifications are opt-in. Mado shows a generic “new Messenger activity” notification when Messenger's unread indicator increases; it never reads or displays message text. Web notification permission is denied to avoid duplicate or privileged content.
- Shortcuts: `Ctrl+1` Feed, `Ctrl+2` Sources, `Ctrl+3` Settings, `Ctrl+R` refresh feed, `Ctrl+Shift+M` toggle Messenger, `Ctrl+Shift+F` focus feed search, `Esc` close the article reader.

### Known Limitations

- OPML import uses native dialogs and does not fetch imported URLs automatically
- Source discovery is bounded and reads advertised feeds only; it is not a general crawler
- Saved items keep feed metadata, not full offline articles or videos
- Facebook may block embedding or require login challenges
- YouTube `@handle` URLs are rejected; use a canonical channel ID or channel URL
- Reddit public feeds may return 404/429 from some networks; Mado shows the source error and keeps the last successful fetch
- Conversation labels are generated from the URL until you rename them; Facebook routes may change
- Some Messenger features (voice/video calls, certain reactions) may not work
- If embedding fails, use "Open in Browser" button as fallback
- Login state persists in the `persist:messenger` partition

## Settings

Access via the **Settings** sidebar item:

| Setting | Options |
|---------|---------|
| Theme | Dark / Light |
| Feed Density | Compact / Comfortable / Spacious |
| Messenger Panel | Show / Hide |
| Messenger Width | 320–600px (slider) |
| Auto Refresh | Off / 5min / 15min / 30min / 1hr |
| Show Read Articles | On / Off |
| Manage Sources | Opens the Sources view |
| Tray / Close to tray / Start minimized | Desktop options (off by default) |
| Messenger activity alerts | On / Off (no message previews) |
| Keyboard shortcuts | Reference list in Settings |

## Data & Privacy

- **100% local** — No cloud sync, no accounts, no telemetry
- **Storage location**: `%APPDATA%\Mado\` (Windows)
- **Files**:
  - `feeds.json` — Versioned subscriptions and category assignments
  - `read-state.json` — Content read/unread map
  - `saved.json` — Saved content snapshots
  - `categories.json` — User-defined categories
  - `feed-views.json` — Custom feed definitions
  - `settings.json` — App preferences and persisted feed filters
  - `messenger-tabs.json` — Saved/pinned conversation shortcuts and local labels
  - `window-state.json` — Window size, position and maximized state
  - `messenger/` — Facebook cookies/session (Electron partition)
- **Reset all data**: Settings → Danger Zone → Reset All Data asks for two confirmations, restores default sources/categories/saved items/custom feeds/read state/preferences/tabs/window state and leaves the `messenger/` Facebook session intact.

## Building for Distribution

```bash
# Build production artifacts
npm run build

# Create Windows installer (NSIS)
npx electron-builder --win nsis
```

Output: `dist/Mado Setup 0.7.0.exe`

## Troubleshooting

### "Failed to load Messenger"
- Click **Try Again** in the panel
- Or click **Open in Browser** to use messenger.com directly
- Check Electron console for error codes (e.g., -3 = ERR_ABORTED, -105 = DNS failure)

### Sources not loading
- Verify the feed URL, channel ID or subreddit in **Sources**
- Some feeds block non-browser User-Agents; the app sends a Chrome UA
- Reddit public feeds may return 404/429; try again later or from another network
- A failed source keeps its last successful content and shows a per-source error
- Check the main process console for fetch errors

### Build fails
- Delete `node_modules` and `package-lock.json`, then `npm install`
- Ensure Node.js 20+ is active (`node --version`)

## License

MIT — Personal project, not affiliated with Meta/Facebook.

## Acknowledgments

- Inspired by classic RSS readers (Google Reader, Feedly)
- Messenger integration uses Electron's `WebContentsView` (modern replacement for `<webview>`)
- UI icons by [Lucide](https://lucide.dev); original 窓 PNGs are user-maintained in `assets/`, with derived 16/24/32px ICO variants for the taskbar/tray built by `scripts/build-small-icons.py`