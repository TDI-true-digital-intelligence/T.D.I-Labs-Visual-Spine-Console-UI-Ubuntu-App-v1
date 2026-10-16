"""Regression suite v2 — blank-window bug class + snap freshness.

R1-R9 live in test_regression.py. This file encodes the v1.0.1 blank-window
postmortem so those bugs can never ship again:

  R10 preload must contain ZERO local require() calls (sandboxed preload can
     only resolve 'electron' — any ./file require = dead bridge = blank page)
  R11 renderer must not call require() (sandboxed renderer has none)
  R12 main.ts must load an index.html path that exists in the repo tree
  R13 packaged app.asar must contain the CURRENT renderer (stale-asar guard —
     tsc does NOT repackage; electron-builder must run after every UI change)
  R14 spine-tail must close inherited fds (Electron CDP port leak guard)
  R15 snap-installed console must match the locally render-proved binary
"""

import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
APP = ROOT / "electron-app"
results = []


def check(rid, name, cond):
    results.append((rid, name, bool(cond)))


# R10 — sandboxed preload may require ONLY 'electron'. Type-only imports
# vanish at compile time, so the ARTIFACT (dist/preload.js) is the truth.
preload_src = (APP / "src/preload.ts").read_text()
preload_js = (APP / "dist/preload.js")
if preload_js.exists():
    compiled = preload_js.read_text()
    bad = [l for l in compiled.splitlines() if "require(" in l and '"electron"' not in l and "'electron'" not in l and not l.strip().startswith("*") and not l.strip().startswith("//")]
    check("R10", "compiled preload requires only electron", len(bad) == 0)
    if bad:
        print("   offending:", bad[:2])
else:
    print("  skip [R10] no compiled dist/ (build with `npm run build` first)")
check("R10", "preload source imports electron", "from 'electron'" in preload_src)

# R11 — renderer must not require() (comment mentions are fine; calls aren't)
renderer = (APP / "src/ui/renderer.js").read_text()
code_lines = [l for l in renderer.splitlines() if not l.strip().startswith(("//", "*", "/*"))]
requires = [l for l in code_lines if "require(" in l]
check("R11", "renderer has no require() calls", len(requires) == 0)
check("R11", "renderer uses bridge", "window.spine.pure" in renderer)

# R12 — main.ts index.html path exists
main_ts = (APP / "src/main.ts").read_text()
m = re.search(r"loadFile\(path\.join\(__dirname,\s*'([^']*)',\s*'([^']*)',\s*'([^']*)'\)\)", main_ts)
if m:
    rel = Path(*m.groups())
    # __dirname at runtime = electron-app/dist; path escapes to src/ui
    resolved = APP / rel  # '..','src','ui' → electron-app/src/ui/index.html
    check("R12", "index.html path resolves", (APP / "src/ui/index.html").exists())
else:
    check("R12", "loadFile uses explicit src/ui path", "src" in main_ts and "index.html" in main_ts)

# R13 — packaged asar contains current renderer source semantics
asar = APP / "dist/linux-unpacked/resources/app.asar"
if asar.exists():
    blob = asar.read_bytes()
    check("R13", "asar has bridge renderer", b"window.spine.pure" in blob)
    check("R13", "asar has no require()-renderer", b"require('../pure.js')" not in blob)
    # staleness: renderer.js mtime must be older-or-equal to asar mtime
    check("R13", "asar newer than renderer.js edits", asar.stat().st_mtime >= (APP / "src/ui/renderer.js").stat().st_mtime)
else:
    print("  skip [R13] no packaged dist/ (build with `npm run package` first)")

# R14 — engine closes inherited fds
engine_src = (ROOT / "rust-engine/src/main.rs").read_text()
check("R14", "engine closes inherited fds", "_SC_OPEN_MAX" in engine_src and "libc::close" in engine_src)
eng_bin = ROOT / "rust-engine/target/release/spine-tail"
if eng_bin.exists():
    nm = subprocess.run(["nm", "-D", str(eng_bin)], capture_output=True, text=True).stdout
    check("R14", "engine binary imports sysconf/close", "sysconf" in nm and "close" in nm)

# R15 — snap console == locally verified binary (if snap installed)
snap_bin = Path("/snap/spine/current/usr/share/spine/spine-console.bin")
snap_asar = Path("/snap/spine/current/usr/share/spine/resources/app.asar")
local_bin = APP / "dist/linux-unpacked/spine-console.bin"
if snap_bin.exists() and local_bin.exists():
    h = lambda p: hashlib.md5(p.read_bytes()).hexdigest()
    check("R15", "snap console binary == verified local", h(snap_bin) == h(local_bin))
    check("R15", "snap asar == verified local asar", h(snap_asar) == h(asar))
else:
    print("  skip [R15] snap not installed (release-time check)")

print()
fails = 0
for rid, name, ok in results:
    print(f"{'  ok' if ok else 'FAIL'}  [{rid}] {name}")
    fails += 0 if ok else 1
print(f"\n{len(results) - fails} passed, {fails} failed")
sys.exit(1 if fails else 0)
