/**
 * preload.ts — safe bridge between main and renderer.
 *
 * SELF-CONTAINED BY NECESSITY: a sandboxed preload's require() only resolves
 * the 'electron' module — NOT local files (Electron >= 20 sandbox default).
 * So every pure helper the renderer needs is implemented HERE, inline, with
 * zero local imports. Keep it that way or the renderer gets a dead bridge
 * and a blank page (the v1.0.1 blank-window bug).
 *
 * The same logic also lives in pure.ts for the test suite; if you change one,
 * change both (test/pure-parity.js asserts they agree).
 */

import { contextBridge, ipcRenderer } from 'electron';
import { SpineEntry, SpineFilter, SpineSource, Priority } from './spine-types';

// ── pure helpers (mirrors pure.ts — see note above) ─────────────────────

function entryPassesFilter(e: SpineEntry, f: SpineFilter): boolean {
  if (f.source) {
    const isUnit = e.unit === f.source.replace(/^unit:/, '');
    const isTag = e.tag === f.source.replace(/^tag:/, '');
    if (!isUnit && !isTag) return false;
  }
  if (f.priority && e.priority !== f.priority) return false;
  if (f.text && !e.message.toLowerCase().includes(f.text.toLowerCase())) return false;
  return true;
}

function appendEntries(buffer: SpineEntry[], incoming: SpineEntry[], cap = 5000): SpineEntry[] {
  const next = buffer.concat(incoming);
  return next.length > cap ? next.slice(next.length - cap) : next;
}

function sourcesFromEntries(entries: SpineEntry[]): SpineSource[] {
  const map = new Map<string, SpineSource>();
  for (const e of entries) {
    const candidates: Array<[string, string, 'unit' | 'tag']> = [];
    if (e.unit) candidates.push([`unit:${e.unit}`, e.unit, 'unit']);
    if (e.tag) candidates.push([`tag:${e.tag}`, e.tag, 'tag']);
    for (const [id, label, kind] of candidates) {
      const existing = map.get(id);
      if (existing) {
        existing.count += 1;
        if (e.ts > existing.lastSeen) existing.lastSeen = e.ts;
      } else {
        map.set(id, { id, label, kind, lastSeen: e.ts, count: 1 });
      }
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

function statusLine(total: number, shown: number, f: SpineFilter): string {
  const src = f.source ? f.source : 'all sources';
  const pri = f.priority ? f.priority.toUpperCase() : 'ALL';
  const txt = f.text ? ` · grep "${f.text}"` : '';
  const state = f.paused ? 'PAUSED' : 'LIVE';
  return `${state} · ${src} · ${pri} · ${shown}/${total} entries${txt}`;
}

function shortTime(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(iso)) return iso;
  return iso.slice(11, 19);
}

function priorityClass(p: Priority): string {
  return `prio-${p}`;
}

// ── bridge ───────────────────────────────────────────────────────────────

contextBridge.exposeInMainWorld('spine', {
  engine: (): Promise<string | null> => ipcRenderer.invoke('spine:get-engine'),
  onEntry: (cb: (e: SpineEntry) => void): void => {
    ipcRenderer.on('spine:entry', (_ev, entry: SpineEntry) => cb(entry));
  },
  pure: {
    entryPassesFilter,
    appendEntries,
    sourcesFromEntries,
    statusLine,
    shortTime,
    priorityClass,
  },
});
