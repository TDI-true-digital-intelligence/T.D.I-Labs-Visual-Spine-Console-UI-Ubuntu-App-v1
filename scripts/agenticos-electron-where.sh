#!/bin/bash
# One-shot read-only: WHERE did electron go + what does running Hermes Desktop use
echo "=== running Hermes Desktop processes (real electron path in use) ==="
ps -eo pid,cmd --no-headers | grep -iE 'electron' | grep -v grep | cut -c1-180 | head -6
echo
echo "=== hermes-agent node_modules/electron state ==="
ls -la ~/.hermes/hermes-agent/apps/desktop/node_modules/electron/ 2>&1 | head -8
ls ~/.hermes/hermes-agent/apps/desktop/node_modules/electron/dist 2>&1 | head -3
echo
echo "=== electron dirs anywhere in hermes-agent (dist moved?) ==="
find ~/.hermes/hermes-agent -maxdepth 6 -name 'electron' -type d 2>/dev/null | head -6
find ~/.hermes/hermes-agent -maxdepth 7 -name 'electron' -type f -perm -u+x 2>/dev/null | head -6
echo
echo "=== Rob bloat backups + trash: node_modules/electron moves ==="
ls -t ~/Documents/_a_Rob_bloat_back_ups/ 2>/dev/null | head -10
ls -t ~/Documents/_0_Rob_bloat_back_ups/ 2>/dev/null | head -6
grep -l 'electron' ~/.local/share/Trash/info/*.trashinfo 2>/dev/null | head -5
find ~/Documents/_a_Rob_bloat_back_ups -maxdepth 2 -iname '*electron*' -o -maxdepth 2 -iname '*node_modules*' 2>/dev/null | head -8
echo
echo "=== hermes-agent git state ==="
git -C ~/.hermes/hermes-agent status --short 2>&1 | head -8
git -C ~/.hermes/hermes-agent log --oneline -3 2>&1
echo
echo "=== the .bak-electron-wrapper desktop (previous known-good exec) ==="
grep -E '^(Name|Exec|Icon)' ~/.local/share/applications/echo-agentic-os.desktop.bak-electron-wrapper 2>/dev/null
echo "=== done ==="
