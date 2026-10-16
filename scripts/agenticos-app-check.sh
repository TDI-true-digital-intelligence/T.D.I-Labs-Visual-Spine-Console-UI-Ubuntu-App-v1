#!/bin/bash
# One-shot read-only listing: Echo Agentic OS app identity chain (desktop entry -> icon -> binary)
echo "=== .desktop entries (local + system) ==="
for d in ~/.local/share/applications /usr/share/applications; do
  ls "$d" 2>/dev/null | grep -iE 'agentic|echo' | sed "s|^|$d/|"
done
echo
echo "=== echo-agentic-os.desktop contents ==="
for f in ~/.local/share/applications/echo-agentic-os.desktop /usr/share/applications/echo-agentic-os.desktop; do
  if [ -f "$f" ]; then echo "--- $f"; grep -E '^(Name|Exec|Icon|StartupWMClass|Terminal|Type)' "$f"; fi
done
echo
echo "=== Binary exists? ==="
BIN=""
[ -f ~/.local/share/applications/echo-agentic-os.desktop ] && BIN=$(grep -oP '^Exec=\K\S+' ~/.local/share/applications/echo-agentic-os.desktop | head -1)
[ -z "$BIN" ] && [ -f /usr/share/applications/echo-agentic-os.desktop ] && BIN=$(grep -oP '^Exec=\K\S+' /usr/share/applications/echo-agentic-os.desktop | head -1)
echo "Exec target: $BIN"
[ -n "$BIN" ] && ls -la "$BIN" 2>&1
echo
echo "=== Icon resolution ==="
for name in echo-agentic-os echo-agentic-os constell constellation; do
  found=$(find /usr/share/icons/hicolor ~/.local/share/icons -name "$name*" 2>/dev/null | head -3)
  [ -n "$found" ] && echo "$name -> $found"
done
echo
echo "=== Running? ==="
pgrep -af 'echo-agent-os|agentic' | grep -v grep | head -3 || echo "not running"
echo
echo "=== Dash backend :3333 ==="
curl -s -m 3 -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:3333/
echo "=== done ==="
