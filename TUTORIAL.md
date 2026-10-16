# SPINE Console — see everything your scripts do (15-minute guide)

**The problem SPINE solves:** you run a script, it prints stuff, the window closes, and the
output is *gone*. Where did it go? Nobody knows. SPINE makes output **impossible to lose** —
every line any script prints is saved forever in your machine's own system journal, and the
SPINE Console shows it all streaming live, with search.

**You need:**

| Thing | Why |
|---|---|
| Ubuntu 22.04 or 24.04 | everything here is built for it |
| Terminal (`Ctrl+Alt+T`) | where the commands go |
| About 2 minutes | seriously |

---

## Step 1 — Install it (2 min)

```bash
cd ~/spine-console
./install.sh
```

That puts three tools in `~/.local/bin`:

| Tool | What it does |
|---|---|
| `spine-tail` | the engine — reads the journal, streams it |
| `spine-run` | run any command through SPINE |
| `spine-cat` | pipe anything into the journal |

Check it worked:

```bash
spine-run --tag hello 'echo "hello spine"'
```

You should see your message echo back. It's now also saved forever.

![step 1](tutorial/01-first-run.png)

---

## Step 2 — Prove nothing is ever lost (30 sec)

Close that terminal. Open a NEW one. Now ask the journal what happened:

```bash
journalctl --user -t spine/hello --no-pager | tail -3
```

There it is — the "hello spine" you ran a minute ago, in a terminal that no longer exists.
**That's the whole trick.** The output outlived the window.

![step 2](tutorial/02-proof-persisted.png)

---

## Step 3 — The console itself (30 sec)

The console is a window that shows every script's output, live, in one place:

```bash
spine-console &
```

Type something into the search box — it filters every line, across every script, forever.

![step 3](tutorial/03-console-live.png)

---

## Step 4 — Run something real through it (1 min)

Any command works. Long one? Spammy one? Doesn't matter — SPINE catches it all:

```bash
spine-run --tag demo 'for i in $(seq 1 5); do echo "tick $i"; sleep 1; done'
```

Switch to the console window: five ticks stream in, one per second, tagged `demo`.
Close the terminal mid-run — the output keeps flowing into the journal anyway.

![step 4](tutorial/04-live-stream.png)

---

## Step 5 — Find anything, ever (30 sec)

Tomorrow. Next week. The journal remembers:

```bash
journalctl --user -t spine/demo --since today --no-pager
```

Every tick. Timestamped. This is what "spine" means — the record that was always there.

![step 5](tutorial/05-search-history.png)

---

## What's inside (for the curious)

- `python-capture/` — `spine-run` + `spine-cat` (the catchers)
- `rust-engine/` — `spine-tail` (the fast reader)
- `electron-app/` — the console window
- `snapcraft.yaml` — builds the snap package

## Troubleshooting

| Problem | Fix |
|---|---|
| `spine-run: command not found` | `source ~/.profile` (or open a new terminal) |
| Console window blank | `systemctl --user status systemd-journald` — the journal must be running (it always is on Ubuntu) |
| Old messages missing | journal retention (~2 weeks by default) — `sudo journalctl --vacuum-time=30d` to extend |
