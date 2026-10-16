/**
 * pure-parity.js — asserts the preload's inline helpers behave identically
 * to pure.ts's versions. They're duplicated BY DESIGN (sandboxed preload
 * can't require local files), so this test is the guard against drift.
 */

const path = require('path');
const assert = require('assert');

// We can't require preload.js (it needs 'electron'), so we eval-extract the
// helper functions the same way the file defines them. Simplest robust way:
// compile-time check that the function BODIES match between the two files.
const fs = require('fs');

const preloadSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'preload.ts'), 'utf8');
const pureSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'pure.ts'), 'utf8');

const fnNames = [
  'entryPassesFilter',
  'appendEntries',
  'sourcesFromEntries',
  'statusLine',
  'shortTime',
  'priorityClass',
];

function extractFn(src, name) {
  // match from "function name(" through the closing brace at line start,
  // then drop the signature (everything before the first "{\n" body) so
  // multi-line vs single-line signatures don't false-fail parity.
  const re = new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}`, 'm');
  const m = src.match(re);
  if (!m) return null;
  const bodyStart = m[0].indexOf('{');
  return m[0].slice(bodyStart).replace(/\s+/g, ' ');
}

let pass = 0, fail = 0;
for (const fn of fnNames) {
  const a = extractFn(preloadSrc, fn);
  const b = extractFn(pureSrc, fn);
  const same = a && b && a.replace(/\s+/g, ' ') === b.replace(/\s+/g, ' ');
  if (same) { pass++; console.log(`  ok  parity: ${fn}`); }
  else { fail++; console.log(`FAIL  parity: ${fn} differs between preload.ts and pure.ts`); }
}

// Behavioral parity on compiled JS for the ones pure.ts exports:
const pure = require(path.join(__dirname, '..', 'dist', 'pure.js'));
const e = { ts: '2026-10-09T04:00:00Z', unit: 'u.service', tag: null, priority: 'err', message: 'X' };
assert.strictEqual(pure.entryPassesFilter(e, { source: null, priority: null, text: '', paused: false }), true);
assert.strictEqual(pure.shortTime('2026-10-09T04:29:38.521Z'), '04:29:38');
pass += 2;

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
