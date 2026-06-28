$ErrorActionPreference = "Stop"

function Fail($message) {
  Write-Host ""
  Write-Host "ERROR: $message" -ForegroundColor Red
  exit 1
}

function Info($message) {
  Write-Host $message -ForegroundColor Cyan
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

Info "Codex RTL Toolkit"
Write-Host ""
Write-Host "Before continuing, close Codex Desktop completely." -ForegroundColor Yellow
Write-Host "If Codex is already open, this launcher may not be able to enable the local injection port."
Write-Host ""

$running = Get-Process -Name Codex -ErrorAction SilentlyContinue
if ($running) {
  Fail "Codex is still running. Close Codex Desktop, then run Run-CodexRTL.cmd again."
}

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Fail "Node.js was not found. Install Node.js 20+ from https://nodejs.org/ and try again."
}

$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npm) {
  Fail "npm was not found. Reinstall Node.js with npm enabled."
}

if (-not (Test-Path (Join-Path $root "node_modules\ws"))) {
  Info "Installing dependencies. This only runs the first time..."
  npm.cmd ci --ignore-scripts
}

Info "Starting Codex Desktop with localhost-only DevTools..."
& (Join-Path $PSScriptRoot "Launch-CodexRTL.ps1")

Info "Waiting for Codex to open..."
Start-Sleep -Seconds 5

Info "Injecting RTL fix..."
npm.cmd run inject

Write-Host ""
Write-Host "Done. Keep this Codex window open and use it normally." -ForegroundColor Green
Write-Host "If Codex reloads or restarts, run Run-CodexRTL.cmd again."
