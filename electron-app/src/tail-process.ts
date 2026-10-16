/**
 * tail-process.ts — spawn and supervise spine-tail (Rust engine) from Electron.
 * Falls back to plain journalctl if the engine binary is missing.
 */

import { spawn, ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { homedir } from 'os';
import * as path from 'path';
import { EventEmitter } from 'events';
import { parseEntry } from './pure';
import { SpineEntry } from './spine-types';

const ENGINE_CANDIDATES = [
  path.join(homedir(), '.local/bin/spine-tail'),
  '/usr/local/bin/spine-tail',
  '/usr/bin/spine-tail',
  path.join(homedir(), '01-SPINE/rust-engine/target/release/spine-tail'),
];

export function findEngine(): string | null {
  for (const p of ENGINE_CANDIDATES) {
    if (existsSync(p)) return p;
  }
  return null;
}

export interface TailOptions {
  all?: boolean;
  unit?: string;
  tag?: string;
  priority?: string;
  lines?: number; // initial backlog
}

export class TailProcess extends EventEmitter {
  private proc: ChildProcess | null = null;
  private buffer = '';
  private closed = false;

  constructor(private readonly enginePath: string | null) {
    super();
  }

  start(opts: TailOptions): void {
    const args: string[] = [];
    let cmd: string;
    if (this.enginePath) {
      cmd = this.enginePath;
      if (opts.all) args.push('--all');
      if (opts.unit) args.push('--unit', opts.unit);
      if (opts.tag) args.push('--tag', opts.tag);
      if (opts.priority) args.push('--priority', opts.priority);
    } else {
      // Fallback: journalctl JSON, normalized to SpineEntry shape
      cmd = 'journalctl';
      args.push('--follow', '--no-pager', '--output=json');
      if (opts.unit) args.push(`-u${opts.unit}`);
      if (opts.tag) args.push(`-t${opts.tag}`);
      if (opts.priority) args.push(`-p${opts.priority}`);
      if (opts.lines) args.push(`-n${opts.lines}`);
    }

    const child = spawn(cmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      // CRITICAL: do NOT inherit listening fds (e.g. --remote-debugging-port).
      // journalctl/spine-tail children kept the CDP listener open and stole
      // accepts — probe timeouts + fd leak into every engine child.
      detached: false,
    });
    // best-effort: close any inherited fds beyond stdio on POSIX
    // (node doesn't expose close_fds, but spawn defaults to CLOEXEC on linux
    // for pipes; the leak came from Electron's own fd passing — documented
    // in README: never launch the console with --remote-debugging-port in prod)
    this.proc = child;
    child.on('error', (err) => {
      // ENOENT / EACCES etc. — emit instead of crashing the main process
      this.emit('log', `spawn error: ${err.message}`);
      if (!this.closed) this.emit('exit', -1);
    });
    if (child.stdout) child.stdout.setEncoding('utf8');
    child.stdout && child.stdout.on('data', (chunk: string) => {
      this.buffer += chunk;
      let idx: number;
      while ((idx = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, idx);
        this.buffer = this.buffer.slice(idx + 1);
        const entry = parseEntry(line);
        if (entry) this.emit('entry', entry);
      }
    });
    child.stderr && child.stderr.on('data', (d: string) => this.emit('log', String(d)));
    child.on('exit', (code) => {
      if (!this.closed) this.emit('exit', code);
    });
  }

  stop(): void {
    this.closed = true;
    if (this.proc) {
      this.proc.kill('SIGTERM');
      this.proc = null;
    }
  }
}
