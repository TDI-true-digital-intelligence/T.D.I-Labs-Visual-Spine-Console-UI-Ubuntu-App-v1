/**
 * pure.ts — pure functions for the SPINE console. No DOM, no Electron imports.
 * Tested by test/run-tests.js without launching Electron.
 */

import { SpineEntry, SpineFilter, SpineSource, Priority } from './spine-types';

const PRIORITY_RANK: Record<Priority, number> = { err: 0, warn: 1, info: 2 };

export function parseEntry(line: string): SpineEntry | null {
  const t = line.trim();
  if (!t) return null;
  try {
    const o = JSON.parse(t) as Partial<SpineEntry>;
    if (typeof o.message !== 'string') return null;
    return {
      ts: typeof o.ts === 'string' ? o.ts : 'unknown',
      unit: o.unit ?? null,
      tag: o.tag ?? null,
      priority: (['err', 'warn', 'info'] as const).includes(o.priority as Priority)
        ? (o.priority as Priority)
        : 'info',
      message: o.message,
    };
  } catch {
    return null;
  }
}

export function entryPassesFilter(e: SpineEntry, f: SpineFilter): boolean {
  if (f.source) {
    const isUnit = e.unit === f.source.replace(/^unit:/, '');
    const isTag = e.tag === f.source.replace(/^tag:/, '');
    if (!isUnit && !isTag) return false;
  }
  if (f.priority && e.priority !== f.priority) return false;
  if (f.text && !e.message.toLowerCase().includes(f.text.toLowerCase())) return false;
  return true;
}

/** Merge an incoming entry batch into the buffer, cap size, return new buffer. */
export function appendEntries(
  buffer: SpineEntry[],
  incoming: SpineEntry[],
  cap = 5000
): SpineEntry[] {
  const next = buffer.concat(incoming);
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/** Discover sidebar sources from a batch of entries. */
export function sourcesFromEntries(entries: SpineEntry[]): SpineSource[] {
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

export function sourceCount(sources: SpineSource[]): number {
  return sources.length;
}

export function priorityClass(p: Priority): string {
  return `prio-${p}`;
}

/** Human short time from ISO ts, e.g. "15:28:59". */
export function shortTime(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(iso)) return iso;
  return iso.slice(11, 19);
}

/** Formats the status line under the toolbar. */
export function statusLine(
  total: number,
  shown: number,
  f: SpineFilter
): string {
  const src = f.source ? f.source : 'all sources';
  const pri = f.priority ? f.priority.toUpperCase() : 'ALL';
  const txt = f.text ? ` · grep "${f.text}"` : '';
  const state = f.paused ? 'PAUSED' : 'LIVE';
  return `${state} · ${src} · ${pri} · ${shown}/${total} entries${txt}`;
}
