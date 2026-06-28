# Security Checklist

Use this checklist before publishing a release.

## Desktop Launcher

- [ ] Codex is launched with `--remote-debugging-address=127.0.0.1`.
- [ ] `desktop/inject.mjs` refuses non-local `webSocketDebuggerUrl` hosts.
- [ ] The DevTools port is not exposed through a firewall rule, tunnel, proxy, or shared machine.
- [ ] Dependency install uses `npm ci --ignore-scripts`.
- [ ] PowerShell scripts parse successfully with `npm run check`.

## Browser Extension

- [ ] `extension/manifest.json` uses Manifest V3.
- [ ] Content script matches are limited to `https://chatgpt.com/*` and `https://*.chatgpt.com/*`.
- [ ] No extension permissions or host permissions are requested.
- [ ] No background service worker, message handler, storage, or network permissions are present.
- [ ] No remote script, `eval`, `innerHTML`, `document.write`, or `insertAdjacentHTML` is used in the content script.

## Supply Chain

- [ ] `package-lock.json` is committed.
- [ ] `npm audit --audit-level=moderate` reports zero vulnerabilities.
- [ ] `npm run check` passes.
- [ ] Generated release ZIPs do not include `.tools`, GitHub auth config, or `node_modules`.

## Release Notes

- [ ] State clearly that the desktop mode opens a localhost-only DevTools port.
- [ ] Tell users to close Codex Desktop before using the one-click launcher.
- [ ] Tell users not to run modified scripts from forks without reviewing the diff.
