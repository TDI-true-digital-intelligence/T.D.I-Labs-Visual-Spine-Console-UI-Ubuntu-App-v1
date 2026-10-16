/**
 * SPINE Console — shared types (the "journal-bridge" contract between
 * the Rust engine's JSON lines and the TypeScript UI).
 */

export type Priority = 'err' | 'warn' | 'info';

/** One journal entry as emitted by spine-tail (one JSON object per line). */
export interface SpineEntry {
  ts: string;              // ISO 8601 UTC
  unit: string | null;     // systemd unit, if any
  tag: string | null;      // SYSLOG_IDENTIFIER, e.g. "spine/deploy"
  priority: Priority;
  message: string;
}

/** A source shown in the sidebar = a unit or a spine/<tag>. */
export interface SpineSource {
  id: string;              // 'unit:foo.service' | 'tag:spine/deploy'
  label: string;           // human label
  kind: 'unit' | 'tag';
  lastSeen: string;        // ISO ts of latest entry
  count: number;           // entries discovered in initial scan
}

/** Runtime filter state. */
export interface SpineFilter {
  source: string | null;   // null = all sources
  priority: Priority | null; // null = all priorities
  text: string;            // substring match, '' = off
  paused: boolean;
}
