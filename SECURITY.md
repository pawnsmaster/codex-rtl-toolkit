# Security Policy

## Scope

Codex RTL Toolkit changes local rendering only. It does not read, store, upload, or modify conversation data.

## Desktop Security Model

The desktop workflow uses Chromium's DevTools Protocol because Codex/ChatGPT Desktop does not expose a documented CSS-extension API.

The launcher binds DevTools to localhost only:

```powershell
--remote-debugging-address=127.0.0.1
```

The injector also refuses non-local WebSocket targets. Do not expose the debugging port to a network interface, reverse proxy, tunnel, or shared machine.

After a successful launch, the toolkit checks the repository's public GitHub Releases API at most once every 24 hours. It sends no conversation data, downloads no update automatically, and ignores network failures. The last check time and release tag are stored locally in `.cache/update-check.json`.

## Safe Usage

- Run the launcher only on your own machine.
- Close Codex/ChatGPT Desktop when you no longer need the injected session.
- Do not change `CODEX_RTL_PORT` to a privileged or externally exposed port.
- Review changes before running scripts from forks.
- Prefer official GitHub releases from this repository over copied scripts or modified ZIP files.

## Release Safety

Release archives should not include local tooling, GitHub authentication config, `node_modules`, or generated logs. Before tagging, run:

```powershell
npm ci --ignore-scripts
npm run check
npm audit --audit-level=moderate
```

## Reporting Issues

Please open a GitHub issue with:

- Operating system and app version
- Whether you used Desktop or Browser Extension mode
- A screenshot with sensitive content removed
- Steps to reproduce
