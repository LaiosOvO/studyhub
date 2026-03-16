"""Tests for experiment git manager.

Covers GitManager lifecycle: init, branch, commit, reset, stash, log.
Uses real git operations on temp directories (no external services).
"""

import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch

from app.services.experiment.git_manager import (
    ExperimentGitError,
    GitManager,
)


@pytest.fixture
def workspace(tmp_path: Path) -> Path:
    """Return a temporary workspace directory."""
    return tmp_path


@pytest.fixture
def git_mgr(workspace: Path) -> GitManager:
    """Return a GitManager with initialized repo."""
    mgr = GitManager(workspace)
    mgr.init_repo()
    # Create initial file and commit so HEAD exists
    (workspace / "train.py").write_text("print('hello')", encoding="utf-8")
    mgr.commit("initial commit")
    return mgr


# ─── init_repo ──────────────────────────────────────────────────────────────


def test_init_repo_creates_git_dir(workspace: Path):
    """init_repo creates .git directory in workspace."""
    mgr = GitManager(workspace)
    mgr.init_repo()
    assert (workspace / ".git").is_dir()


# ─── create_branch ──────────────────────────────────────────────────────────


def test_create_branch(git_mgr: GitManager):
    """Creates and checks out a new branch."""
    git_mgr.create_branch("experiment/test-001")
    assert git_mgr.repo.active_branch.name == "experiment/test-001"


def test_create_branch_duplicate_raises(git_mgr: GitManager):
    """Creating a duplicate branch raises ExperimentGitError."""
    git_mgr.create_branch("feature-x")
    with pytest.raises(ExperimentGitError):
        git_mgr.create_branch("feature-x")


# ─── commit ─────────────────────────────────────────────────────────────────


def test_commit_returns_sha(git_mgr: GitManager, workspace: Path):
    """Commit returns a valid hex SHA."""
    (workspace / "train.py").write_text("x = 1", encoding="utf-8")
    sha = git_mgr.commit("test commit")
    assert len(sha) == 40
    assert all(c in "0123456789abcdef" for c in sha)


def test_commit_message_preserved(git_mgr: GitManager, workspace: Path):
    """Commit message is stored correctly."""
    (workspace / "train.py").write_text("x = 2", encoding="utf-8")
    git_mgr.commit("experiment 1: increase lr")
    assert "experiment 1" in git_mgr.repo.head.commit.message


# ─── get_current_sha ────────────────────────────────────────────────────────


def test_get_current_sha(git_mgr: GitManager):
    """Returns the current HEAD SHA."""
    sha = git_mgr.get_current_sha()
    assert sha == git_mgr.repo.head.commit.hexsha


# ─── reset_to_previous ─────────────────────────────────────────────────────


def test_reset_to_previous(git_mgr: GitManager, workspace: Path):
    """Reset removes the latest commit."""
    old_sha = git_mgr.get_current_sha()
    (workspace / "train.py").write_text("x = 3", encoding="utf-8")
    git_mgr.commit("bad commit")
    git_mgr.reset_to_previous()
    assert git_mgr.get_current_sha() == old_sha


# ─── is_clean / stash_and_clean ─────────────────────────────────────────────


def test_is_clean_true(git_mgr: GitManager):
    """Clean repo returns True."""
    assert git_mgr.is_clean() is True


def test_is_clean_false_with_changes(git_mgr: GitManager, workspace: Path):
    """Dirty repo returns False."""
    (workspace / "train.py").write_text("modified", encoding="utf-8")
    assert git_mgr.is_clean() is False


def test_stash_and_clean_makes_repo_clean(git_mgr: GitManager, workspace: Path):
    """stash_and_clean stashes uncommitted changes."""
    (workspace / "train.py").write_text("modified", encoding="utf-8")
    git_mgr.stash_and_clean()
    assert git_mgr.is_clean() is True


def test_stash_and_clean_noop_on_clean_repo(git_mgr: GitManager):
    """stash_and_clean does nothing on a clean repo."""
    git_mgr.stash_and_clean()  # Should not raise
    assert git_mgr.is_clean() is True


# ─── get_log ────────────────────────────────────────────────────────────────


def test_get_log_returns_commits(git_mgr: GitManager, workspace: Path):
    """get_log returns list of commit dicts."""
    (workspace / "train.py").write_text("x = 1", encoding="utf-8")
    git_mgr.commit("second commit")
    log = git_mgr.get_log()
    assert len(log) >= 2
    assert "sha" in log[0]
    assert "message" in log[0]
    assert "timestamp" in log[0]


def test_get_log_max_count(git_mgr: GitManager, workspace: Path):
    """get_log respects max_count parameter."""
    for i in range(5):
        (workspace / "train.py").write_text(f"x = {i}", encoding="utf-8")
        git_mgr.commit(f"commit {i}")
    log = git_mgr.get_log(max_count=3)
    assert len(log) == 3


# ─── Error Handling ─────────────────────────────────────────────────────────


def test_repo_property_invalid_path(tmp_path: Path):
    """Accessing repo on non-git path raises ExperimentGitError."""
    # Use a real path that exists but is not a git repo
    non_git_dir = tmp_path / "not_a_repo"
    non_git_dir.mkdir()
    mgr = GitManager(non_git_dir)
    with pytest.raises(ExperimentGitError) as exc_info:
        _ = mgr.repo
    assert exc_info.value.operation == "open"
