#!/usr/bin/python3
"""spine-cat — pipe any running command's output into the journal.

    ./train.sh | spine-cat training

Every stdin line becomes a journal entry (SYSLOG_IDENTIFIER=spine/<tag>),
streamed straight through to stdout as well so existing pipes still work.
"""

from __future__ import annotations

import argparse
import re
import sys

try:
    import systemd.journal  # type: ignore[import-untyped]

    HAVE_JOURNAL = True
except ImportError:  # pragma: no cover
    HAVE_JOURNAL = False

_TAG_RE = re.compile(r"[^A-Za-z0-9._/-]+")


def clean_tag(tag: str) -> str:
    """Sanitize a user tag into a safe SYSLOG_IDENTIFIER component."""
    cleaned = _TAG_RE.sub("-", tag.strip())[:64]
    cleaned = cleaned.strip("-")  # no leading/trailing dash garbage
    return cleaned or "job"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        prog="spine-cat",
        description="Tag stdin into the systemd journal as spine/<tag>; pass-through to stdout.",
    )
    ap.add_argument("tag", help="journal tag, e.g. training")
    args = ap.parse_args(argv)

    tag = clean_tag(args.tag)
    for line in sys.stdin:
        if HAVE_JOURNAL:
            systemd.journal.send(
                line.rstrip("\n"), SYSLOG_IDENTIFIER=f"spine/{tag}", PRIORITY=6
            )
        sys.stdout.write(line)
    sys.stdout.flush()
    return 0


if __name__ == "__main__":
    sys.exit(main())
