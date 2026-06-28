# Security Audit Report

Generated: 2026-06-28
Scope: full codebase
Tools used: `npm audit --audit-level=moderate`, `npm run check`, `rg`, `git grep`, manual review
Tools unavailable: `gitleaks`, `semgrep`, `trivy`, `osv-scanner`

## Executive Summary

| Severity | Count |
| -------- | ----- |
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 2 |

Overall risk assessment: acceptable for a small local-rendering utility after documenting the DevTools trust boundary. The browser extension path has a narrow permission profile; the desktop path is inherently more sensitive because it uses Chromium DevTools on localhost.

## Findings

### MEDIUM Local DevTools Port Allows Same-Machine Injection While Codex Is Running

- **Category**: OWASP A05 Security Misconfiguration / Threat Model
- **File**: `desktop/Launch-CodexRTL.ps1:26`, `desktop/inject.mjs:28`, `desktop/inject.mjs:52`
- **Evidence**: Codex is launched with a Chromium DevTools port bound to `127.0.0.1`, and the injector sends `Runtime.evaluate` to matching renderer targets. The port is local-only and `desktop/inject.mjs` refuses non-local WebSocket hosts, but any untrusted local process running as the same user while the port is open could attempt to connect to the DevTools endpoint.
- **Mitigations present**: DevTools binds to `127.0.0.1`; target WebSocket hosts are checked before injection; README and `SECURITY.md` warn users not to expose the port.
- **Remediation**: Keep the port local-only, document the same-machine trust boundary, and close Codex when the injected session is no longer needed. Avoid using this workflow on shared or untrusted Windows accounts.
- **Effort**: S

### LOW Intentional Runtime Evaluation Uses Local Project Assets

- **Category**: OWASP A08 Software and Data Integrity / JavaScript
- **File**: `desktop/inject.mjs:107`
- **Evidence**: The desktop injector builds a `Runtime.evaluate` expression and executes the local `src/injected.js` contents in the Codex renderer. This is intentional for the desktop workaround, but any malicious modification to local project files would be executed in the renderer context.
- **Mitigations present**: The injected JavaScript and CSS are read from local repo files and embedded with `JSON.stringify`; no code is fetched from the network; the browser extension content script does not use `eval`.
- **Remediation**: Tell users to download releases from the official repo, review fork diffs, and keep release archives free of generated or auth-related files.
- **Effort**: S

### LOW Dependency Install Should Avoid Lifecycle Scripts

- **Category**: Supply Chain
- **File**: `desktop/Run-CodexRTL.ps1:37`, `README.md`
- **Evidence**: The one-click launcher originally used `npm install` for first-time setup. Even with a small dependency tree, npm lifecycle scripts are a known supply-chain execution surface.
- **Mitigations present**: `package-lock.json` is committed and `npm audit --audit-level=moderate` reports zero vulnerabilities.
- **Remediation**: Changed first-time setup and documentation to `npm ci --ignore-scripts`.
- **Effort**: S

## Threat Model Summary

### Entry Points Assessed

| Entry Point | Type | Auth Required | Threats Identified |
| ----------- | ---- | ------------- | ------------------ |
| `Run-CodexRTL.cmd` | local user launcher | Windows user session | Executes bundled PowerShell script |
| `desktop/Run-CodexRTL.ps1` | local script | Windows user session | Installs dependencies and launches Codex |
| `desktop/Launch-CodexRTL.ps1` | local script | Windows user session | Opens localhost-only DevTools |
| `desktop/inject.mjs` | local Node script | localhost DevTools access | Runtime evaluation into renderer |
| `extension/injected.js` | browser content script | Chrome extension install | DOM/CSS mutation on matched ChatGPT pages |

### Key STRIDE Findings

| Threat | Category | DREAD Score | Severity |
| ------ | -------- | ----------- | -------- |
| Same-machine process connects to Codex DevTools while open | Elevation of Privilege / Tampering | 8 | MEDIUM |
| Modified local project file is evaluated in renderer | Tampering | 5 | LOW |
| Dependency lifecycle script execution during setup | Tampering / Supply Chain | 5 | LOW |

## Supply Chain Assessment

| Check | Status | Details |
| ----- | ------ | ------- |
| Lockfile committed | PASS | `package-lock.json` is tracked and pins `ws` to `8.21.0`. |
| Dependency vulnerabilities | PASS | `npm audit --audit-level=moderate` found 0 vulnerabilities. |
| Dependency confusion risk | PASS | No private package names or custom registry config found. |
| Stale dependencies | PASS | Only runtime dependency is `ws`; lockfile resolves a current 8.x release. |
| Secrets in current code | PASS | `rg` and `git grep` found no credentials; `tokens` in `scripts/check-powershell.ps1` is a parser variable, not a secret. |

## Browser Extension Assessment

The extension uses Manifest V3, has no declared permissions, no host permissions, no background worker, no storage, no message handlers, and no network access. Its content script matches are limited to ChatGPT domains and inject local CSS/JS assets only.

## Remediation Priority

### Immediate (CRITICAL)

- None.

### This Sprint (HIGH)

- None.

### Next Sprint (MEDIUM)

- [ ] Keep warning users that the desktop DevTools port is safe only when bound to localhost and used on a trusted local account.

### Backlog (LOW)

- [x] Use `npm ci --ignore-scripts` for first-time dependency setup.
- [ ] Consider adding automated secret scanning in CI before making the repo public.
- [ ] Consider publishing signed release checksums.

## Recommendations

### Quick Wins

- Keep `docs/security-checklist.md` updated for every release.
- Run `npm audit --audit-level=moderate` and `npm run check` before tagging.
- Exclude `.tools`, GitHub auth config, and `node_modules` from release archives.

### Infrastructure Improvements

- Add GitHub Actions for `npm ci --ignore-scripts`, `npm run check`, and `npm audit --audit-level=moderate`.
- Add a secret scanner such as gitleaks in CI before switching the repository to public.

### Process Improvements

- Require review of any change touching `desktop/inject.mjs`, PowerShell launchers, or `extension/manifest.json`.
- Treat new extension permissions as security-sensitive and document why each permission is needed.
