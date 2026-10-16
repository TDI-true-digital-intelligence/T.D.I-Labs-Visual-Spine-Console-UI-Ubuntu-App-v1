#!/usr/bin/env bash
# sound-ports-list.sh — one-shot READ-ONLY listing of ALL sound ports.
# Prints PipeWire/PulseAudio card ports + sink/source active ports + ALSA hardware.
# NEVER mutates audio state (no card/profile/port changes, no test sounds).
# Run under spine-run, tag: sound-ports
set -u

echo "=== SOUND PORTS @ $(date '+%F %T') (READ-ONLY listing — no changes made) ==="

echo ""
echo "--- CARDS: active profile + all ports ---"
pactl list cards 2>/dev/null | awk '
  /^Card #/                                          { printf "\n%s\n", $0; inp=0 }
  /^[[:space:]]+Name:/                               { if (!inp) printf "  %s\n", $0 }
  /^[[:space:]]+(Current profile|Active Profile):/   { printf "  %s\n", $0 }
  /^[[:space:]]+Ports:/                              { inp=1; printf "  Ports:\n"; next }
  inp && /^[[:space:]][[:space:]][^[:space:]]/       { printf "    %s\n", $0 }
'

echo ""
echo "--- SINKS: active port ---"
pactl list sinks 2>/dev/null | awk '
  /^Sink #/                    { printf "\n%s\n", $0 }
  /^[[:space:]]+Name:/         { printf "  %s\n", $0 }
  /^[[:space:]]+Active Port:/  { printf "  %s\n", $0 }
'

echo ""
echo "--- SOURCES: active port ---"
pactl list sources 2>/dev/null | awk '
  /^Source #/                  { printf "\n%s\n", $0 }
  /^[[:space:]]+Name:/         { printf "  %s\n", $0 }
  /^[[:space:]]+Active Port:/  { printf "  %s\n", $0 }
'

echo ""
echo "--- ALSA HARDWARE (aplay -l) ---"
aplay -l 2>/dev/null || echo "  (aplay -l unavailable)"

echo ""
echo "=== END OF LISTING (read-only; nothing was modified) ==="
