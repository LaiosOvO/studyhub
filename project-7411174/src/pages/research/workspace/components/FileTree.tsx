import { useState, type FormEvent } from "react";
import type { TreeNode } from "../types";

interface FileTreeProps {
  tree: TreeNode[];
  activeFile: string | null;
  onSelect: (path: string) => void;
  onNewFile: (path: string, content: string) => void;
  onDelete: (path: string) => void;
}

function fileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const iconMap: Record<string, string> = {
    md: "ri-markdown-line",
    json: "ri-braces-line",
    csv: "ri-table-line",
    py: "ri-code-s-slash-line",
    ts: "ri-code-s-slash-line",
    tsx: "ri-code-s-slash-line",
    js: "ri-code-s-slash-line",
    jsx: "ri-code-s-slash-line",
    txt: "ri-file-text-line",
  };
  return iconMap[ext] ?? "ri-file-line";
}

function TreeItem({
  node,
  activeFile,
  onSelect,
  onDelete,
}: {
  node: TreeNode;
  activeFile: string | null;
  onSelect: (path: string) => void;
  onDelete: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  if (node.type === "dir") {
    return (
      <div>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex w-full items-center gap-1 px-2 py-0.5 text-xs text-text-secondary hover:bg-white/[0.06] rounded"
        >
          <i
            className={
              expanded ? "ri-arrow-down-s-line" : "ri-arrow-right-s-line"
            }
          />
          <i className="ri-folder-line text-accent-cyan" />
          <span className="truncate">{node.name}</span>
        </button>
        {expanded && node.children && (
          <div className="pl-3">
            {node.children.map((child) => (
              <TreeItem
                key={child.path}
                node={child}
                activeFile={activeFile}
                onSelect={onSelect}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isActive = activeFile === node.path;

  return (
    <div className="group flex items-center">
      <button
        type="button"
        onClick={() => onSelect(node.path)}
        className={`flex flex-1 items-center gap-1 px-2 py-0.5 text-xs rounded truncate ${
          isActive
            ? "text-accent-cyan bg-white/[0.08]"
            : "text-text-secondary hover:bg-white/[0.06]"
        }`}
      >
        <i className={fileIcon(node.name)} />
        <span className="truncate">{node.name}</span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(node.path);
        }}
        className="hidden group-hover:block px-1 text-[10px] text-text-muted hover:text-red-400"
        title="Delete"
      >
        <i className="ri-delete-bin-line" />
      </button>
    </div>
  );
}

export function FileTree({
  tree,
  activeFile,
  onSelect,
  onNewFile,
  onDelete,
}: FileTreeProps) {
  const [showInput, setShowInput] = useState(false);
  const [newPath, setNewPath] = useState("notes/");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newPath.trim();
    if (!trimmed) return;
    onNewFile(trimmed, "");
    setShowInput(false);
    setNewPath("notes/");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-white/[0.08]">
        <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
          文件
        </span>
        <button
          type="button"
          onClick={() => setShowInput((prev) => !prev)}
          className="text-xs text-text-muted hover:text-accent-cyan"
          title="New file"
        >
          <i className="ri-add-line" />
        </button>
      </div>

      {showInput && (
        <form onSubmit={handleSubmit} className="px-2 py-1">
          <input
            type="text"
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            placeholder="path/filename.md"
            className="w-full bg-white/[0.06] border border-white/[0.08] rounded px-1.5 py-0.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setShowInput(false);
                setNewPath("notes/");
              }
            }}
          />
        </form>
      )}

      <div className="flex-1 overflow-y-auto py-1">
        {tree.map((node) => (
          <TreeItem
            key={node.path}
            node={node}
            activeFile={activeFile}
            onSelect={onSelect}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}
