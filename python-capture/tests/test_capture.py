"""Tests for spine capture CLIs — run: python3 -m pytest python-capture/tests -q"""

import importlib.util
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PYCAP = HERE.parent


def _load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


spine_run = _load("spine_run", PYCAP / "spine_run.py")
spine_cat = _load("spine_cat", PYCAP / "spine_cat.py")


def test_spine_run_module_loads():
    assert callable(spine_run.main)


def test_spine_run_captures_exit_code():
    rc = spine_run.main(["true", "--tag", "selftest"])
    assert rc == 0
    rc_fail = spine_run.main(["exit 3", "--tag", "selftest"])
    assert rc_fail == 3


def test_spine_run_output_passthrough(capsys):
    spine_run.main(["echo hello-spine", "--tag", "selftest"])
    out = capsys.readouterr().out
    assert "hello-spine" in out


def test_spine_run_exit_line_reported(capsys):
    spine_run.main(["true", "--tag", "selftest"])
    captured = capsys.readouterr()
    assert "[spine] exit 0" in captured.err + captured.out


def test_spine_cat_passthrough_and_module(capsys, monkeypatch):
    monkeypatch.setattr(sys, "stdin", __import__("io").StringIO("line-one\nline-two\n"))
    rc = spine_cat.main(["pipetest"])
    assert rc == 0
    out = capsys.readouterr().out
    assert "line-one" in out and "line-two" in out


def test_journal_import_flag_bool():
    # On systemd boxes the import should succeed; flag must be a bool either way.
    assert isinstance(spine_run.HAVE_JOURNAL, bool)
    assert isinstance(spine_cat.HAVE_JOURNAL, bool)


def test_cli_entry_scripts_exist():
    for p in ("spine_run.py", "spine_cat.py"):
        assert (PYCAP / p).exists()
