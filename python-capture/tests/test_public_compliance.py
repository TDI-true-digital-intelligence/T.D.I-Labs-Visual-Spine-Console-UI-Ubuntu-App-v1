#!/usr/bin/env python3
"""test_public_compliance.py — public-repo legal compliance invariants.

Encodes the Oct 2026 licensing fix as tests so the mistakes cannot return:
  1. LICENSE file exists and is MIT with a copyright line
  2. snapcraft.yaml license is MIT (was: Proprietary)
  3. root + electron-app package.json license is MIT (was: Private)
  4. README links only to this org's releases (was: dead agi-digital-dot link)
  5. README carries the AI-assistance disclosure + local-data privacy note
  6. No obvious secret material in public text files
Run: python3 tests/test_public_compliance.py  (from python-capture/ or repo root)
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent  # python-capture/tests -> repo root

FAILS = []
PASSES = []

def check(name, cond, detail=""):
    (PASSES if cond else FAILS).append(f"{name}{(' — ' + detail) if detail and not cond else ''}")

# --- 1. LICENSE file: exists, MIT, copyright line ---
lic = ROOT / "LICENSE"
check("LICENSE exists", lic.is_file())
if lic.is_file():
    t = lic.read_text()
    check("LICENSE is MIT", "MIT License" in t and "Permission is hereby granted, free of charge" in t)
    check("LICENSE has copyright line", bool(re.search(r"Copyright \(c\)\s*\d{4}", t)))

# --- 2. snapcraft.yaml license ---
snap = ROOT / "snapcraft.yaml"
if snap.is_file():
    m = re.search(r"^\s*license:\s*(\S+)", snap.read_text(), re.M)
    check("snapcraft license is MIT", bool(m and m.group(1) == "MIT"), f"got {m.group(1) if m else 'none'}")

# --- 3. package.json licenses (root + electron-app) ---
for rel in ("package.json", "electron-app/package.json"):
    p = ROOT / rel
    if p.is_file():
        try:
            v = json.loads(p.read_text()).get("license", "")
            check(f"{rel} license is MIT", v == "MIT", f"got {v!r}")
        except json.JSONDecodeError as e:
            check(f"{rel} parses as JSON", False, str(e))

# --- 4. README release links point at this repo's org ---
rd = (ROOT / "README.md").read_text() if (ROOT / "README.md").is_file() else ""
check("README has no dead foreign-org release link", "agi-digital-dot" not in rd)
for link in re.findall(r"https://github\.com/([\w.-]+)/([\w.-]+)/releases", rd):
    check(f"release link org sane ({link[0]})", link[0] not in ("agi-digital-dot",), "legacy dead org")

# --- 5. README disclosure + privacy ---
check("README cites the MIT License", "MIT License" in rd and "LICENSE" in rd)
check("README has AI-assistance disclosure", bool(re.search(r"AI-assist|agentic|AI", rd)) and "reviewed" in rd.lower())
check("README has local-data privacy note", "no telemetry" in rd.lower() and "leaves your machine" in rd.lower())

# --- 6. no secret-looking material in public text ---
SECRET = re.compile(r"(api[_-]?key|secret|password|passwd|token)\s*[:=]\s*[\"\'][A-Za-z0-9_\-/+=]{16,}", re.I)
for rel in ("README.md", "INSTALL.md", "TUTORIAL.md", "snapcraft.yaml", "package.json", "electron-app/package.json"):
    p = ROOT / rel
    if p.is_file():
        check(f"no secrets in {rel}", not SECRET.search(p.read_text()))

# --- fonts: royalty-free only, nothing bundled/embedded (Oct 2026 audit) ---
font_files = [p for p in ROOT.rglob("*") if p.suffix.lower() in (".ttf", ".otf", ".woff", ".woff2") and ".git" not in str(p)]
check("no font binaries bundled (system fonts only)", not font_files, str(font_files[:3]))
css = (ROOT / "electron-app/src/ui/spine.css")
css_text = css.read_text() if css.is_file() else ""
check("no @font-face / webfont imports", "@font-face" not in css_text and "fonts.googleapis" not in css_text)
BANNED_FONTS = ("Helvetica", "Arial", "Times New Roman", "Comic Sans")
for bad in BANNED_FONTS:
    check(f"no non-free font referenced ({bad})", bad not in css_text)

print(f"PASS {len(PASSES)} / FAIL {len(FAILS)}")
for f in FAILS:
    print("  FAIL:", f)
sys.exit(1 if FAILS else 0)
