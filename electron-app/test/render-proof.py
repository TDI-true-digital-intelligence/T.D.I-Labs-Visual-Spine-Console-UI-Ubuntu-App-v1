#!/usr/bin/env python3
"""SPINE render proof: boot packaged app, verify DOM via CDP (stdlib only)."""
import json, subprocess, time, urllib.request, socket, base64, os, signal, sys

ROOT = os.path.expanduser("~/01-SPINE/electron-app")
PORT = 19223

env = dict(os.environ, DISPLAY=":1", ELECTRON_NO_SANDBOX="1")
proc = subprocess.Popen(
    [f"{ROOT}/dist/linux-unpacked/spine-console.bin", f"--remote-debugging-port={PORT}", "."],
    env=env, cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
)

def cleanup():
    try: proc.send_signal(signal.SIGKILL)
    except Exception: pass

try:
    pages = None
    for _ in range(20):
        time.sleep(0.5)
        try:
            pages = json.load(urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/list", timeout=3))
            if pages: break
        except Exception:
            pass
    if not pages:
        print("RENDER-FAIL: no pages"); cleanup(); sys.exit(1)
    page = next((p for p in pages if p["type"] == "page"), pages[0])
    print("TITLE:", page["title"])
    ws = page["webSocketDebuggerUrl"]
    path = "/" + ws.split("/", 3)[3]
    host = ws.split("//")[1].split("/")[0].split(":")[0]

    sock = socket.create_connection((host, PORT), timeout=10)
    key = base64.b64encode(os.urandom(16)).decode()
    sock.sendall((f"GET {path} HTTP/1.1\r\nHost: {host}:{PORT}\r\nUpgrade: websocket\r\n"
                  f"Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n").encode())
    buf = b""
    while b"\r\n\r\n" not in buf:
        buf += sock.recv(1024)
    print("HANDSHAKE:", buf.split(b"\r\n")[0].decode())

    payload = json.dumps({"id": 1, "method": "Runtime.evaluate", "params": {
        "expression": "JSON.stringify({status: document.getElementById('status')?.textContent, entries: !!document.getElementById('entries'), sidebar: !!document.getElementById('src-all'), rows: document.getElementById('entries')?.children.length, welcome: document.body.textContent.includes('SPINE')})",
        "returnByValue": True}}).encode()
    # RFC 6455: client->server frames MUST be masked
    mask = os.urandom(4)
    masked = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
    header = bytes([0x81, 0x80 | 126]) + len(payload).to_bytes(2, "big")
    sock.sendall(header + mask + masked)

    acc = b""
    deadline = time.time() + 15
    val = None
    while time.time() < deadline:
        try:
            chunk = sock.recv(4096)
        except socket.timeout:
            break
        if not chunk: break
        acc += chunk
        text = acc.decode("utf8", "ignore")
        idx = text.find('{"id"')
        if idx >= 0:
            for end in range(len(text), idx, -1):
                try:
                    obj = json.loads(text[idx:end])
                    if obj.get("id") == 1:
                        val = obj; break
                except json.JSONDecodeError:
                    continue
        if val: break

    if not val:
        print("RENDER-FAIL: CDP no response"); cleanup(); sys.exit(1)
    dom = json.loads(val["result"]["result"]["value"])
    print("DOM:", json.dumps(dom))
    ok = (dom.get("status") and dom.get("entries") and dom.get("sidebar")
          and "starting" not in dom["status"])
    print("RENDER-PASS" if ok else "RENDER-FAIL")
    cleanup()
    sys.exit(0 if ok else 1)
except Exception as e:
    print("RENDER-FAIL:", e)
    cleanup()
    sys.exit(1)
