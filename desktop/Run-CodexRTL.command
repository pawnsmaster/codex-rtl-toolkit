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

if pgrep -x "$APP_NAME" >/dev/null 2>&1; then
  echo "Closing $APP_NAME so the debugging option is applied..."
  osascript -e "tell application \"$APP_NAME\" to quit" >/dev/null 2>&1 || true
  for _ in {1..20}; do
    pgrep -x "$APP_NAME" >/dev/null 2>&1 || break
    sleep 0.25
  done
  if pgrep -x "$APP_NAME" >/dev/null 2>&1; then
    echo "$APP_NAME did not close. Quit it manually and run this launcher again."
    exit 1
  fi
fi

if [[ ! -d node_modules/ws ]]; then npm install --omit=dev; fi

open -na "$APP" --args \
  "--remote-debugging-address=127.0.0.1" \
  "--remote-debugging-port=$PORT"

echo "Waiting for the Codex renderer and applying the RTL fix..."
CODEX_RTL_PORT="$PORT" npm run inject
echo "RTL support is active for this app session."
