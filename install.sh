#!/usr/bin/env bash
# SPINE installer — Rust engine + Python capture CLIs to ~/.local
# Usage: ./install.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN="${HOME}/.local/bin"
mkdir -p "$BIN"

echo "▸ 1/3 Rust engine (spine-tail)…"
if [ -x "$HERE/rust-engine/target/release/spine-tail" ]; then
  install -m 0755 "$HERE/rust-engine/target/release/spine-tail" "$BIN/spine-tail"
  echo "  installed (prebuilt release binary)"
else
  if command -v cargo >/dev/null 2>&1; then
    (cd "$HERE/rust-engine" && cargo build --release)
    install -m 0755 "$HERE/rust-engine/target/release/spine-tail" "$BIN/spine-tail"
    echo "  built + installed"
  else
    echo "  cargo not found — engine skipped (console falls back to journalctl)"
  fi
fi

echo "▸ 2/3 Python capture CLIs (spine-run, spine-cat)…"
install -m 0755 "$HERE/python-capture/spine_run.py" "$BIN/spine-run"
install -m 0755 "$HERE/python-capture/spine_cat.py" "$BIN/spine-cat"
echo "  installed"

echo "▸ 3/3 smoke test…"
"$BIN/spine-run" "echo spine-install-ok" --tag install >/dev/null 2>&1 || true
# journal writes are async — poll up to 5s instead of a blind sleep
SMOKE=""
for _ in 1 2 3 4 5; do
  if journalctl -t spine/install -n 2 --no-pager -o cat 2>/dev/null | grep -q "spine-install-ok"; then
    SMOKE=ok; break
  fi
  sleep 1
done
if [ -n "$SMOKE" ]; then
  echo "  PASS — journal capture verified"
else
  echo "  WARN — could not read journal (permissions?); CLIs still installed"
fi

cat <<'EOF'

SPINE installed:
  spine-run <cmd> [--tag name]   run anything, output journaled
  ./x.sh | spine-cat name        pipe anything into the journal
  spine-tail --all               live JSON stream of everything
  journalctl -f -t spine/<tag>   plain-journal view

Console (Electron):
  cd electron-app && npm install && npm start
EOF
