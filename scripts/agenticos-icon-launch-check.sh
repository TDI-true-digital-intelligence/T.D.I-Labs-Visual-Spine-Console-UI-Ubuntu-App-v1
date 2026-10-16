#!/bin/bash
# One-shot read-only: icon 512 check + launch.sh content + guard canonical store + window state
echo "=== 512 icon exists? ==="
ls -la /usr/share/icons/hicolor/512x512/apps/echo-agentic-os* 2>&1 | head -4
echo
echo "=== all hicolor sizes for echo-agentic-os ==="
find /usr/share/icons/hicolor -name 'echo-agentic-os*' 2>/dev/null | sort
echo
echo "=== guard canonical store ==="
find ~/.hermes/backups/echo-ui -name '*agentic*' 2>/dev/null | head -12
echo
echo "=== launch.sh ==="
cat ~/.hermes/01-active-agentic-workspace/Workspace/echo-agent-os/webui/launch.sh
echo
echo "=== webui dir (binary + main.js) ==="
ls -la ~/.hermes/01-active-agentic-workspace/Workspace/echo-agent-os/webui/ 2>/dev/null | head -12
echo
echo "=== Electron binary check ==="
WEBUI=~/.hermes/01-active-agentic-workspace/Workspace/echo-agent-os/webui
[ -d "$WEBUI/node_modules/electron/dist" ] && ls "$WEBUI/node_modules/electron/dist/electron" 2>&1 | head -2 || echo "no electron dist in node_modules"
echo
echo "=== windows open now (XWayland) ==="
export XAUTHORITY=$(ls /run/user/1000/.mutter-Xwaylandauth.* 2>/dev/null | head -1) DISPLAY=:0
wmctrl -lx 2>/dev/null | head -8
echo "=== done ==="
