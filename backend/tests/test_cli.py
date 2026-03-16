"""Tests for experiment CLI entry point.

Covers _emit helper and argument parsing. The main async flow
is tested via integration of other modules.
"""

import json
import pytest
from io import StringIO
from unittest.mock import patch

from app.services.experiment.cli import _emit, main, _read_stdin_signals
from app.services.experiment.loop_agent import ControlSignal


# ─── _emit ──────────────────────────────────────────────────────────────────


def test_emit_outputs_json_line(capsys):
    """_emit prints a JSON line with type and data to stdout."""
    _emit("status", "running")
    captured = capsys.readouterr()
    parsed = json.loads(captured.out.strip())
    assert parsed["type"] == "status"
    assert parsed["data"] == "running"


def test_emit_dict_data(capsys):
    """_emit handles dict data."""
    _emit("iteration", {"round": 1, "metric_value": 0.45})
    captured = capsys.readouterr()
    parsed = json.loads(captured.out.strip())
    assert parsed["data"]["round"] == 1
    assert parsed["data"]["metric_value"] == 0.45


def test_emit_unicode(capsys):
    """_emit handles Chinese characters correctly (ensure_ascii=False)."""
    _emit("status", "实验运行中")
    captured = capsys.readouterr()
    parsed = json.loads(captured.out.strip())
    assert parsed["data"] == "实验运行中"


# ─── _read_stdin_signals ────────────────────────────────────────────────────


def test_read_stdin_signals_parse_pause():
    """Parses 'pause' line as PAUSE signal."""
    import asyncio

    loop = asyncio.new_event_loop()
    queue = asyncio.Queue()

    with patch("sys.stdin", StringIO("pause\n")):
        _read_stdin_signals(queue, loop)

    # call_soon_threadsafe schedules callbacks; run the loop briefly to execute them
    loop.run_until_complete(asyncio.sleep(0))
    assert not queue.empty()
    signal = queue.get_nowait()
    assert signal == ControlSignal.PAUSE
    loop.close()


def test_read_stdin_signals_parse_guide():
    """Parses 'guide:text' as GUIDE signal with data."""
    import asyncio

    loop = asyncio.new_event_loop()
    queue = asyncio.Queue()

    with patch("sys.stdin", StringIO("guide:try cosine annealing\n")):
        _read_stdin_signals(queue, loop)

    loop.run_until_complete(asyncio.sleep(0))
    signal = queue.get_nowait()
    assert isinstance(signal, tuple)
    assert signal[0] == ControlSignal.GUIDE
    assert signal[1] == "try cosine annealing"
    loop.close()


def test_read_stdin_signals_ignore_empty_lines():
    """Ignores empty lines."""
    import asyncio

    loop = asyncio.new_event_loop()
    queue = asyncio.Queue()

    with patch("sys.stdin", StringIO("\n\n\n")):
        _read_stdin_signals(queue, loop)

    loop.run_until_complete(asyncio.sleep(0))
    assert queue.empty()
    loop.close()


# ─── main argument parsing ──────────────────────────────────────────────────


def test_main_missing_required_args():
    """main exits with error when required args missing."""
    with pytest.raises(SystemExit):
        with patch("sys.argv", ["cli"]):
            main()
