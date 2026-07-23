#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."
PORT="${CODEX_RTL_PORT:-9223}"

if ! [[ "$PORT" =~ ^[0-9]+$ ]] || (( PORT < 1024 || PORT > 65535 )); then
  echo "CODEX_RTL_PORT must be an integer between 1024 and 65535."
  exit 1
fi

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js 20 or newer is required: https://nodejs.org/"
  exit 1
fi

APP="${CODEX_RTL_APP_PATH:-}"
if [[ -z "$APP" ]]; then
  for candidate in "/Applications/ChatGPT.app" "$HOME/Applications/ChatGPT.app" "/Applications/Codex.app" "$HOME/Applications/Codex.app"; do
    if [[ -d "$candidate" ]]; then APP="$candidate"; break; fi
  done
fi

if [[ -z "$APP" || ! -d "$APP" ]]; then
  echo "Could not find ChatGPT.app or Codex.app."
  echo "Set CODEX_RTL_APP_PATH to the application bundle and try again."
  exit 1
fi

APP_NAME="$(basename "$APP" .app)"
echo "Codex RTL Toolkit"
echo "Using $APP"

# Consider the app "running" if the main process OR any Electron helper from the
# bundle is alive, so a windowless/background instance is still detected.
app_processes_running() {
  pgrep -x "$APP_NAME" >/dev/null 2>&1 || pgrep -f "$APP/Contents/" >/dev/null 2>&1
}

if app_processes_running; then
  echo "Closing $APP_NAME so the debugging option is applied..."
  # Ask the app to quit first (gracefully closes windows and helpers).
  osascript -e "tell application \"$APP_NAME\" to quit" >/dev/null 2>&1 || true
  for _ in {1..20}; do
    app_processes_running || break
    sleep 0.25
  done

  # If a background or helper (Electron) process ignored the quit request, force
  # the whole bundle down -- main process plus every helper running from the .app.
  if app_processes_running; then
    pkill -f "$APP/Contents/" >/dev/null 2>&1 || true
    for _ in {1..20}; do
      app_processes_running || break
      sleep 0.25
    done
  fi

  if app_processes_running; then
    echo "$APP_NAME did not close. Quit it manually (including any background/helper processes) and run this launcher again."
    exit 1
  fi
fi

# npm ci keeps the install reproducible from the lockfile; --ignore-scripts skips
# dependency lifecycle scripts; --omit=dev drops devDependencies not needed at runtime.
if [[ ! -d node_modules/ws ]]; then npm ci --omit=dev --ignore-scripts; fi

# --force-ui-direction=ltr keeps the native window chrome LTR on RTL OS locales
# (see the Windows launcher note); RTL text direction is applied in the renderer.
open -na "$APP" --args \
  "--remote-debugging-address=127.0.0.1" \
  "--remote-debugging-port=$PORT" \
  "--force-ui-direction=ltr"

echo "Waiting for the Codex renderer and applying the RTL fix..."
CODEX_RTL_PORT="$PORT" npm run inject
echo "RTL support is active for this app session."
