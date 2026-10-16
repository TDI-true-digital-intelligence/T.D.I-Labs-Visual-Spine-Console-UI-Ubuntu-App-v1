#!/usr/bin/env bash
# Live USB/disk error stream — every kernel line as it fires. No snapshot, no silence.
journalctl -kf -o cat 2>/dev/null | grep --line-buffered -iE "usb|sd[a-z](:|\])|scsi|storage|xhci"
