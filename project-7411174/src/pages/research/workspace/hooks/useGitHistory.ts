import { useState, useCallback, useEffect } from "react";
import { workspaceApi } from "../../../../lib/api";
import type { GitCommit, GitDiff } from "../../../../lib/api";

export function useGitHistory(taskId: string) {
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<GitCommit | null>(null);
  const [diffs, setDiffs] = useState<GitDiff[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshLog = useCallback(async () => {
    setLoading(true);
    try {
      const result = await workspaceApi.getGitLog(taskId);
      setCommits(result);
    } catch (err) {
      console.error("Failed to load git log:", err);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    refreshLog();
  }, [refreshLog]);

  const viewCommitDiff = useCallback(
    async (commit: GitCommit) => {
      setSelectedCommit(commit);
      const idx = commits.findIndex((c) => c.sha === commit.sha);
      const parent = idx < commits.length - 1 ? commits[idx + 1] : null;
      if (!parent) {
        setDiffs([]);
        return;
      }
      try {
        const result = await workspaceApi.getGitDiff(
          taskId,
          parent.sha,
          commit.sha,
        );
        setDiffs(result);
      } catch (err) {
        console.error("Failed to load diff:", err);
        setDiffs([]);
      }
    },
    [taskId, commits],
  );

  const clearSelection = useCallback(() => {
    setSelectedCommit(null);
    setDiffs([]);
  }, []);

  return {
    commits,
    selectedCommit,
    diffs,
    loading,
    refreshLog,
    viewCommitDiff,
    clearSelection,
  };
}
