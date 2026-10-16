"""Regression suite for SPINE — every bug found this session, encoded.

Bugs encoded here (so they can't return):
  R1  journalctl verbose fields are 4-space indented (parser missed fields)
  R2  record boundary = weekday header line, not blank line (only last record flushed)
  R3  PRIORITY is numeric syslog level, not names
  R4  python shebang must be /usr/bin/python3 (venv pythons lack systemd module)
  R5  tag sanitizer must strip everything but [A-Za-z0-9._/-] (journal match safety)
  R6  renderer: no innerHTML with dynamic values (XSS via crafted SYSLOG_IDENTIFIER)
  R7  install.sh smoke: poll journal, no blind sleep race
  R8  spawn must handle 'error' event (ENOENT crash)
  R9  git repo must not track >100MB files (GitHub hard limit)
"""

import importlib.util
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
PYCAP = ROOT / "python-capture"
RENDERER = ROOT / "electron-app/src/ui/renderer.js"
TAILPROC = ROOT / "electron-app/src/src"  # placeholder, real check below


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


spine_run = _load("spine_run", PYCAP / "spine_run.py")
spine_cat = _load("spine_cat", PYCAP / "spine_cat.py")

results = []


def check(rid, name, cond):
    results.append((rid, name, bool(cond)))


# R5 — tag sanitizer
check("R5", "clean_tag strips unsafe chars", spine_run.clean_tag("bad tag!with=evil") == "bad-tag-with-evil")
check("R5", "clean_tag caps length", len(spine_cat.clean_tag("x" * 200)) == 64)
check("R5", "clean_tag empty falls back", spine_run.clean_tag("!!!") == "job")
check("R5", "clean_tag keeps safe pattern", spine_run.clean_tag("deploy.v2_beta/prod") == "deploy.v2_beta/prod")

# R4 — shebang pinned to system python
for f in ("spine_run.py", "spine_cat.py"):
    first = (PYCAP / f).read_text().splitlines()[0]
    check("R4", f"{f} shebang is /usr/bin/python3", first == "#!/usr/bin/python3")

# R1/R2/R3 — engine parses REAL journalctl verbose output (live integration)
engines = [
    Path.home() / ".local/bin/spine-tail",
    ROOT / "rust-engine/target/release/spine-tail",
]
eng = next((e for e in engines if e.exists()), None)
if eng:
    out = subprocess.run(
        ["journalctl", "-n", "5", "--no-pager", "-o", "verbose"],
        capture_output=True, text=True,
    ).stdout
    parsed = subprocess.run(
        [str(eng), "--stdin"], input=out, capture_output=True, text=True
    ).stdout.strip().splitlines()
    import json
    entries = [json.loads(l) for l in parsed if l]
    check("R1", "engine parses indented journalctl fields", len(entries) >= 2)
    check("R3", "priority mapped from numeric syslog", all(e["priority"] in ("err", "warn", "info") for e in entries))
    # R2: multi-record stream with header-line boundaries
    sample = (
        "Fri 2026-10-09 15:28:59.059909 AEDT [s=b53;i=b47d2e;b=6e30;m=f8715e7]\n"
        "    PRIORITY=6\n    MESSAGE=first-record\n\n"
        "Fri 2026-10-09 15:28:59.059962 AEDT [s=b53;i=b47d2f;b=6e30;m=f8715e7]\n"
        "    PRIORITY=3\n    MESSAGE=second-record\n\n"
    )
    p2 = subprocess.run([str(eng), "--stdin"], input=sample, capture_output=True, text=True).stdout.strip().splitlines()
    msgs = [json.loads(l)["message"] for l in p2 if l]
    check("R2", "header-line boundaries flush every record", msgs == ["first-record", "second-record"])
else:
    check("R1", "engine present for integration", False)

# R6 — renderer contains no dynamic innerHTML
src = RENDERER.read_text()
dyn_innerhtml = re.findall(r"innerHTML\s*=.*(tag|unit|message|src)", src)
check("R6", "renderer has no dynamic-value innerHTML", len(dyn_innerhtml) == 0)
check("R6", "renderer uses textContent for source", "textContent = src" in src or ".textContent = src" in src)

# R7 — install.sh polls, no blind sleep
inst = (ROOT / "install.sh").read_text()
check("R7", "install.sh polls journal in loop", "for _ in 1 2 3 4 5" in inst)

# R8 — spawn error handler present
tp = (ROOT / "electron-app/src/tail-process.ts").read_text()
check("R8", "tail-process handles spawn error event", "child.on('error'" in tp)

# R9 — no >100MB tracked files
big = subprocess.run(
    ["git", "ls-files"], cwd=ROOT, capture_output=True, text=True
).stdout.split()
too_big = []
for f in big:
    p = ROOT / f
    if p.exists() and p.stat().st_size > 100 * 1024 * 1024:
        too_big.append(f)
check("R9", "no tracked file exceeds 100MB", len(too_big) == 0)

print()
fails = 0
for rid, name, ok in results:
    print(f"{'  ok' if ok else 'FAIL'}  [{rid}] {name}")
    fails += 0 if ok else 1
print(f"\n{len(results) - fails} passed, {fails} failed")
sys.exit(1 if fails else 0)
