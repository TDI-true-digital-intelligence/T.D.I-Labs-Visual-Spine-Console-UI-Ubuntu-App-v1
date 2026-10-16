#!/usr/bin/python3
"""spine-run — run any script with its output captured by the systemd journal.

Replaces:  ./script.sh & ; nohup ... & ; "where did my output go?"

Every stdout/stderr line is written to the journal (identifier=spine/<tag>),
so `journalctl --user -f -t spine/<tag>` (or the SPINE console) shows it live.

Exit code mirrors the wrapped command. Nothing is ever lost.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
import time

try:
    import systemd.journal  # type: ignore[import-untyped]

    HAVE_JOURNAL = True
except ImportError:  # pragma: no cover - CI without systemd-python
    HAVE_JOURNAL = False

# Journal identifiers must be safe as journalctl -t match values:
# alphanumerics, dash, underscore, dot, slash (spine/<tag> pattern) only.
_TAG_RE = re.compile(r"[^A-Za-z0-9._/-]+")


def clean_tag(tag: str) -> str:
    """Sanitize a user tag into a safe SYSLOG_IDENTIFIER component."""
    cleaned = _TAG_RE.sub("-", tag.strip())[:64]
    cleaned = cleaned.strip("-")  # no leading/trailing dash garbage
    return cleaned or "job"


def log(tag: str, stream, text: str) -> None:
    """One line to journal (preferred) + inherited streams (never swallow)."""
    if HAVE_JOURNAL:
        systemd.journal.send(
            text.rstrip("\n"),
            SYSLOG_IDENTIFIER=f"spine/{tag}",
            PRIORITY=7 if stream == "out" else 3,
        )
    out = sys.stdout if stream == "out" else sys.stderr
    out.write(text)
    out.flush()


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        prog="spine-run",
        description="Run a command; capture all output into the systemd journal under spine/<tag>.",
    )
    ap.add_argument("command", help="command to run (shell string)")
    ap.add_argument("--tag", default="job", help="journal tag (default: job)")
    ap.add_argument(
        "--cwd", default=None, help="working directory (default: inherit)"
    )
    args = ap.parse_args(argv)

    tag = clean_tag(args.tag)
    started = time.time()
    log(tag, "err", f"[spine] start: {args.command}\n")

    proc = subprocess.Popen(
        ["/bin/bash", "-c", args.command],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        cwd=args.cwd,
        text=True,
        bufsize=1,
    )

    assert proc.stdout is not None
    for line in proc.stdout:
        log(tag, "out", line)

    rc = proc.wait()
    dur = time.time() - started
    log(tag, "err", f"[spine] exit {rc} after {dur:.1f}s\n")
    return rc


if __name__ == "__main__":
    sys.exit(main())
