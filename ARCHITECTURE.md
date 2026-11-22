# Architecture

## Overview

Mado is an Electron desktop application with a React renderer. It is local-first: all user data is stored in the per-user Electron `userData` directory. There is no account, cloud sync, analytics or engagement ranking.

## Main process (`src/main/`)

- `index.ts` — application lifecycle, window/tray, notifications, IPC handlers, article aggregation and external-link policy.
- `store.ts` — electron-store wrappers, versioned feed data, read state, categories, saved items, custom views, settings, conversation tabs and window state.
- `preload.ts` / `messenger-preload.ts` — narrow contextBridge APIs for the local renderer and Messenger view.
- `sources/` — RSS/Atom, YouTube and Reddit adapters plus caching, concurrency, deduplication and stable content IDs.
- `organize/` — categories, saved metadata snapshots, custom views, OPML parsing/export and bounded source discovery.
- `reader.ts` / `reader-content.ts` — Readability extraction, sanitization, public-address validation and safe resource URLs.
- `messenger-navigation.ts` — Messenger-only URL classification, external-link decisions and recovery.
- `updates.ts` — GitHub Releases version check with a fixed official endpoint.

## Renderer (`src/renderer/`)

- `App.tsx` — view routing, shortcuts, first-run onboarding.
- `components/` — feed, sources, settings, reader, sidebar, Messenger panel and onboarding UI.
- `hooks/useStore.tsx` — shared state and typed IPC actions.
- `lib/article-filter.ts` — the single filter engine used by the normal feed, Saved view and custom views.
- `lib/api.ts` — typed renderer bridge.

## Data flow

Source adapters produce normalized `ContentItem`s with stable IDs. `getAllArticles()` merges enabled source items with saved-only metadata snapshots, applies read state and category assignments, then returns a chronological list. The renderer filters that list locally; custom views and temporary filters intersect without reordering content.

## Security model

- Context isolation and sandboxing enabled; Node integration disabled for remote content.
- Messenger uses an isolated `persist:messenger` partition and a dedicated preload.
- IPC keys and values are allowlisted and validated.
- External links and release URLs use strict HTTPS/HTTP validation.
- Feed, reader, OPML and discovery requests reject private addresses; redirects are bounded.
- Article HTML is sanitized and unsafe tags/attributes/schemes are removed.
- CSP restricts renderer scripts, frames, objects and network origins.
