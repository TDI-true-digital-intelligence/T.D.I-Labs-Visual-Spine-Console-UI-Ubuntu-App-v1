# INSTALL — SPINE on Ubuntu 24.04

Three ways, pick one.

## A. Source install (recommended, 2 min)

```bash
cd spine
./install.sh          # engine + CLIs → ~/.local/bin
```

What it installs:

| Binary | What it is |
|---|---|
| `~/.local/bin/spine-tail` | Rust engine — journal → JSON lines |
| `~/.local/bin/spine-run` | Run any command, output journaled |
| `~/.local/bin/spine-cat` | Pipe any stream into the journal |

Requirements: `python3` (system), `cargo` only if rebuilding the engine
(prebuilt binary ships in the repo under `rust-engine/target/release/`).

### Console (Electron)

```bash
cd electron-app
npm install
npm run build
npm start                # or: npx electron .
```

First run will download the Electron runtime (~100 MB).

Prebuilt console also available: `electron-app/dist/linux-unpacked/spine-console`
(export `ELECTRON_NO_SANDBOX=1` if Chromium's SUID sandbox complains —
the shipped launcher script does this for you).

## B. Snap

```bash
snap install spine          # once published
spine.console              # the console
spine.run "script.sh" --tag job
spine.tail --all
```

Build the snap yourself (no snapcraft needed — hand-rolled packer):

```bash
bash scripts/make-snap.sh                 # → build/spine_1.0.1_amd64.snap
sudo snap install build/spine_*.snap --dangerous --classic
```

**Why classic:** snapd's strict seccomp filter denies `pkey_alloc`
(syscall 330), which modern Electron's PartitionAlloc hard-CHECKs —
the console dies with a bare int3 trap (tracked in snapd as a missing
feature). Classic confinement sidesteps it; the CLI tools (`spine.run`,
`spine.cat`, `spine.tail`) work fine under strict too. A `libpkeyshim.so`
LD_PRELOAD stub is shipped for strict-mode experiments.

Confinement notes: strict mode; `journal-observe` plug grants journal read.
Connect if needed: `snap connect spine:journal-observe`.

## C. Just the CLIs (no console)

```bash
install -m 755 python-capture/spine_run.py ~/.local/bin/spine-run
install -m 755 python-capture/spine_cat.py ~/.local/bin/spine-cat
journalctl -f              # your "console" is the journal itself
```

## Verify your install

```bash
spine-run "echo hello-spine" --tag verify
journalctl -t spine/verify -n 2 --no-pager    # ← must show the lines
```

## Uninstall

```bash
rm -f ~/.local/bin/{spine-run,spine-cat,spine-tail}
snap remove spine        # if snapped
# journal history stays (it's the journal's data, not SPINE's)
```
