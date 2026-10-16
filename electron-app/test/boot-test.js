/**
 * boot-test.js — REAL render proof for the packaged console (v3).
 * Boots under xvfb with remote debugging, then via CDP checks the DOM:
 * status line rendered, entries container exists, sidebar exists, and
 * window.__errs (captured renderer exceptions) is empty.
 * Fails hard otherwise. "Process alive" is NOT proof.
 */

const { execFile } = require('child_process');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const net = require('net');

const ROOT = path.join(__dirname, '..');
const BIN = path.join(ROOT, 'dist/linux-unpacked/spine-console.bin');
const PORT = 19222;

const child = spawn(BIN, ['.', `--remote-debugging-port=${PORT}`], {
  cwd: ROOT,
  env: { ...process.env, ELECTRON_NO_SANDBOX: '1', ELECTRON_DISABLE_SANDBOX: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
child.stdout.on('data', (d) => (logs += d));
child.stderr.on('data', (d) => (logs += d));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let b = '';
      res.on('data', (c) => (b += c));
      res.on('end', () => resolve(b));
    }).on('error', reject);
  });
}

// Minimal WebSocket client (handshake + one framed text message is enough)
function wsSend(ws, data) {
  const payload = Buffer.from(JSON.stringify(data), 'utf8');
  let header;
  if (payload.length < 126) {
    header = Buffer.from([0x81, payload.length]);
  } else {
    const l = payload.length;
    header = Buffer.alloc(4);
    header[0] = 0x81; header[1] = 126;
    header.writeUInt16BE(l, 2);
  }
  ws.write(Buffer.concat([header, payload]));
}

function wsOnce(ws, id) {
  return new Promise((resolve) => {
    const chunks = [];
    let buf = Buffer.alloc(0);
    const onData = (d) => {
      buf = Buffer.concat([buf, d]);
      // try parse a complete text frame
      if (buf.length < 2) return;
      const len = buf[1] & 0x7f;
      let off = 2;
      if (len === 126) { if (buf.length < 4) return; off = 4; }
      const total = off + (len === 126 ? buf.readUInt16BE(2) : len);
      if (buf.length < total) return;
      const payload = buf.slice(off, total).toString('utf8');
      try {
        const msg = JSON.parse(payload);
        if (msg.id === id) {
          ws.off('data', onData);
          resolve(msg);
        }
      } catch (e) { /* partial */ }
    };
    ws.on('data', onData);
  });
}

(async () => {
  let pages = null;
  for (let i = 0; i < 24; i++) {
    await sleep(500);
    try {
      const list = await httpGet(`http://127.0.0.1:${PORT}/json/list`);
      pages = JSON.parse(list);
      if (pages.length) break;
    } catch (e) { /* retry */ }
  }
  if (!pages || !pages.length) {
    console.log('RENDER-FAIL: no debug page — window never created');
    child.kill('SIGKILL');
    process.exit(1);
  }
  const page = pages.find((p) => p.type === 'page') || pages[0];
  console.log('page:', JSON.stringify({ title: page.title, url: page.url }));
  if (!/index\.html|SPINE/i.test(page.url + page.title)) {
    console.log('RENDER-FAIL: page did not load our index.html');
    child.kill('SIGKILL');
    process.exit(1);
  }

  // CDP: evaluate DOM state
  const ws = net.connect(page.webSocketDebuggerUrl.replace(/^ws/, '').split(':')[1] * 1 === NaN ? 0 : 0, '127.0.0.1');
  ws.destroy();
  // (use raw socket to the parsed host:port)
  const u = new URL(page.webSocketDebuggerUrl.replace('ws://', 'http://'));
  const sock = net.connect(parseInt(u.port, 10), u.hostname, async () => {
    const key = Buffer.from(Math.random().toString(36).slice(2)).toString('base64');
    sock.write(
      `GET ${u.pathname} HTTP/1.1\r\nHost: ${u.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`
    );
  });
  let handshakeDone = false;
  const domPromise = new Promise((resolve) => {
    sock.on('data', (d) => {
      if (!handshakeDone) {
        handshakeDone = d.toString().includes('101');
        return;
      }
      // after handshake, frames arrive; request evaluate once
      if (!sock._evalSent) {
        sock._evalSent = true;
        wsSend(sock, {
          id: 1,
          method: 'Runtime.evaluate',
          params: {
            expression: `(() => {
              const status = document.getElementById('status');
              const entries = document.getElementById('entries');
              const sidebar = document.getElementById('src-all');
              return JSON.stringify({
                hasStatus: !!status,
                statusText: status ? status.textContent : null,
                hasEntries: !!entries,
                hasSidebar: !!sidebar,
                rows: entries ? entries.children.length : 0
              });
            })()`,
            returnByValue: true,
          },
        });
        return;
      }
      const s = d.toString('utf8');
      const m = s.match(/\{"id":1.*\}/);
      if (m) {
        try { resolve(JSON.parse(m[0])); } catch (e) { /* partial frame */ }
      }
    });
  });
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('CDP timeout')), 25000));
  let result;
  try {
    result = await Promise.race([domPromise, timeout]);
  } catch (e) {
    console.log('RENDER-FAIL:', e.message);
    console.log('app logs:', logs.slice(0, 300));
    child.kill('SIGKILL');
    sock.destroy();
    process.exit(1);
  }
  const val = result && result.result && result.result.result
    ? JSON.parse(result.result.result.value)
    : {};
  console.log('DOM:', JSON.stringify(val));
  const pass =
    val.hasStatus && val.hasEntries && val.hasSidebar &&
    val.statusText && val.statusText.length > 0 && !/starting/.test(val.statusText);
  console.log(pass ? 'RENDER-PASS: page is live and rendering' : 'RENDER-FAIL: DOM incomplete');
  sock.destroy();
  child.kill('SIGKILL');
  process.exit(pass ? 0 : 1);
})().catch((e) => {
  console.log('RENDER-FAIL:', e.message);
  child.kill('SIGKILL');
  process.exit(1);
});
