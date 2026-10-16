#!/bin/bash
# One-shot read-only: exec chain deps + echo-ui-guard state
echo "=== Hermes Desktop bundled electron (launch.sh target) ==="
E="$HOME/.hermes/hermes-agent/apps/desktop/node_modules/electron/dist/electron"
ls -la "$E" 2>&1 | head -2
[ -x "$E" ] && echo "EXECUTABLE: yes" || echo "EXECUTABLE: NO"
echo
echo "=== main.js window target (port + title) ==="
grep -nE '3333|loadURL|loadFile|Echo|Agentic|title' ~/.hermes/01-active-agentic-workspace/Workspace/echo-agent-os/webui/main.js | head -10
echo
echo "=== echo-ui-guard canonical store (full) ==="
ls -R ~/.hermes/backups/echo-ui/ 2>/dev/null | head -25
echo
echo "=== echo-ui-guard script + cron wiring ==="
ls -la ~/.hermes/scripts/echo-ui-guard.sh 2>/dev/null
grep -l 'echo-ui-guard' ~/.hermes/cron/jobs.json 2>/dev/null && python3 -c "import json,os; d=json.load(open(os.path.expanduser('~/.hermes/cron/jobs.json'))); jobs=d.get('jobs',d); [print(j['name'],'enabled:',j.get('enabled'),'->',j.get('script')) for j in jobs if 'ui-guard' in j.get('name','').lower() or 'ui-guard' in str(j.get('script',''))]"
echo
echo "=== guard journal (last runs) ==="
journalctl --user -t 'echo-ui-guard' --since '3 days ago' --no-pager 2>/dev/null | tail -6
grep -i 'ui-guard\|ui guard' ~/.hermes/logs/*.log 2>/dev/null | tail -4
echo
echo "=== desktop-file mtime (what touched it last) ==="
stat -c '%y %n' ~/.local/share/applications/echo-agentic-os.desktop ~/.local/share/applications/'Echo Agent OS.desktop' /usr/share/applications/'Echo Agent OS.desktop' 2>/dev/null
echo "=== done ==="
