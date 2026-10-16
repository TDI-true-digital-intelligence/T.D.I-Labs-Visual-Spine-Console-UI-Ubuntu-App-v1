#!/bin/bash
# Hand-assemble the SPINE snap: prime dir + meta/snap.yaml → snap pack
# (snapcraft refuses while Ubuntu Pro is attached; this path needs no Pro)
set -eo pipefail
cd $(dirname $(readlink -f $0))/..
PRIME=build/prime
rm -rf build && mkdir -p "$PRIME"/{bin,meta,usr/bin,usr/share/spine}

# 1) CLIs
install -m 0755 python-capture/spine_run.py "$PRIME/usr/bin/spine-run"
install -m 0755 python-capture/spine_cat.py  "$PRIME/usr/bin/spine-cat"

# 2) Rust engine
install -m 0755 rust-engine/target/release/spine-tail "$PRIME/usr/bin/spine-tail"

# 3) Console (prebuilt electron dir) under share; wrapper in bin
cp -r electron-app/dist/linux-unpacked/* "$PRIME/usr/share/spine/"
# chromium setuid sandbox helper — snapd honors setuid on this filename
chmod 4755 "$PRIME/usr/share/spine/chrome-sandbox" 2>/dev/null || true
# pkey shim: snapd seccomp denies pkey_alloc; shim returns ENOSYS so
# PartitionAlloc falls back to its no-PKU path instead of CHECK-failing.
install -m 0755 shim/libpkeyshim.so "$PRIME/usr/share/spine/libpkeyshim.so"
cat > "$PRIME/usr/share/spine/run-console.sh" <<'EOF'
#!/bin/bash
export ELECTRON_NO_SANDBOX=1
export LD_LIBRARY_PATH="$SNAP/usr/share/spine:$SNAP/usr/lib/x86_64-linux-gnu:${LD_LIBRARY_PATH:-}"
export LD_PRELOAD="$SNAP/usr/share/spine/libpkeyshim.so:${LD_PRELOAD:-}"
exec "$SNAP/usr/share/spine/spine-console.bin" --no-sandbox --use-gl=swiftshader "$@"
EOF
chmod 0755 "$PRIME/usr/share/spine/run-console.sh"
printf '#!/bin/sh\nexec "$SNAP/usr/share/spine/run-console.sh" "$@"\n' > "$PRIME/bin/spine-console"
chmod 0755 "$PRIME/bin/spine-console"

# SNAP-env wrappers (absolute symlinks break inside confinement)
mk_wrap() {
  printf '#!/bin/sh\nexec "$SNAP/usr/bin/%s" "$@"\n' "$1" > "$PRIME/bin/$1"
  chmod 0755 "$PRIME/bin/$1"
}
mk_wrap spine-run
mk_wrap spine-cat
mk_wrap spine-tail

# 4) python3-systemd C extension + module (journal write from confined python)
mkdir -p "$PRIME/usr/lib/python3/dist-packages"
cp -r /usr/lib/python3/dist-packages/systemd "$PRIME/usr/lib/python3/dist-packages/"
cat > "$PRIME/usr/bin/spine-run" <<'RUNEOF'
#!/bin/sh
export PYTHONPATH="$SNAP/usr/lib/python3/dist-packages:${PYTHONPATH:-}"
exec /usr/bin/python3 "$SNAP/usr/share/spine/spine_run.py" "$@"
RUNEOF
chmod 0755 "$PRIME/usr/bin/spine-run"
cat > "$PRIME/usr/bin/spine-cat" <<'CATEOF'
#!/bin/sh
export PYTHONPATH="$SNAP/usr/lib/python3/dist-packages:${PYTHONPATH:-}"
exec /usr/bin/python3 "$SNAP/usr/share/spine/spine_cat.py" "$@"
CATEOF
chmod 0755 "$PRIME/usr/bin/spine-cat"
install -m 0644 python-capture/spine_run.py "$PRIME/usr/share/spine/spine_run.py"
install -m 0644 python-capture/spine_cat.py "$PRIME/usr/share/spine/spine_cat.py"
# core24 base includes python3; use python from base via absolute path in shebangs (already /usr/bin/python3)

# 4b) Electron lib closure: walk DT_NEEDED chains from the binary itself,
# resolving against core24's lib dir ONLY; stage anything core24 lacks from host.
mkdir -p "$PRIME/usr/lib/x86_64-linux-gnu"
CORE24=/snap/core24/current/usr/lib/x86_64-linux-gnu
resolve() { ldconfig -p | awk -v l="$1" '$1==l {print $NF; exit}'; }
# seed with direct NEEDED entries
NEEDED=$(readelf -d "$PRIME/usr/share/spine/spine-console.bin" | grep NEEDED | awk '{print $NF}' | tr -d '[]')
QUEUE="$NEEDED"
SEEN=""
ROUNDS=0
while [ -n "$QUEUE" ] && [ $ROUNDS -lt 30 ]; do
  ROUNDS=$((ROUNDS+1))
  NEXT=""
  for lib in $QUEUE; do
    case " $SEEN " in *" $lib "*) continue;; esac
    SEEN="$SEEN $lib"
    if [ -e "$CORE24/$lib" ]; then continue; fi        # base provides it
    if [ -e "$PRIME/usr/share/spine/$lib" ]; then continue; fi  # electron bundles it
    p=$(resolve "$lib")
    if [ -n "$p" ]; then
      cp -L "$p" "$PRIME/usr/lib/x86_64-linux-gnu/" 2>/dev/null
      # pull this lib's own deps into the queue
      DEPS=$(readelf -d "$p" 2>/dev/null | grep NEEDED | awk '{print $NF}' | tr -d '[]')
      NEXT="$NEXT $DEPS"
    else
      echo "  (no provider: $lib)"
    fi
  done
  QUEUE="$NEXT"
done
echo "lib closure rounds=$ROUNDS staged=$(ls "$PRIME/usr/lib/x86_64-linux-gnu" | wc -l)"

# 5) meta
mkdir -p "$PRIME/meta"
cat > "$PRIME/meta/snap.yaml" <<EOF
name: spine
title: SPINE
version: 1.0.1
summary: One console for every script that ever runs
description: |
  SPINE turns the systemd journal into the spine of your machine. Run any
  script through spine-run (or pipe through spine-cat) and its output is
  captured forever, streamed live into one console. Rust engine, Python
  capture layer, TypeScript/Electron UI.
architectures: [amd64]
base: core24
grade: stable
confinement: classic
plugs:
  browser-sandbox:
    interface: browser-support
    allow-sandbox: true
apps:
  run:
    command: bin/spine-run
    plugs: [home, network]
  cat:
    command: bin/spine-cat
    plugs: [home, network]
  tail:
    command: bin/spine-tail
    plugs: [home, network, network-bind, log-observe]
  console:
    command: bin/spine-console
    plugs: [home, network, desktop, desktop-legacy, x11, wayland, unity7, audio-playback, browser-sandbox]
    environment:
      ELECTRON_NO_SANDBOX: "1"
      ELECTRON_OZONE_PLATFORM_HINT: x11
      TMPDIR: \$SNAP_USER_COMMON
EOF

# 6) gui launch file for desktop
mkdir -p "$PRIME/meta/gui"
cp assets/spine-icon.svg "$PRIME/meta/gui/icon.svg"
cat > "$PRIME/meta/gui/spine-console.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=SPINE Console
Comment=One console for every script that ever runs
Exec=spine.console
Icon=${SNAP}/meta/gui/icon.svg
Terminal=false
Categories=System;Utility;
EOF

echo "prime assembled:"; du -sh "$PRIME"
snap pack "$PRIME" build/
ls -lh build/*.snap
