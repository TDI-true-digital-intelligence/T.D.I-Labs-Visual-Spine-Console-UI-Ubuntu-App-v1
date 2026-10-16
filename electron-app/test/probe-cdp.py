#!/usr/bin/env python3
"""Probe a running console's CDP for DOM proof (port arg)."""
import json, sys, time, urllib.request, socket, base64, os

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 19225

pages = json.load(urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/list", timeout=5))
page = next((p for p in pages if p["type"] == "page"), pages[0])
print("TITLE:", page["title"])
print("URL:", page["url"][-40:])

ws = page["webSocketDebuggerUrl"]
path = "/" + ws.split("/", 3)[3]
sock = socket.create_connection(("127.0.0.1", PORT), timeout=10)
key = base64.b64encode(os.urandom(16)).decode()
sock.sendall((f"GET {path} HTTP/1.1\r\nHost: 127.0.0.1:{PORT}\r\nUpgrade: websocket\r\n"
              f"Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n").encode())
buf = b""
while b"\r\n\r\n" not in buf:
    buf += sock.recv(1024)
print("HANDSHAKE:", buf.split(b"\r\n")[0].decode())

payload = json.dumps({"id": 1, "method": "Runtime.evaluate", "params": {
    "expression": "JSON.stringify({status: document.getElementById('status')?.textContent, entries: !!document.getElementById('entries'), sidebar: !!document.getElementById('src-all'), rows: document.getElementById('entries')?.children.length, errs: window.__errs || 0})",
    "returnByValue": True}}).encode()
# RFC 6455: client->server frames MUST be masked (unmasked = silent drop)
mask = os.urandom(4)
masked = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
header = bytes([0x81, 0x80 | 126]) + len(payload).to_bytes(2, "big")
sock.sendall(header + mask + masked)

acc = b""
deadline = time.time() + 12
val = None
while time.time() < deadline and not val:
    try:
        chunk = sock.recv(4096)
    except socket.timeout:
        break
    if not chunk:
        break
    acc += chunk
    text = acc.decode("utf8", "ignore")
    idx = text.find('{"id"')
    if idx >= 0:
        for end in range(len(text), idx, -1):
            try:
                obj = json.loads(text[idx:end])
                if obj.get("id") == 1:
                    val = obj
                    break
            except json.JSONDecodeError:
                continue

if not val:
    print("NO-RESPONSE; raw bytes head:", acc[:120])
else:
    dom = json.loads(val["result"]["result"]["value"])
    print("DOM:", json.dumps(dom))
    ok = dom.get("status") and dom.get("entries") and dom.get("sidebar") and "starting" not in dom["status"]
    print("RENDER-PASS" if ok else "RENDER-FAIL")
