$ErrorActionPreference = "Stop"

function Fail($message) {
  Write-Host ""
  Write-Host "ERROR: $message" -ForegroundColor Red
  exit 1
}

function Info($message) {
  Write-Host $message -ForegroundColor Cyan
}

function CheckForUpdate($root) {
  try {
    $package = Get-Content (Join-Path $root "package.json") -Raw | ConvertFrom-Json
    $currentVersion = [version]$package.version
    $cacheDirectory = Join-Path $root ".cache"
    $cachePath = Join-Path $cacheDirectory "update-check.json"
    $latestTag = $null
    $refresh = $true

    if (Test-Path $cachePath) {
      $cache = Get-Content $cachePath -Raw | ConvertFrom-Json
      $lastChecked = [datetime]::Parse($cache.checkedAt).ToUniversalTime()
      if (([datetime]::UtcNow - $lastChecked).TotalHours -lt 24) {
        $latestTag = $cache.latestTag
        $refresh = $false
      }
    }

    if ($refresh) {
      $headers = @{
        "Accept" = "application/vnd.github+json"
        "User-Agent" = "codex-rtl-toolkit/$currentVersion"
      }
      $release = Invoke-RestMethod `
        -Uri "https://api.github.com/repos/pawnsmaster/codex-rtl-toolkit/releases/latest" `
        -Headers $headers `
        -TimeoutSec 3
      $latestTag = $release.tag_name

      New-Item -ItemType Directory -Force -Path $cacheDirectory | Out-Null
      @{
        checkedAt = [datetime]::UtcNow.ToString("o")
        latestTag = $latestTag
      } | ConvertTo-Json | Set-Content -Path $cachePath -Encoding UTF8
    }

    if ($latestTag) {
      $latestVersion = [version]($latestTag -replace '^v', '')
      if ($latestVersion -gt $currentVersion) {
        Write-Host ""
        Write-Host "Update available: $latestTag" -ForegroundColor Yellow
        Write-Host "https://github.com/pawnsmaster/codex-rtl-toolkit/releases/latest"
      }
    }
  } catch {
    # Update checks must never interrupt the launcher.
  }
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

Info "Codex RTL Toolkit"
Write-Host ""
$running = Get-Process -Name Codex -ErrorAction SilentlyContinue
if ($running) {
  Write-Host "Codex is running. Closing it before enabling the RTL fix..." -ForegroundColor Yellow
  $running | Stop-Process -Force
  Start-Sleep -Seconds 1

  if (Get-Process -Name Codex -ErrorAction SilentlyContinue) {
    Fail "Codex could not be closed. End its processes in Task Manager, then try again."
  }
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

CheckForUpdate $root
