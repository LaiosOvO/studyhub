"""Tests for experiment LLM prompt builders.

Covers build_analysis_prompt, build_code_modification_prompt,
build_fix_prompt, and build_guidance_prompt. All pure functions.
"""

import pytest

from app.services.experiment.prompts import (
    build_analysis_prompt,
    build_code_modification_prompt,
    build_fix_prompt,
    build_guidance_prompt,
    _detect_chinese,
    _format_results_history,
)


# ─── _detect_chinese ────────────────────────────────────────────────────────


def test_detect_chinese_with_chinese_text():
    """Returns True for Chinese characters."""
    assert _detect_chinese("测试假设") is True


def test_detect_chinese_english_only():
    """Returns False for English text."""
    assert _detect_chinese("test hypothesis") is False


def test_detect_chinese_mixed():
    """Returns True for mixed Chinese/English text."""
    assert _detect_chinese("Test 假设") is True


def test_detect_chinese_empty():
    """Returns False for empty string."""
    assert _detect_chinese("") is False


# ─── _format_results_history ────────────────────────────────────────────────


def test_format_results_history_empty():
    """Returns placeholder for empty results."""
    assert _format_results_history([]) == "No previous results."


def test_format_results_history_with_data():
    """Formats recent results as readable lines."""
    results = [
        {"round": 1, "status": "keep", "metric_value": 0.5, "description": "lr change"},
        {"round": 2, "status": "discard", "metric_value": 0.6, "description": "batch size"},
    ]
    formatted = _format_results_history(results)
    assert "Round 1" in formatted
    assert "Round 2" in formatted
    assert "keep" in formatted
    assert "discard" in formatted


def test_format_results_history_truncates():
    """Only shows last max_entries results."""
    results = [{"round": i, "status": "keep", "metric_value": i * 0.1} for i in range(10)]
    formatted = _format_results_history(results, max_entries=3)
    assert "Round 7" in formatted
    assert "Round 8" in formatted
    assert "Round 9" in formatted
    assert "Round 0" not in formatted


# ─── build_analysis_prompt ──────────────────────────────────────────────────


def test_build_analysis_prompt_structure():
    """Returns well-structured messages list with system and user roles."""
    messages = build_analysis_prompt(
        current_code="print('hello')",
        results_history=[],
        plan_context={"hypothesis": "test", "method_description": "method"},
    )
    assert len(messages) == 2
    assert messages[0]["role"] == "system"
    assert messages[1]["role"] == "user"


def test_build_analysis_prompt_includes_code():
    """User message includes the current code."""
    messages = build_analysis_prompt(
        current_code="x = 42",
        results_history=[],
        plan_context={},
    )
    assert "x = 42" in messages[1]["content"]


def test_build_analysis_prompt_chinese_hint():
    """Adds Chinese language hint when hypothesis is Chinese."""
    messages = build_analysis_prompt(
        current_code="pass",
        results_history=[],
        plan_context={"hypothesis": "提高模型准确率"},
    )
    assert "Chinese" in messages[0]["content"]


def test_build_analysis_prompt_includes_context():
    """User message includes plan context fields."""
    messages = build_analysis_prompt(
        current_code="pass",
        results_history=[],
        plan_context={"hypothesis": "h1", "method_description": "m1", "best_metric": 0.5},
    )
    content = messages[1]["content"]
    assert "h1" in content
    assert "m1" in content
    assert "0.5" in content


# ─── build_code_modification_prompt ─────────────────────────────────────────


def test_build_code_modification_prompt_structure():
    """Returns system + user messages."""
    messages = build_code_modification_prompt(
        current_code="pass", proposed_change="increase lr", plan_context={}
    )
    assert len(messages) == 2
    assert messages[0]["role"] == "system"
    assert "code" in messages[0]["content"].lower()


def test_build_code_modification_prompt_includes_proposed_change():
    """User message includes the proposed change."""
    messages = build_code_modification_prompt(
        current_code="x = 1", proposed_change="set x to 2", plan_context={}
    )
    assert "set x to 2" in messages[1]["content"]


# ─── build_fix_prompt ───────────────────────────────────────────────────────


def test_build_fix_prompt_includes_error_log():
    """Fix prompt includes the error output."""
    messages = build_fix_prompt(
        current_code="import foo",
        error_log="ModuleNotFoundError: No module named 'foo'",
        attempt=1,
        max_attempts=3,
    )
    assert "ModuleNotFoundError" in messages[1]["content"]


def test_build_fix_prompt_includes_attempt_number():
    """System message includes attempt count."""
    messages = build_fix_prompt(
        current_code="pass",
        error_log="error",
        attempt=2,
        max_attempts=3,
    )
    assert "2" in messages[0]["content"]
    assert "3" in messages[0]["content"]


def test_build_fix_prompt_truncates_long_error():
    """Error log is truncated to last 100 lines."""
    long_error = "\n".join([f"line {i}" for i in range(200)])
    messages = build_fix_prompt(
        current_code="pass", error_log=long_error, attempt=1
    )
    # Should contain last lines, not first
    assert "line 199" in messages[1]["content"]
    assert "line 0" not in messages[1]["content"]


# ─── build_guidance_prompt ──────────────────────────────────────────────────


def test_build_guidance_prompt_includes_user_guidance():
    """User guidance is included in the prompt."""
    messages = build_guidance_prompt(
        current_code="pass",
        user_guidance="try cosine annealing",
        results_history=[],
    )
    assert "cosine annealing" in messages[1]["content"]


def test_build_guidance_prompt_uses_guidance_system():
    """System message uses the guidance-specific system prompt."""
    messages = build_guidance_prompt(
        current_code="pass",
        user_guidance="test",
        results_history=[],
    )
    assert "guidance" in messages[0]["content"].lower()
