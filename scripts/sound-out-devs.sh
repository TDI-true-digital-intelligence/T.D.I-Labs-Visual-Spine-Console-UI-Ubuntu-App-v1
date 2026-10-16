#!/usr/bin/env bash
# sound-out-devs.sh — one-shot READ-ONLY listing of ALL OUTPUT (playback) devices.
# PipeWire/Pulse sinks + wpctl audio sinks + ALSA playback hardware. No changes made.
set -u

echo "=== OUTPUT DEVICES @ $(date '+%F %T') (READ-ONLY — no changes made) ==="

echo ""
echo "--- PIPEWIRE SINKS (output devices) ---"
pactl list sinks 2>/dev/null | awk '
  /^Sink #/                    { printf "\n%s\n", $0 }
  /^[[:space:]]+State:/        { printf "  %s\n", $0 }
  /^[[:space:]]+Name:/         { printf "  %s\n", $0 }
  /^[[:space:]]+Description:/  { printf "  %s\n", $0 }
  /^[[:space:]]+Driver:/       { printf "  %s\n", $0 }
  /^[[:space:]]+Active Port:/  { printf "  %s\n", $0 }
  /^[[:space:]]+Mute:/         { printf "  %s\n", $0 }
  /^[[:space:]]+Volume:/       { printf "  %s\n", $0 }
'

echo ""
echo "--- WPCTL AUDIO SINKS ---"
wpctl status 2>/dev/null | awk '/Audio/{a=1} a' | sed -n '/Sinks:/,/Sources:/p' | head -30

echo ""
echo "--- ALSA PLAYBACK HARDWARE (aplay -l) ---"
aplay -l 2>/dev/null || echo "  (aplay -l unavailable)"

echo ""
echo "=== END (read-only; nothing was modified) ==="
