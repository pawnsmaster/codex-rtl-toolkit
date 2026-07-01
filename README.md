# Codex RTL Toolkit

Fix mixed Arabic/English text in Codex Desktop while keeping code left-to-right.

## Quick Start

**Download, extract, and double-click `Run-CodexRTL.cmd`.**

1. Download [`codex-rtl-toolkit-v0.1.4.zip`](https://github.com/pawnsmaster/codex-rtl-toolkit/releases/latest).
2. Extract the ZIP.
3. Save any unfinished input in Codex.
4. Double-click `Run-CodexRTL.cmd`.

Codex may remain active after its window is closed. The launcher safely closes any running Codex processes, starts a fresh RTL-enabled session, and applies the fix automatically.

Requirements: Windows, Node.js 20+, and Codex Desktop.

## What It Fixes

- Arabic paragraphs align right.
- Mixed Arabic and English render in the correct order.
- English runs and sentence-ending punctuation keep their natural position inside RTL text.
- Arabic Markdown inside fenced blocks aligns right without changing programming code direction.
- Code blocks, terminals, file paths, and inline code remain LTR.
- English-heavy messages keep their normal direction.

## What the Launcher Does

- closes running or background Codex processes
- checks that Node.js and npm are installed
- runs `npm ci --ignore-scripts` on the first launch
- starts Codex with a DevTools port bound only to `127.0.0.1`
- injects the local RTL rendering fix
- checks GitHub Releases at most once every 24 hours and prints a link when an update is available

It does not download updates automatically or change your messages, account data, or Codex installation files.

## Manual Start

For users who prefer not to run the CMD launcher, install dependencies from PowerShell:

```powershell
npm ci --ignore-scripts
```

Close Codex Desktop completely, then start it with the local debugging port:

```powershell
.\desktop\Launch-CodexRTL.ps1
```

In another terminal, inject the RTL fix:

```powershell
npm run inject
```

If the injector cannot find Codex, keep a conversation open and run `npm run inject` again.

## Security

The launcher uses Chromium DevTools on localhost only:

```text
127.0.0.1:9223
```

Do not expose this port through a tunnel, proxy, firewall rule, or shared machine. The injector refuses non-local DevTools targets.

This is a community workaround because Codex Desktop does not currently expose a documented plugin API for changing its CSS. Read [`SECURITY.md`](SECURITY.md) and [`SECURITY_AUDIT.md`](SECURITY_AUDIT.md) for the threat model and audit notes.

## Browser Extension

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select the `extension` folder.

The extension applies the same rendering fix to `chatgpt.com`. Codex Desktop is the toolkit's primary target.

## Limitations

- Desktop injection lasts for the current renderer session. If Codex reloads, run `npm run inject` again.
- The desktop launcher depends on Codex accepting Chromium flags. If a future Codex build blocks that, use the browser extension path until a better app-level hook exists.
- CSS selectors are intentionally broad because Codex UI class names can change.

## Development

After editing files in `src/`, sync the browser extension copy:

```powershell
npm run build:extension
```

Before opening a PR or release:

```powershell
npm run check
```

Security review artifacts:

- `SECURITY.md`: safe usage and reporting policy.
- `SECURITY_AUDIT.md`: audit report for the current codebase.
- `docs/security-checklist.md`: release checklist.

## Project Layout

- `src/`: shared RTL JavaScript and CSS.
- `desktop/`: Codex Desktop launcher and injector.
- `extension/`: unpacked Chrome/Edge extension.
- `scripts/`: sync and validation helpers.
- `docs/architecture.md`: implementation details.
- `docs/security-checklist.md`: release safety checklist.
- `SECURITY.md`: threat model and safe usage.
- `SECURITY_AUDIT.md`: security audit report.

## License

MIT
