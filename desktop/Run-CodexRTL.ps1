$ErrorActionPreference = "Stop"

function Fail($message) {
  Write-Host ""
  Write-Host "ERROR: $message" -ForegroundColor Red
  exit 1
}

function Info($message) {
  Write-Host $message -ForegroundColor Cyan
}

function Get-DesktopAppProcesses {
  $chatGPTProcesses = @(Get-Process -Name ChatGPT -ErrorAction SilentlyContinue)
  $legacyCodexProcesses = @(
    Get-Process -Name Codex -ErrorAction SilentlyContinue |
      Where-Object {
        if ($_.Path) {
          return $_.Path -notmatch '\\resources\\codex\.exe$'
        }
        return $_.MainWindowHandle -ne 0
      }
  )

  return @($chatGPTProcesses) + @($legacyCodexProcesses)
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
$running = @(Get-DesktopAppProcesses)
if ($running) {
  $runningPath = $running |
    Where-Object { $_.Path -and (Test-Path $_.Path) } |
    Select-Object -First 1 -ExpandProperty Path
  if ($runningPath) {
    $env:CODEX_RTL_EXE_PATH = $runningPath
    $cacheDirectory = Join-Path $root ".cache"
    New-Item -ItemType Directory -Force -Path $cacheDirectory | Out-Null
    Set-Content -Path (Join-Path $cacheDirectory "app-path.txt") -Value $runningPath -Encoding UTF8
  }

  Write-Host "Codex/ChatGPT is running. Closing it before enabling the RTL fix..." -ForegroundColor Yellow
  $running | Stop-Process -Force

  # Poll until every desktop process (window + background/tray helpers) is gone,
  # rather than trusting a single fixed wait. Force-kill is usually instant, but on
  # slow/busy machines or with antivirus scanning the exit, a fixed 1s check can
  # fail spuriously -- and launching before the single-instance lock is released can
  # make the fresh --force-ui-direction/debug-port instance get swallowed by the old
  # one. Matches the graceful poll the macOS launcher already does. ~10s ceiling.
  $closed = $false
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Milliseconds 500
    if (-not (@(Get-DesktopAppProcesses))) {
      $closed = $true
      break
    }
  }

  if (-not $closed) {
    Fail "Codex/ChatGPT could not be closed. End its processes in Task Manager, then try again."
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

Info "Starting Codex/ChatGPT Desktop with localhost-only DevTools..."
& (Join-Path $PSScriptRoot "Launch-CodexRTL.ps1")

Info "Waiting for Codex/ChatGPT to open..."
Info "Injecting RTL fix..."
npm.cmd run inject
if ($LASTEXITCODE -ne 0) {
  Fail "The RTL fix could not connect to Codex/ChatGPT. Run Run-CodexRTL.cmd again and send the full error if it repeats."
}

Write-Host ""
Write-Host "Done. Keep this Codex window open and use it normally." -ForegroundColor Green
Write-Host "If Codex reloads or restarts, run Run-CodexRTL.cmd again."

CheckForUpdate $root
