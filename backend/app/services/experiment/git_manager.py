"""Git operations for experiment workspace tracking.

Wraps gitpython for branch creation, commit per iteration,
reset on failure, and experiment history management.

Reference: autoresearch git tracking pattern.
"""

import logging
from datetime import datetime, timezone
from pathlib import Path

from git import GitCommandError, InvalidGitRepositoryError, Repo

logger = logging.getLogger(__name__)


class ExperimentGitError(Exception):
    """Git operation failed in experiment context."""

    def __init__(self, operation: str, detail: str) -> None:
        self.operation = operation
        self.detail = detail
        super().__init__(f"Git {operation} failed: {detail}")


class GitManager:
    """Manage git operations for an experiment workspace.

    All methods are synchronous (gitpython is sync).
    Callers should use asyncio.to_thread when needed.
    """

    def __init__(self, workspace: Path) -> None:
        self._workspace = workspace
        self._repo: Repo | None = None

    @property
    def repo(self) -> Repo:
        """Lazy-initialize repo reference."""
        if self._repo is None:
            try:
                self._repo = Repo(self._workspace)
            except InvalidGitRepositoryError as exc:
                raise ExperimentGitError(
                    "open", f"Not a git repository: {self._workspace}"
                ) from exc
        return self._repo

    def init_repo(self) -> None:
        """Initialize a new git repository in the workspace."""
        try:
            self._repo = Repo.init(self._workspace)
            logger.info("Initialized git repo at %s", self._workspace)
        except GitCommandError as exc:
            raise ExperimentGitError("init", str(exc)) from exc

    def create_branch(self, branch_name: str) -> None:
        """Create and checkout a new branch."""
        try:
            self.repo.git.checkout("-b", branch_name)
            logger.info("Created branch %s", branch_name)
        except GitCommandError as exc:
            raise ExperimentGitError("create_branch", str(exc)) from exc

    def commit(self, message: str) -> str:
        """Stage all changes and commit. Return SHA hex.

        Creates a new commit object (immutable pattern).
        """
        try:
            self.repo.git.add("-A")
            self.repo.index.commit(message)
            sha = self.repo.head.commit.hexsha
            logger.info("Committed %s: %s", sha[:8], message)
            return sha
        except GitCommandError as exc:
            raise ExperimentGitError("commit", str(exc)) from exc

    def get_current_sha(self) -> str:
        """Get the current HEAD commit SHA."""
        try:
            return self.repo.head.commit.hexsha
        except (ValueError, GitCommandError) as exc:
            raise ExperimentGitError("get_current_sha", str(exc)) from exc

    def reset_to_previous(self) -> None:
        """Reset to parent commit (discard failed iteration).

        Uses git reset --hard HEAD~1.
        """
        try:
            self.repo.git.reset("--hard", "HEAD~1")
            logger.info("Reset to previous commit")
        except GitCommandError as exc:
            raise ExperimentGitError("reset_to_previous", str(exc)) from exc

    def is_clean(self) -> bool:
        """Check for uncommitted changes."""
        return not self.repo.is_dirty(untracked_files=True)

    def stash_and_clean(self) -> None:
        """Safety net: stash any uncommitted changes before iteration."""
        if not self.is_clean():
            try:
                self.repo.git.stash("push", "-m", "pre-iteration cleanup")
                logger.info("Stashed uncommitted changes")
            except GitCommandError as exc:
                raise ExperimentGitError("stash_and_clean", str(exc)) from exc

    def get_log(self, max_count: int = 50) -> list[dict]:
        """Return recent commit log as list of dicts.

        Returns new list (immutable pattern).
        """
        try:
            commits = list(self.repo.iter_commits(max_count=max_count))
            return [
                {
                    "sha": c.hexsha,
                    "message": c.message.strip(),
                    "timestamp": datetime.fromtimestamp(
                        c.committed_date, tz=timezone.utc
                    ).isoformat(),
                }
                for c in commits
            ]
        except (ValueError, GitCommandError):
            return []
