# Architecture

Codex RTL Toolkit has one shared rendering fix and two delivery paths.

## Shared Assets

- `src/injected.js`: classifies Arabic-script RTL text blocks and applies `dir`.
- `src/rtl-style.css`: CSS overrides for RTL text and LTR code blocks.

Run this after editing shared assets:

```powershell
npm run build:extension
```

That copies shared assets into `extension/`, because Chrome extensions cannot load files outside their own folder.

## Desktop Path

1. `Run-CodexRTL.cmd` is the user-facing double-click launcher.
2. `desktop/Run-CodexRTL.ps1` checks prerequisites, installs dependencies when needed, launches Codex, then injects the fix.
3. `desktop/Launch-CodexRTL.ps1` launches Codex Desktop with a localhost-only DevTools port.
4. `desktop/inject.mjs` finds a Codex renderer target on `127.0.0.1`.
5. The injector evaluates the shared JavaScript and CSS in that renderer.

The injection is session-local. If Codex reloads, run `npm run inject` again.

## Browser Extension Path

The extension loads the same JavaScript and CSS on `chatgpt.com`.

## Direction Rules

- Arabic-script-heavy message text becomes RTL.
- Mixed RTL/English text uses `unicode-bidi: plaintext`.
- Markdown files in the side-panel CodeMirror editor are classified per line.
- Code, terminals, file paths inside code blocks, and non-Markdown editors stay LTR.
- Composer/input areas are ignored to avoid typing lag.
