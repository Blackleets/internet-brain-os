#!/bin/bash
# Efesto per-user macOS install (brew-free, no admin). Everything lives in
# ~/Library/Application Support/Efesto. Pinned: Node 22, Python 3.14 (python-build-standalone),
# Ollama, Hermes Agent ae3f9f9c, pnpm 11.11.0. Usage: install-efesto-macos.sh [--dry-run] [--no-start]
set -euo pipefail
NODE_VERSION="22.23.3"
PY_TAG="20261013"; PY_VERSION="3.14.8"
OLLAMA_VERSION="v0.40.4"
HERMES_REPO="https://github.com/NousResearch/hermes-agent.git"; HERMES_REV="ae3f9f9c"
MODEL="qwen3.5:2b"
DRY=0; NOSTART=0
for a in "$@"; do case "$a" in --dry-run) DRY=1;; --no-start) NOSTART=1;; esac; done
SRC="$(cd "$(dirname "$0")/../.." && pwd)"
BASE="${EFESTO_HOME:-$HOME/Library/Application Support/Efesto}"
APP="$BASE/app"; RT="$BASE/runtime"; LOG="$BASE/logs"; PROGRESS="$BASE/install-progress.txt"
ARCH="$(uname -m)"; [ "$ARCH" = "arm64" ] && { NARCH=arm64; PARCH=aarch64; } || { NARCH=x64; PARCH=x86_64; }
mkdir -p "$BASE" "$LOG" "$RT"
step() { echo "==> $*"; echo "STEP|$*" > "$PROGRESS"; }
run() { if [ $DRY = 1 ]; then echo "(dry-run) $*"; else "$@"; fi; }
fail() { echo "Efesto necesita atención: $*" >&2; echo "DONE|1|$*" > "$PROGRESS"; exit 1; }
trap 'fail "falló en la línea $LINENO"' ERR

step "Copiando Efesto a $APP"
mkdir -p "$APP"; rsync -a --delete --exclude node_modules --exclude .git --exclude '.next' "$SRC/" "$APP/"

step "Node.js $NODE_VERSION (per-user)"
NODE_DIR="$RT/node-v$NODE_VERSION-darwin-$NARCH"
if [ ! -x "$NODE_DIR/bin/node" ]; then run bash -c "curl -fsSL https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-darwin-$NARCH.tar.gz | tar -xz -C '$RT'"; fi
export PATH="$NODE_DIR/bin:$RT/python/bin:$RT/Ollama.app/Contents/Resources:$PATH"

step "Python $PY_VERSION (python-build-standalone, per-user)"
if [ ! -x "$RT/python/bin/python3.14" ]; then run bash -c "curl -fsSL https://github.com/astral-sh/python-build-standalone/releases/download/$PY_TAG/cpython-$PY_VERSION+$PY_TAG-$PARCH-apple-darwin-install_only.tar.gz | tar -xz -C '$RT'"; fi

step "Ollama $OLLAMA_VERSION (per-user)"
if [ ! -d "$RT/Ollama.app" ]; then run bash -c "curl -fsSL -o '$RT/ollama.zip' https://github.com/ollama/ollama/releases/download/$OLLAMA_VERSION/Ollama-darwin.zip && ditto -x -k '$RT/ollama.zip' '$RT' && rm '$RT/ollama.zip'"; fi

step "Hermes Agent $HERMES_REV"
H="$BASE/hermes-agent"
if [ ! -x "$H/venv/bin/hermes" ] || [ "$(git -C "$H" rev-parse --short=8 HEAD 2>/dev/null)" != "$HERMES_REV" ]; then
  run rm -rf "$H"; run git clone --quiet "$HERMES_REPO" "$H"; run git -C "$H" checkout --quiet "$HERMES_REV"
  run "$RT/python/bin/python3.14" -m venv "$H/venv"
  run "$H/venv/bin/python" -m pip install --quiet --upgrade pip
  run "$H/venv/bin/python" -m pip install --quiet -e "$H[ddgs]"
fi
export EFESTO_HOME="$BASE" EFESTO_HERMES_ROOT="$H" HEPHAESTUS_PORT=4310 HEPHAESTUS_DATA_DIR="$BASE/kernel-data"

step "Dependencias, Kernel y panel (producción)"
cd "$APP"
run npx --yes pnpm@11.11.0 install --frozen-lockfile
run npx --yes pnpm@11.11.0 build

step "Configuración local"
run node scripts/windows/efesto-windows-stack.mjs write-config
[ $DRY = 1 ] || echo "$NODE_DIR/bin/node" > "$BASE/node-path.txt"

if [ $NOSTART = 0 ] && [ $DRY = 0 ]; then
  step "Modelo $MODEL y arranque"; node scripts/windows/efesto-windows-stack.mjs open; open "http://127.0.0.1:3311/"
fi
echo "DONE|0|$([ $DRY = 1 ] && echo 'Simulación terminada.' || echo 'Efesto está instalado.')" > "$PROGRESS"
echo "OK"
