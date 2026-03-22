import { useState, useCallback, useEffect } from "react";
import { workspaceApi } from "../../../../lib/api";
import { buildTree, detectLanguage } from "../types";
import type { OpenTab, TreeNode } from "../types";
import type { WorkspaceFile } from "../../../../lib/api";

export function useWorkspaceFiles(taskId: string) {
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await workspaceApi.getTree(taskId);
      setFiles(result);
      setTree(buildTree(result.filter((f) => f.type === "file")));
    } catch (err) {
      console.error("Failed to load workspace tree:", err);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openFile = useCallback(
    async (path: string) => {
      const existing = tabs.find((t) => t.path === path);
      if (existing) {
        setActiveTab(path);
        return;
      }
      try {
        const { content } = await workspaceApi.getFile(taskId, path);
        const language = detectLanguage(path);
        const newTab: OpenTab = { path, content, language, isDirty: false };
        setTabs((prev) => [...prev, newTab]);
        setActiveTab(path);
      } catch (err) {
        console.error("Failed to open file:", err);
      }
    },
    [taskId, tabs],
  );

  const closeTab = useCallback(
    (path: string) => {
      setTabs((prev) => {
        const next = prev.filter((t) => t.path !== path);
        if (activeTab === path) {
          const last = next.length > 0 ? next[next.length - 1].path : null;
          setActiveTab(last);
        }
        return next;
      });
    },
    [activeTab],
  );

  const updateContent = useCallback((path: string, content: string) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.path === path ? { ...t, content, isDirty: true } : t,
      ),
    );
  }, []);

  const saveFile = useCallback(
    async (path: string) => {
      const tab = tabs.find((t) => t.path === path);
      if (!tab) return;
      try {
        await workspaceApi.updateFile(taskId, path, tab.content);
        setTabs((prev) =>
          prev.map((t) =>
            t.path === path ? { ...t, isDirty: false } : t,
          ),
        );
        await refresh();
      } catch (err) {
        console.error("Failed to save file:", err);
      }
    },
    [taskId, tabs, refresh],
  );

  const createFile = useCallback(
    async (path: string, content: string) => {
      try {
        await workspaceApi.createFile(taskId, path, content);
        await refresh();
        await openFile(path);
      } catch (err) {
        console.error("Failed to create file:", err);
      }
    },
    [taskId, refresh, openFile],
  );

  const deleteFile = useCallback(
    async (path: string) => {
      try {
        await workspaceApi.deleteFile(taskId, path);
        closeTab(path);
        await refresh();
      } catch (err) {
        console.error("Failed to delete file:", err);
      }
    },
    [taskId, closeTab, refresh],
  );

  return {
    files,
    tree,
    tabs,
    activeTab,
    loading,
    openFile,
    closeTab,
    updateContent,
    saveFile,
    setActiveTab,
    createFile,
    deleteFile,
    refresh,
  };
}
