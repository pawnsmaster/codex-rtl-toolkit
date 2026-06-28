# Codex RTL Toolkit

Fix Arabic/English mixed-direction text in Codex conversations without changing your messages or account data.

This repo ships two install paths:

- `desktop/`: injects RTL CSS into Codex Desktop through the local Chromium DevTools Protocol.
- `extension/`: a Chrome/Edge extension for Codex or ChatGPT in a normal browser.

## Status

This is a community workaround. It does not modify OpenAI accounts or messages. It only changes local rendering in your browser/app session.

Codex Desktop does not currently expose a documented plugin API for changing the app CSS. The desktop path therefore needs Codex to be launched with a local remote debugging port bound to `127.0.0.1`.

## Desktop Quick Start

Requirements:

- Windows
- Node.js 20+
- Codex Desktop

### One-Click Start

1. Download this repo as a ZIP and extract it.
2. Close Codex Desktop completely.
3. Double-click:

```text
Run-CodexRTL.cmd
```

The launcher will:

- check that Node.js/npm are installed
- run `npm ci --ignore-scripts` the first time
- start Codex Desktop with a localhost-only DevTools port
- inject the RTL fix

If Codex is already open, close it first and run `Run-CodexRTL.cmd` again.

### Manual Start

Install dependencies:

```powershell
npm ci --ignore-scripts
```

Close Codex Desktop, then start it with a local debugging port:

```powershell
.\desktop\Launch-CodexRTL.ps1
```

In another terminal, inject the RTL fix:

```powershell
npm run inject
```

If the script says it cannot find Codex, keep Codex open on a conversation and run `npm run inject` again.

### Desktop Security Note

The launcher uses Chromium DevTools on localhost only:

```text
127.0.0.1:9223
```

Do not expose this port through a tunnel, proxy, firewall rule, or shared machine. The injector refuses non-local DevTools targets.

## Browser Extension

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select the `extension` folder.

The extension injects the same RTL fix into `chatgpt.com`.

## What It Fixes

- Arabic paragraphs are aligned right.
- Mixed Arabic and English uses `unicode-bidi: plaintext`.
- Code blocks, terminals, file paths, and inline code remain LTR.
- Arabic-heavy messages get `dir="rtl"` automatically.
- English-heavy messages stay browser-default.

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

## Suggested Repo Name

```text
codex-rtl-toolkit
```

## Project Layout

- `src/`: shared RTL JavaScript and CSS.
- `desktop/`: Codex Desktop launcher and injector.
- `extension/`: unpacked Chrome/Edge extension.
- `scripts/`: sync and validation helpers.
- `docs/architecture.md`: implementation details.
- `SECURITY.md`: threat model and safe usage.

## License

MIT
