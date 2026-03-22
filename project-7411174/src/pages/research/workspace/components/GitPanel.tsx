import { useState } from "react";
import { DiffEditor } from "@monaco-editor/react";
import type { GitCommit, GitDiff } from "../../../../lib/api";

interface Props {
  commits: GitCommit[];
  selectedCommit: GitCommit | null;
  diffs: GitDiff[];
  loading: boolean;
  onSelectCommit: (commit: GitCommit) => void;
  onClear: () => void;
}

function shortenSha(sha: string): string {
  return sha.slice(0, 7);
}

function relativeDate(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;

  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

function CommitList({
  commits,
  onSelectCommit,
}: {
  commits: GitCommit[];
  onSelectCommit: (commit: GitCommit) => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.08]">
        <i className="ri-git-commit-line text-accent-cyan text-sm" />
        <span className="text-xs font-medium text-text-primary">Git 历史</span>
        <span className="text-[10px] text-text-muted ml-auto">
          {commits.length} 提交
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {commits.map((commit) => (
          <button
            key={commit.sha}
            type="button"
            onClick={() => onSelectCommit(commit)}
            className="flex items-start gap-2.5 w-full px-3 py-2 text-left hover:bg-white/[0.06] transition-colors border-b border-white/[0.04]"
          >
            <span className="mt-1 w-2 h-2 rounded-full bg-accent-cyan shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-text-primary truncate">
                {commit.message}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-mono text-text-muted">
                  {shortenSha(commit.sha)}
                </span>
                <span className="text-[10px] text-text-muted">
                  {relativeDate(commit.date)}
                </span>
                <span className="text-[10px] text-text-muted ml-auto">
                  {commit.files_changed.length} 文件
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function CommitDetail({
  commit,
  diffs,
  loading,
  onBack,
  onSelectFile,
}: {
  commit: GitCommit;
  diffs: GitDiff[];
  loading: boolean;
  onBack: () => void;
  onSelectFile: (path: string) => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.08]">
        <button
          type="button"
          onClick={onBack}
          className="text-text-muted hover:text-text-primary text-sm"
        >
          <i className="ri-arrow-left-s-line" />
        </button>
        <span className="text-xs text-text-primary truncate flex-1">
          {commit.message}
        </span>
        <span className="text-[10px] font-mono text-text-muted shrink-0">
          {shortenSha(commit.sha)}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <i className="ri-loader-4-line animate-spin text-accent-cyan text-lg" />
          </div>
        )}
        {!loading && diffs.length === 0 && (
          <div className="flex items-center justify-center py-8 text-xs text-text-muted">
            无文件变更（初始提交）
          </div>
        )}
        {!loading &&
          diffs.map((diff) => (
            <button
              key={diff.path}
              type="button"
              onClick={() => onSelectFile(diff.path)}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-white/[0.06] transition-colors"
            >
              <i className="ri-edit-line text-text-muted text-xs" />
              <span className="text-xs text-text-secondary truncate">
                {diff.path}
              </span>
            </button>
          ))}
      </div>
    </div>
  );
}

function DiffView({
  diff,
  commitSha,
  onBack,
}: {
  diff: GitDiff;
  commitSha: string;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.08]">
        <button
          type="button"
          onClick={onBack}
          className="text-text-muted hover:text-text-primary text-sm"
        >
          <i className="ri-arrow-left-s-line" />
        </button>
        <span className="text-xs text-text-secondary truncate flex-1">
          {diff.path}
        </span>
        <span className="text-[10px] font-mono text-text-muted shrink-0">
          {shortenSha(commitSha)}
        </span>
      </div>
      <div className="flex-1">
        <DiffEditor
          original={diff.old_content ?? ""}
          modified={diff.new_content ?? ""}
          theme="vs-dark"
          options={{
            readOnly: true,
            renderSideBySide: true,
            minimap: { enabled: false },
            fontSize: 12,
            scrollBeyondLastLine: false,
          }}
        />
      </div>
    </div>
  );
}

export function GitPanel({
  commits,
  selectedCommit,
  diffs,
  loading,
  onSelectCommit,
  onClear,
}: Props) {
  const [activeDiffPath, setActiveDiffPath] = useState<string | null>(null);

  const activeDiff = activeDiffPath
    ? diffs.find((d) => d.path === activeDiffPath) ?? null
    : null;

  // View 3: Diff viewer
  if (selectedCommit && activeDiff) {
    return (
      <DiffView
        diff={activeDiff}
        commitSha={selectedCommit.sha}
        onBack={() => setActiveDiffPath(null)}
      />
    );
  }

  // View 2: Commit detail
  if (selectedCommit) {
    return (
      <CommitDetail
        commit={selectedCommit}
        diffs={diffs}
        loading={loading}
        onBack={() => {
          setActiveDiffPath(null);
          onClear();
        }}
        onSelectFile={setActiveDiffPath}
      />
    );
  }

  // View 1: Commit list (default)
  return <CommitList commits={commits} onSelectCommit={onSelectCommit} />;
}
