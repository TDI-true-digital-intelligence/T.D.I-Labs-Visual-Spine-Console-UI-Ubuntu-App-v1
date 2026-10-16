# SPINE Console Ver.1

SPINE Console is a log viewer for Ubuntu that shows you the tail end of every running script, live. Built on the systemd journal — output is saved forever and searchable forever.

![console](shots/console-live-redacted.png)

I built this for myself after realizing I had no way to see what scripts were actually doing on my machine. If a window closed, the output was gone. Now nothing is lost.

## Install (Ubuntu 22.04 / 24.04)

```bash
./install.sh
```

That installs three commands:

| Command | What it does |
|---|---|
| `spine-run` | run any command, output saved to the journal under a tag |
| `spine-cat` | pipe any stream into the journal |
| `spine-tail` | read it all back live (Rust, fast) |

For the console window:

```bash
cd electron-app
npm install-scripts approve --all
npm install
npm start
```

Or grab the [v1.0.1 release](https://github.com/agi-digital-dot/spine-console-v1/releases/tag/v1.0.1) — zip and snap included.

## Usage

```bash
spine-run backup.sh                  # run something, keep its output
spine-run --tag deploy ./deploy.py   # tag it
./train.sh | spine-cat training      # capture something already running
spine-tail --all                     # watch everything, live
spine-tail --all --priority err      # errors only
```

The console adds a window over all of it: source list, live stream, filters, search.

![errors](shots/console-filter-err-redacted.png)

## Why

Logs in screenshots are redacted — the tool shows everything on your machine, mine included.

It runs as a normal Ubuntu app (shows up in Settings, launches from the dock) and the whole thing is 50 tests green from a fresh clone. CI runs them on every push. See [TUTORIAL.md](TUTORIAL.md) for the full walkthrough with screenshots.

## Layout

- `python-capture/` — spine-run, spine-cat (Python)
- `rust-engine/` — spine-tail (Rust)
- `electron-app/` — the console (TypeScript)

## Tests

```bash
cd electron-app && npm test    # 24 passed
cd ../python-capture && python3 tests/test_regression.py    # 14 passed
```

---

Built by [AGI Digital](https://github.com/agi-digital-dot).
