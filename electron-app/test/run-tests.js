/**
 * SPINE Console test suite — runs the compiled pure.js against real engine
 * output. No Electron launch needed.
 *
 *   npm test   (inside electron-app/)
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'dist');
const pure = require(path.join(dist, 'pure.js'));

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}`); }
}

// ── parseEntry ─────────────────────────────
const e1 = pure.parseEntry('{"message":"hello","priority":"err","tag":"spine/x","ts":"2026-10-09T04:29:38.521Z","unit":null}');
check('parseEntry basic', e1 && e1.message === 'hello' && e1.priority === 'err' && e1.tag === 'spine/x');
check('parseEntry rejects garbage', pure.parseEntry('not json') === null);
check('parseEntry rejects empty', pure.parseEntry('') === null);
check('parseEntry rejects missing message', pure.parseEntry('{"ts":"x"}') === null);
check('parseEntry defaults unknown priority', pure.parseEntry('{"message":"m","priority":"weird"}').priority === 'info');

// ── filters ────────────────────────────────
const fAll = { source: null, priority: null, text: '', paused: false };
const entry = { ts: '2026-10-09T04:00:00Z', unit: 'foo.service', tag: null, priority: 'err', message: 'Disk failure IMMINENT' };
check('filter passes everything by default', pure.entryPassesFilter(entry, fAll));
check('filter by source unit', pure.entryPassesFilter(entry, { ...fAll, source: 'unit:foo.service' }));
check('filter rejects other unit', !pure.entryPassesFilter(entry, { ...fAll, source: 'unit:bar.service' }));
check('filter by priority', pure.entryPassesFilter(entry, { ...fAll, priority: 'err' }));
check('filter rejects other priority', !pure.entryPassesFilter(entry, { ...fAll, priority: 'info' }));
check('filter by text case-insensitive', pure.entryPassesFilter(entry, { ...fAll, text: 'imminent' }));
check('filter rejects missing text', !pure.entryPassesFilter(entry, { ...fAll, text: 'nomatch' }));

// ── buffer + sources ───────────────────────
const entries = [
  { ts: '2026-10-09T01:00:00Z', unit: 'a.service', tag: null, priority: 'info', message: 'one' },
  { ts: '2026-10-09T02:00:00Z', unit: 'a.service', tag: null, priority: 'info', message: 'two' },
  { ts: '2026-10-09T03:00:00Z', unit: null, tag: 'spine/deploy', priority: 'info', message: 'three' },
];
check('appendEntries merges', pure.appendEntries([], entries).length === 3);
const capped = pure.appendEntries([], Array.from({ length: 6000 }, (_, i) => entries[0]), 5000);
check('appendEntries caps at 5000', capped.length === 5000);

const srcs = pure.sourcesFromEntries(entries);
check('sources discovered', srcs.length === 2);
const svc = srcs.find((s) => s.id === 'unit:a.service');
check('source counts entries', svc && svc.count === 2);
check('source lastSeen tracks max ts', svc && svc.lastSeen === '2026-10-09T02:00:00Z');

// ── helpers ────────────────────────────────
check('shortTime slices ISO', pure.shortTime('2026-10-09T04:29:38.521Z') === '04:29:38');
check('shortTime passthrough non-ISO', pure.shortTime('unknown') === 'unknown');
check('statusLine live', pure.statusLine(10, 8, fAll).startsWith('LIVE'));
check('statusLine paused', pure.statusLine(10, 8, { ...fAll, paused: true }).startsWith('PAUSED'));

// ── REAL ENGINE integration ────────────────
// Feed the Rust binary a synthetic verbose journal — proves the exact bytes
// the UI will parse.
const engine = [
  path.join(process.env.HOME, '.local/bin/spine-tail'),
  path.join(process.env.HOME, '01-SPINE/rust-engine/target/release/spine-tail'),
].find((p) => fs.existsSync(p));

if (engine) {
  const input =
    'PRIORITY=3\nSYSLOG_IDENTIFIER=spine/integration\nMESSAGE=engine says hi\n' +
    '_SOURCE_REALTIME_TIMESTAMP=1760000000000000\n\n' +
    'PRIORITY=6\nMESSAGE=second line\n\n';
  const res = spawnSync(engine, ['--stdin'], { input, encoding: 'utf8' });
  const lines = res.stdout.trim().split('\n').filter(Boolean);
  const parsed = lines.map((l) => pure.parseEntry(l));
  check('engine output parses fully', parsed.every(Boolean));
  check('engine err priority flows through', parsed[0] && parsed[0].priority === 'err');
  check('engine tag flows through', parsed[0] && parsed[0].tag === 'spine/integration');
} else {
  console.log('  (engine binary not built — skipping integration section)');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
