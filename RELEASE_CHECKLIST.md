# V1.0 Release Readiness Checklist

This is a planning checklist. V0.9 does **not** publish or upload a release.

## Build and signing

- [ ] Confirm final semantic version and freeze feature scope.
- [ ] Choose and configure an EV or OV Windows code-signing certificate.
- [ ] Sign the NSIS installer and unpacked executable in CI or a controlled release machine.
- [ ] Verify signature with Windows `signtool verify` and check SmartScreen reputation plan.
- [ ] Produce reproducible build instructions and record artifact hashes.
- [ ] Remove obsolete reports and disposable verification artifacts from the working tree (V1.0 cleanup only).

## Distribution

- [ ] Decide official release host (for example GitHub Releases under `Winterunmute/Mado`).
- [ ] Configure `MADO_RELEASES_API` only for trusted release builds.
- [ ] Verify update check against a real prerelease without enabling automatic installation.
- [ ] Confirm “Open release page” opens only the canonical HTTPS release URL.
- [ ] Add checksums and release notes to public artifacts.

## Manual verification on clean Windows machines

- [ ] Fresh install on Windows 10 and Windows 11.
- [ ] Launch, restart and update-over-existing-installation.
- [ ] Verify Start Menu shortcut, optional desktop shortcut and Add/Remove Programs entry.
- [ ] Uninstall and confirm local user data retention policy is understood.
- [ ] Reinstall and confirm subscriptions, saved items, categories, custom feeds, read state and Messenger tabs survive.
- [ ] Real Facebook Messenger login, conversation tabs, attachments and navigation.
- [ ] Tray hide/show, close-to-tray and generic unread notifications.
- [ ] Multi-monitor window restoration and narrow/wide Messenger layouts.
- [ ] Live YouTube and Reddit sources from the target network.

## Security and privacy

- [ ] Re-run `npm audit` and review Electron security advisories immediately before release.
- [ ] Verify packaged CSP, context isolation, sandboxing, preload exposure and IPC validation.
- [ ] Confirm no Facebook cookies, tokens, messages, verification profiles or private files are in the installer.
- [ ] Final legal review of PRIVACY.md and THIRD_PARTY_NOTICES.md.
- [ ] Confirm the original Mado source license and add the matching `LICENSE` file.
- [ ] Review Messenger integration against current platform terms; do not claim official compatibility.

## Regression gates

- [ ] `npm.cmd run typecheck`
- [ ] `npm.cmd run build`
- [ ] `npm.cmd test`
- [ ] Electron GUI stages V0.3–V0.7 with isolated profiles.
- [ ] Packaged-app smoke test with an isolated user data directory.
- [ ] Visual screenshot review in light and dark themes.
