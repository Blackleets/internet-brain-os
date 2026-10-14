#!/bin/bash
# Efesto.app entry point: installs on first run, then starts the stack and opens the dashboard
# (same-origin Kernel bridge, auto-connect, no pairing code). Usage: efesto-launch.sh [open|stop|status]
set -euo pipefail
BASE="${EFESTO_HOME:-$HOME/Library/Application Support/Efesto}"
HERE="$(cd "$(dirname "$0")" && pwd)"
if [ ! -f "$BASE/node-path.txt" ]; then
  osascript -e 'display notification "Instalando Efesto (la primera vez tarda unos minutos)…" with title "Efesto"' || true
  mkdir -p "$BASE/logs"; exec bash "$HERE/install-efesto-macos.sh" >> "$BASE/logs/install.log" 2>&1
fi
NODE="$(cat "$BASE/node-path.txt")"
export EFESTO_HOME="$BASE" EFESTO_HERMES_ROOT="$BASE/hermes-agent" PATH="$(dirname "$NODE"):$BASE/runtime/python/bin:$BASE/runtime/Ollama.app/Contents/Resources:$PATH"
cd "$BASE/app"
"$NODE" scripts/windows/efesto-windows-stack.mjs "${1:-open}" >> "$BASE/logs/launcher.log" 2>&1
[ "${1:-open}" = "open" ] && open "http://127.0.0.1:3311/"
