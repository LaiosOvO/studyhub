import { useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Panel,
  Group as PanelGroup,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";

import { FileTree } from "./components/FileTree";
import { EditorTabs } from "./components/EditorTabs";
import { MonacoWrapper } from "./components/MonacoWrapper";
import { MarkdownPreview } from "./components/MarkdownPreview";
import { GitPanel } from "./components/GitPanel";
import { useWorkspaceFiles } from "./hooks/useWorkspaceFiles";
import { useGitHistory } from "./hooks/useGitHistory";

function HorizontalHandle() {
  return (
    <PanelResizeHandle className="w-1 bg-transparent hover:bg-accent-cyan/30 transition-colors" />
  );
}

function VerticalHandle() {
  return (
    <PanelResizeHandle className="h-1 bg-transparent hover:bg-accent-cyan/30 transition-colors" />
  );
}

export default function WorkspacePage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [gitPanelOpen, setGitPanelOpen] = useState(false);

  const {
    tree,
    tabs,
    activeTab,
    openFile,
    closeTab,
    updateContent,
    saveFile,
    setActiveTab,
    createFile,
    deleteFile,
  } = useWorkspaceFiles(taskId ?? "");

  const {
    commits,
    selectedCommit,
    diffs,
    loading: gitLoading,
    refreshLog,
    viewCommitDiff,
    clearSelection,
  } = useGitHistory(taskId ?? "");

  const activeTabData = tabs.find((t) => t.path === activeTab) ?? null;
  const isMarkdown = activeTabData?.language === "markdown";

  const handleSave = useCallback(
    async (path: string) => {
      await saveFile(path);
      await refreshLog();
    },
    [saveFile, refreshLog],
  );

  const handleDelete = useCallback(
    (path: string) => {
      const confirmed = window.confirm(`确认删除 ${path}？`);
      if (!confirmed) return;
      deleteFile(path).then(() => refreshLog());
    },
    [deleteFile, refreshLog],
  );

  return (
    <div className="flex flex-col h-screen bg-bg-primary text-text-primary">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.08] shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-text-muted hover:text-text-primary text-sm"
          >
            <i className="ri-arrow-left-line" />
          </button>
          <span className="text-sm font-medium text-text-primary">
            研究工作区
          </span>
          {taskId && (
            <span className="text-[10px] font-mono text-text-muted bg-white/[0.06] px-1.5 py-0.5 rounded">
              {taskId.slice(0, 8)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setGitPanelOpen((prev) => !prev)}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
              gitPanelOpen
                ? "text-accent-cyan bg-accent-cyan/10"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            <i className="ri-git-branch-line" />
            <span>Git</span>
          </button>
          <Link
            to={`/research/${taskId}`}
            className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted hover:text-text-primary rounded transition-colors"
          >
            <i className="ri-mind-map" />
            <span>论文地图</span>
          </Link>
          <Link
            to={`/research/${taskId}/report`}
            className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted hover:text-text-primary rounded transition-colors"
          >
            <i className="ri-file-text-line" />
            <span>报告</span>
          </Link>
        </div>
      </div>

      {/* Main content */}
      <PanelGroup orientation="vertical" className="flex-1">
        {/* Editor area */}
        <Panel defaultSize={70} minSize={30}>
          <PanelGroup orientation="horizontal" className="h-full">
            {/* File tree */}
            <Panel defaultSize={18} minSize={12} maxSize={30}>
              <div className="h-full border-r border-white/[0.06] overflow-hidden">
                <FileTree
                  tree={tree}
                  activeFile={activeTab}
                  onSelect={openFile}
                  onNewFile={createFile}
                  onDelete={handleDelete}
                />
              </div>
            </Panel>

            <HorizontalHandle />

            {/* Editor */}
            <Panel defaultSize={isMarkdown ? 50 : 82} minSize={30}>
              <div className="flex flex-col h-full">
                <EditorTabs
                  tabs={tabs}
                  activeTab={activeTab}
                  onSelect={setActiveTab}
                  onClose={closeTab}
                />
                {activeTabData ? (
                  <div className="flex-1">
                    <MonacoWrapper
                      content={activeTabData.content}
                      language={activeTabData.language}
                      onChange={(value) => updateContent(activeTabData.path, value)}
                      onSave={() => handleSave(activeTabData.path)}
                    />
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 text-text-muted">
                    <i className="ri-code-s-slash-line text-3xl" />
                    <p className="text-sm">选择左侧文件开始编辑</p>
                    <p className="text-[10px]">Ctrl+S 保存并提交</p>
                  </div>
                )}
              </div>
            </Panel>

            {/* Markdown preview */}
            {isMarkdown && activeTabData && (
              <>
                <HorizontalHandle />
                <Panel defaultSize={32} minSize={20}>
                  <div className="h-full border-l border-white/[0.06] overflow-hidden">
                    <MarkdownPreview content={activeTabData.content} />
                  </div>
                </Panel>
              </>
            )}
          </PanelGroup>
        </Panel>

        {/* Git panel */}
        {gitPanelOpen && (
          <>
            <VerticalHandle />
            <Panel defaultSize={30} minSize={15} maxSize={50}>
              <div className="h-full border-t border-white/[0.06] overflow-hidden">
                <GitPanel
                  commits={commits}
                  selectedCommit={selectedCommit}
                  diffs={diffs}
                  loading={gitLoading}
                  onSelectCommit={viewCommitDiff}
                  onClear={clearSelection}
                />
              </div>
            </Panel>
          </>
        )}
      </PanelGroup>
    </div>
  );
}
