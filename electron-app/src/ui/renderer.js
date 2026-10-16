/**
 * renderer.js — SPINE Console renderer. Plain JS (loaded as file, no bundler),
 * consuming the same pure functions compiled to dist/pure.js.
 */

// Pure helpers arrive via the preload bridge (renderer has no require()).
const { appendEntries, entryPassesFilter, sourcesFromEntries, statusLine, shortTime, priorityClass } = window.spine.pure;

let buffer = [];
let filter = { source: null, priority: null, text: '', paused: false };
let sources = [];

const entriesEl = document.getElementById('entries');
const statusEl = document.getElementById('status');
const srcListEl = document.getElementById('src-list');
const srcAllEl = document.getElementById('src-all');
const grepEl = document.getElementById('grep');
const priorityEl = document.getElementById('priority');
const pauseEl = document.getElementById('pause');

const MAX_RENDER = 800;

function renderStatus() {
  const shown = buffer.filter((e) => entryPassesFilter(e, filter)).length;
  statusEl.textContent = statusLine(buffer.length, shown, filter);
  statusEl.className = filter.paused ? '' : 'live';
}

function makeRow(e) {
  const row = document.createElement('div');
  row.className = `entry ${priorityClass(e.priority)}`;
  const src = e.tag || e.unit || '—';
  // XSS-safe: ALL dynamic values via textContent, never innerHTML
  const ts = document.createElement('span'); ts.className = 'ts'; ts.textContent = shortTime(e.ts);
  const s = document.createElement('span'); s.className = 'src'; s.title = src; s.textContent = src;
  const p = document.createElement('span'); p.className = 'pri'; p.textContent = e.priority.toUpperCase();
  const m = document.createElement('span'); m.className = 'msg'; m.textContent = e.message;
  row.append(ts, s, p, m);
  return row;
}

function renderEntries() {
  const visible = buffer.filter((e) => entryPassesFilter(e, filter));
  const slice = visible.slice(-MAX_RENDER);
  const frag = document.createDocumentFragment();
  for (const e of slice) frag.appendChild(makeRow(e));
  entriesEl.replaceChildren(frag);
  if (!filter.paused) entriesEl.scrollTop = entriesEl.scrollHeight;
  renderStatus();
}

function renderSources() {
  const frag = document.createDocumentFragment();
  for (const s of sources.slice(0, 40)) {
    const div = document.createElement('div');
    div.className = 'src' + (filter.source === s.id ? ' active' : '');
    div.dataset.id = s.id;
    const label = document.createElement('span'); label.className = 'label'; label.textContent = s.label;
    const count = document.createElement('span'); count.className = 'count'; count.textContent = s.count;
    div.append(label, count);
    div.addEventListener('click', () => {
      filter.source = filter.source === s.id ? null : s.id;
      srcAllEl.classList.toggle('active', filter.source === null);
      renderSources();
      renderEntries();
    });
    frag.appendChild(div);
  }
  srcListEl.replaceChildren(frag);
}

let sourcesDirty = false;
setInterval(() => {
  if (sourcesDirty && !filter.paused) { sourcesDirty = false; renderSources(); }
}, 1000);

window.spine.onEntry((e) => {
  if (filter.paused) return;
  buffer = appendEntries(buffer, [e]);
  sources = sourcesFromEntries(buffer);
  if (buffer.length % 10 === 0 || filter.source || filter.priority || filter.text) {
    renderEntries();
  } else {
    // fast path: append one row
    const visible = entryPassesFilter(e, filter);
    if (visible) {
      entriesEl.appendChild(makeRow(e));
      const rows = entriesEl.querySelectorAll('.entry');
      if (rows.length > MAX_RENDER) rows[0].remove();
      entriesEl.scrollTop = entriesEl.scrollHeight;
    }
    sourcesDirty = true;
    renderStatus();
  }
});

grepEl.addEventListener('input', () => { filter.text = grepEl.value; renderEntries(); });
priorityEl.addEventListener('change', () => {
  filter.priority = priorityEl.value || null;
  renderEntries();
});

function togglePause() {
  filter.paused = !filter.paused;
  pauseEl.textContent = filter.paused ? '▶ Resume' : '⏸ Pause';
  pauseEl.classList.toggle('paused', filter.paused);
  renderStatus();
}
pauseEl.addEventListener('click', togglePause);

srcAllEl.addEventListener('click', () => {
  filter.source = null;
  srcAllEl.classList.add('active');
  renderSources();
  renderEntries();
});

document.getElementById('clear').addEventListener('click', () => {
  buffer = [];
  sources = [];
  renderEntries();
  renderSources();
});

document.addEventListener('keydown', (ev) => {
  if (ev.code === 'Space' && document.activeElement !== grepEl) {
    ev.preventDefault();
    togglePause();
  }
});

window.spine.engine().then((eng) => {
  console.log('[spine] engine:', eng || 'journalctl fallback');
});

renderStatus();
