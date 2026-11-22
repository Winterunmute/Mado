# Development

## Requirements

- Windows 10/11
- Node.js 22 LTS
- npm 10+

## Setup

```bash
npm ci
npm run dev
```

The development script starts Vite on port 5173 and Electron against that server.

## Useful scripts

| Script | Purpose |
|---|---|
| `npm run typecheck` | TypeScript validation |
| `npm run build` | Production renderer and main build |
| `npm test` | Build main process and run Node tests |
| `npm run benchmark` | Deterministic performance fixture |
| `npm run dist:win` | Build and create the NSIS installer |

## Tests

`tests/*.test.mjs` cover storage migration, source adapters, filtering, saved content, organization, OPML, discovery, Messenger helpers, reader sanitization, window state and update checks.

Electron GUI verification is in `scripts/verify-electron.mjs`. It runs against isolated `.verification/*` profiles and local fixture servers. It never uses real Facebook credentials. Set `MADO_VERIFY_STAGE` to `v03`, `v04`, `v05`, `v06` or `v07`; use `MADO_VERIFY_RESTART=1` with `v05` for the restart suite.

Example:

```powershell
$env:MADO_VERIFY_STAGE='v07'
.\node_modules\.bin\electron.cmd --no-sandbox --disable-gpu --in-process-gpu scripts/verify-electron.mjs
```

## Release process

1. Update `package.json`, `package-lock.json`, Sidebar/Settings version text and CHANGELOG.
2. Run typecheck, build, tests, benchmark and production audit.
3. Commit changes locally.
4. Create and push a tag such as `v1.0.0`.
5. `.github/workflows/release.yml` verifies the tag, builds, tests, packages, creates `SHA256SUMS.txt` and publishes the GitHub Release.

Do not push release tags or publish artifacts without explicit authorization. The build workflow validates ordinary pushes and pull requests but never publishes a release.
