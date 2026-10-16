<div align="center">

<img src="https://raw.githubusercontent.com/agi-digital-dot/agi-digital-dot/main/logo.png" width="110" alt="AGI Digital" />

# SPINE Console Ver.1

**One console for every script that ever runs.**

Output that can never be lost.

[Install](#install-ubuntu-2404) · [15-minute tutorial](TUTORIAL.md) · [Run the tests](#run-the-tests-yourself)

</div>

---

You run a script. The window closes. Where did the output go?

With SPINE: into the **system journal** — saved forever, searchable forever, streaming live
in one console window. Shell scripts, build jobs, long-running bots, cron tasks — anything.

<div align="center">

![SPINE Console — live](shots/console-live-redacted.png)

*Live console (logs redacted) — every script that runs, streaming, searchable, forever.*

</div>

## Filter by what matters

Errors only. Warnings only. Info only. Everything. One dropdown.

| Errors only — 63 found | Warnings only — 138 found |
|:---:|:---:|
| ![ERR filter](shots/console-filter-err-redacted.png) | ![WARN filter](shots/console-filter-warn-redacted.png) |

| Info stream — live | All levels — live |
|:---:|:---:|
| ![INFO](shots/console-filter-info-redacted.png) | ![ALL](shots/console-filter-all-redacted.png) |

Pause the stream, read it, resume — without losing your place. Search everything with grep.

## Yes, it's a real installed Ubuntu app

Not a demo. Not a mockup. It installs, it registers with the system, it lives in your dock.

<div align="center">

| In Ubuntu Settings | In the dock |
|:---:|:---:|
| ![installed in Ubuntu](shots/app-in-ubuntu-settings.png) | ![dock](shots/app-dock-button.png) |

</div>

## The three tools

| Tool | What it does |
|---|---|
| `spine-run` | Run any command — every line of output journaled under a tag |
| `spine-cat` | Pipe any already-running stream into the journal |
| `spine-tail` | Fast Rust engine — reads it all back, live, as JSON lines |
| **SPINE Console** | The window: sources sidebar, live stream, filters, grep, pause |

## Install (Ubuntu 24.04)

**From source (~2 min):**

```bash
./install.sh
```

**Launch the console:**

```bash
cd electron-app
npm install-scripts approve --all   # one-time: new npm security default
npm install
npm start
```

**From the snap (when published):**

```bash
snap install spine
spine.console
```

New here? **[TUTORIAL.md](TUTORIAL.md) — the 15-minute picture guide.** Every step proven
from a fresh clone.

## Run the tests yourself

```bash
cd electron-app && npm test          # 24 passed
cd ../python-capture
python3 tests/test_regression.py     # 14 passed
python3 tests/test_regression_v2.py  # 5 passed
python3 -m pytest tests/test_capture.py -q   # 7 passed
```

50 checks, all green from a fresh clone. CI runs them on every push.

## What's inside

| Part | Language | Role |
|---|---|---|
| `python-capture` | Python | `spine-run` · `spine-cat` — the catchers |
| `rust-engine` | Rust | `spine-tail` — the fast reader |
| `electron-app` | TypeScript | The console window |

## The console

- **Sources sidebar** — every unit + tag discovered in your journal
- **Live stream** — entries as they arrive, newest on top
- **Filters** — source, priority, text search (grep semantics)
- **Error highlighting** — err red, warning yellow
- **Pause / resume** — without losing your place

---

<div align="center">

Built by [AGI Digital](https://github.com/agi-digital-dot) —
with a human who set the direction and a True Digital Intelligence partner that engineered
until it worked.

[TDI token](https://github.com/agi-digital-dot/tdi-true-digital) ·
[Trezor Mint Kit](https://github.com/agi-digital-dot/trezor-mint-kit)

</div>
