#!/usr/bin/env bash
# USB drive enumeration monitor — snapshot-diff pattern
# Emits only when removable disk state or kernel USB events change.
# Known internal: sda sdb nvme0n1. Everything else = interesting.
LAST=""
while true; do
  SNAP=$(lsblk -d -n -o NAME,SIZE,MODEL,TRAN 2>/dev/null | grep -vE "loop|nvme" | grep -E "usb|$" | sort)
  SNAP="$SNAP
$(journalctl -k --since "-10s" --no-pager 2>/dev/null | grep -iE "usb-storage|Attached SCSI|sd[a-z]\]|new .*-speed USB" | sed 's/^.*kernel: //' | sort -u)"
  HASH=$(echo "$SNAP" | md5sum | cut -d' ' -f1)
  if [ "$HASH" != "$LAST" ]; then
    echo "=== $(date '+%H:%M:%S') disk state ==="
    lsblk -d -n -o NAME,SIZE,MODEL | grep -vE "loop|nvme"
    echo "--- recent usb events ---"
    echo "$SNAP" | grep -vE "^===|^[a-z][a-z]?[a-z] " | head -8
    LAST="$HASH"
  fi
  sleep 2
done
