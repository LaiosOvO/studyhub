import type { OpenTab } from "../types";

interface EditorTabsProps {
  tabs: OpenTab[];
  activeTab: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
}

function tabName(path: string): string {
  return path.split("/").pop() ?? path;
}

export function EditorTabs({
  tabs,
  activeTab,
  onSelect,
  onClose,
}: EditorTabsProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="flex items-center gap-0 border-b border-white/[0.08] bg-bg-primary overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = tab.path === activeTab;
        return (
          <div
            key={tab.path}
            className="group relative flex items-center shrink-0"
          >
            <button
              type="button"
              onClick={() => onSelect(tab.path)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ${
                isActive
                  ? "text-text-primary border-b-2 border-b-accent-cyan"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {tab.isDirty && (
                <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan shrink-0" />
              )}
              <span className="truncate max-w-[120px]">
                {tabName(tab.path)}
              </span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.path);
              }}
              className="hidden group-hover:flex items-center justify-center w-4 h-4 mr-1 text-[10px] text-text-muted hover:text-text-primary rounded"
              title="Close"
            >
              <i className="ri-close-line" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
