$ErrorActionPreference = "Stop"

$port = if ($env:CODEX_RTL_PORT) { $env:CODEX_RTL_PORT } else { "9223" }
if (-not ($port -match '^\d+$') -or [int]$port -lt 1024 -or [int]$port -gt 65535) {
  Write-Error "CODEX_RTL_PORT must be an integer between 1024 and 65535."
}

$candidateExecutables = @()
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$cachedExePath = Join-Path $root ".cache\app-path.txt"

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

function Get-PackagedApplicationIdentity($exePath) {
  if (-not $exePath) {
    return $null
  }

  $packageDirectory = Split-Path (Split-Path $exePath -Parent) -Parent
  $manifestPath = Join-Path $packageDirectory "AppxManifest.xml"
  if (-not (Test-Path $manifestPath)) {
    return $null
  }

  $packageDirectoryName = Split-Path $packageDirectory -Leaf
  if ($packageDirectoryName -notmatch '__(?<publisherId>[^_]+)$') {
    return $null
  }

  [xml]$manifest = Get-Content $manifestPath -Raw
  $packageName = [string]$manifest.Package.Identity.Name
  $applicationId = [string]($manifest.Package.Applications.Application | Select-Object -First 1).Id
  if (-not $packageName -or -not $applicationId) {
    return $null
  }

  $packageFamilyName = "${packageName}_$($matches.publisherId)"
  return [PSCustomObject]@{
    AppUserModelId = "$packageFamilyName!$applicationId"
    ManifestPath = $manifestPath
  }
}

function Start-PackagedApplication($appUserModelId, $arguments) {
  if (-not ("CodexRtl.PackageApplicationActivator" -as [type])) {
    Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

namespace CodexRtl
{
    public static class PackageApplicationActivator
    {
        [ComImport]
        [Guid("2e941141-7f97-4756-ba1d-9decde894a3d")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IApplicationActivationManager
        {
            [PreserveSig]
            int ActivateApplication(
                [MarshalAs(UnmanagedType.LPWStr)] string appUserModelId,
                [MarshalAs(UnmanagedType.LPWStr)] string arguments,
                uint options,
                out uint processId);

            [PreserveSig]
            int ActivateForFile(
                [MarshalAs(UnmanagedType.LPWStr)] string appUserModelId,
                IntPtr itemArray,
                [MarshalAs(UnmanagedType.LPWStr)] string verb,
                out uint processId);

            [PreserveSig]
            int ActivateForProtocol(
                [MarshalAs(UnmanagedType.LPWStr)] string appUserModelId,
                IntPtr itemArray,
                out uint processId);
        }

        public static uint Activate(string appUserModelId, string arguments)
        {
            var activationManagerType = Type.GetTypeFromCLSID(
                new Guid("45BA127D-10A8-46EA-8AB7-56EA9078943C"),
                true);
            var activationManager = (IApplicationActivationManager)Activator.CreateInstance(
                activationManagerType);

            try
            {
                uint processId;
                int result = activationManager.ActivateApplication(
                    appUserModelId,
                    arguments,
                    0,
                    out processId);
                Marshal.ThrowExceptionForHR(result);
                return processId;
            }
            finally
            {
                if (activationManager != null && Marshal.IsComObject(activationManager))
                {
                    Marshal.FinalReleaseComObject(activationManager);
                }
            }
        }
    }
}
"@
  }

  return [CodexRtl.PackageApplicationActivator]::Activate($appUserModelId, $arguments)
}

function AddCandidateExecutable($path) {
  if (-not $path) {
    return
  }

  $trimmedPath = $path.Trim()
  if (-not $trimmedPath) {
    return
  }

  if ($trimmedPath -match '\\resources\\codex\.exe$') {
    return
  }

  $script:candidateExecutables += $trimmedPath
}

if ($env:CODEX_RTL_EXE_PATH -and (Test-Path $env:CODEX_RTL_EXE_PATH)) {
  AddCandidateExecutable $env:CODEX_RTL_EXE_PATH
}

if (Test-Path $cachedExePath) {
  AddCandidateExecutable (Get-Content $cachedExePath -Raw)
}

$package = Get-AppxPackage -Name OpenAI.Codex -ErrorAction SilentlyContinue
if ($package) {
  AddCandidateExecutable (Join-Path $package.InstallLocation "app\ChatGPT.exe")
  AddCandidateExecutable (Join-Path $package.InstallLocation "app\Codex.exe")
}

$exe = $candidateExecutables | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $exe) {
  Write-Error "Could not find ChatGPT.exe or Codex.exe. Open the app normally once, then run Run-CodexRTL.cmd again."
}

$running = @(Get-DesktopAppProcesses)
if ($running) {
  Write-Error "Codex/ChatGPT is already running. Close it first, then run this launcher again so the debugging port is enabled."
}

Write-Host "Starting Codex/ChatGPT with local DevTools port $port..."
# --force-ui-direction=ltr is a Chromium switch honored at process start. On an
# Arabic/RTL Windows locale Chromium otherwise mirrors the native window chrome
# (WS_EX_LAYOUTRTL), flipping the minimize/maximize/close controls onto the app's
# own buttons and misplacing the menu bar. Forcing LTR chrome fixes that without
# modifying the app; the RTL text direction is handled separately in the renderer.
$devToolsArguments = "--remote-debugging-address=127.0.0.1 --remote-debugging-port=$port --force-ui-direction=ltr"

try {
  Start-Process -FilePath $exe -ArgumentList "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=$port", "--force-ui-direction=ltr"
} catch {
  $directLaunchError = $_.Exception.Message
  $packagedIdentity = Get-PackagedApplicationIdentity $exe
  if (-not $packagedIdentity) {
    Write-Error "Direct launch failed ($directLaunchError), and no Windows package identity could be found for $exe"
  }

  Write-Host "Direct launch was blocked by Windows. Using packaged app activation..." -ForegroundColor Yellow
  try {
    $activatedProcessId = Start-PackagedApplication $packagedIdentity.AppUserModelId $devToolsArguments
    Write-Host "Windows activated Codex/ChatGPT (process $activatedProcessId)."
  } catch {
    $packagedLaunchError = $_.Exception.Message
    Write-Error "Could not start Codex/ChatGPT. Direct launch: $directLaunchError Packaged launch: $packagedLaunchError"
  }
}

Write-Host "Codex/ChatGPT started. Keep it open, then run: npm run inject"
