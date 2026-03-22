import { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/feature/Navbar";
import Footer from "../../components/feature/Footer";
import { readingListsApi, type ReadingListResponse } from "../../lib/api";
import EmptyState from "../../components/base/EmptyState";
import { useToast } from "../../components/base/Toast";

// Local UI type — backend only stores paper_ids, not full paper objects
interface ReadingList {
  id: string;
  name: string;
  description: string;
  paperIds: string[];
  createdAt: string;
  /** Local-only read tracking (not persisted to backend) */
  readIds: Set<string>;
}

/** Map API response to the UI shape */
function mapApiToReadingList(res: ReadingListResponse): ReadingList {
  return {
    id: res.id,
    name: res.name,
    description: res.description ?? "",
    paperIds: res.paper_ids,
    createdAt: res.created_at,
    readIds: new Set<string>(),
  };
}

/** Generate a minimal BibTeX string from paper IDs */
function generateBibTeX(listName: string, paperIds: string[]): string {
  return paperIds.map((pid, idx) => {
    const key = pid.replace(/[^a-zA-Z0-9]/g, "_");
    return [
      `@article{${key},`,
      `  note = {Paper ID: ${pid}},`,
      `  keywords = {${listName}, entry ${idx + 1}},`,
      `}`,
    ].join("\n");
  }).join("\n\n");
}

// ── Sortable paper row ────────────────────────────────────────────────────────
interface SortablePaperRowProps {
  paperId: string;
  index: number;
  isRead: boolean;
  onToggleRead: (id: string) => void;
  onRemove: (id: string) => void;
  onResearch: (id: string) => void;
}

function SortablePaperRow({ paperId, index, isRead, onToggleRead, onRemove, onResearch }: SortablePaperRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: paperId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`glass rounded-xl border transition-all flex items-center gap-3 group ${
        isDragging ? "border-[#00D4B8]/40 shadow-lg" : "border-white/[0.06] hover:border-white/[0.1]"
      }`}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="pl-3 py-4 text-[#334155] hover:text-[#475569] cursor-grab active:cursor-grabbing flex items-center flex-shrink-0"
        title="拖拽排序"
      >
        <i className="ri-draggable text-base" />
      </div>

      {/* Index */}
      <span className="text-xs font-mono text-[#334155] flex-shrink-0 w-5 text-right">{index + 1}</span>

      {/* Read toggle */}
      <button
        onClick={() => onToggleRead(paperId)}
        className="flex-shrink-0"
      >
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer ${
          isRead ? "border-[#00D4B8] bg-[#00D4B8]" : "border-white/[0.2] hover:border-[#00D4B8]/50"
        }`}>
          {isRead && <i className="ri-check-line text-[10px] text-[#080C1A]" />}
        </div>
      </button>

      {/* Paper info — display ID since backend only stores IDs */}
      <div className="flex-1 min-w-0 py-4 pr-1">
        <p className={`text-sm font-medium leading-snug line-clamp-1 transition-colors font-mono ${
          isRead ? "text-[#334155] line-through" : "text-[#F1F5F9]"
        }`}>
          {paperId}
        </p>
        <p className="text-xs text-[#475569] mt-1">
          Paper ID
        </p>
      </div>

      {/* Actions — show on hover */}
      <div className="flex gap-1.5 flex-shrink-0 pr-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onResearch(paperId)}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[#475569] hover:text-amber-400 hover:bg-amber-400/[0.08] cursor-pointer transition-all"
          title="开始深度研究"
        >
          <i className="ri-rocket-line text-xs" />
        </button>
        <button
          onClick={() => onRemove(paperId)}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[#475569] hover:text-red-400 hover:bg-red-400/[0.08] cursor-pointer transition-all"
          title="移除"
        >
          <i className="ri-delete-bin-line text-xs" />
        </button>
      </div>
    </div>
  );
}

// ── ReadingList sidebar item ──────────────────────────────────────────────────
interface ListItemProps {
  list: ReadingList;
  isActive: boolean;
  isEditing: boolean;
  onSelect: () => void;
  onStartEdit: () => void;
  onFinishEdit: (name: string) => void;
  onDelete: () => void;
}

function ListSidebarItem({ list, isActive, isEditing, onSelect, onStartEdit, onFinishEdit, onDelete }: ListItemProps) {
  const readCount = list.readIds.size;
  const totalCount = list.paperIds.length;
  const progress = totalCount > 0 ? (readCount / totalCount) * 100 : 0;

  return (
    <div
      className={`group flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer ${
        isActive ? "border-[#00D4B8]/30 bg-[#00D4B8]/[0.06]" : "border-white/[0.06] hover:border-white/[0.12] bg-[#0E1428]"
      }`}
      onClick={onSelect}
    >
      {/* Icon with progress ring */}
      <div className="relative flex-shrink-0">
        <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/[0.04]">
          <i className={`ri-bookmark-fill text-sm ${isActive ? "text-[#00D4B8]" : "text-[#475569]"}`} />
        </div>
        {totalCount > 0 && (
          <svg className="absolute -inset-0.5 w-10 h-10 -rotate-90" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="17" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
            <circle
              cx="20" cy="20" r="17" fill="none"
              stroke={isActive ? "#00D4B8" : "#334155"}
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={`${progress * 1.07} 107`}
              style={{ transition: "stroke-dasharray 0.5s ease" }}
            />
          </svg>
        )}
      </div>

      {/* Name & count */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            autoFocus
            type="text"
            defaultValue={list.name}
            onBlur={(e) => onFinishEdit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onFinishEdit((e.target as HTMLInputElement).value);
              if (e.key === "Escape") onFinishEdit(list.name);
            }}
            className="w-full bg-transparent text-xs text-[#F1F5F9] focus:outline-none border-b border-[#00D4B8]/50 pb-px"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <p className="text-xs font-medium text-[#F1F5F9] truncate">{list.name}</p>
        )}
        <p className="text-[10px] text-[#475569] mt-0.5">
          {totalCount} 篇 · 已读 {readCount}
        </p>
      </div>

      {/* Action buttons — show on hover */}
      <div
        className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onStartEdit}
          className="w-5 h-5 flex items-center justify-center rounded text-[#475569] hover:text-[#F1F5F9] cursor-pointer transition-colors"
        >
          <i className="ri-edit-line text-[10px]" />
        </button>
        <button
          onClick={onDelete}
          className="w-5 h-5 flex items-center justify-center rounded text-[#475569] hover:text-red-400 cursor-pointer transition-colors"
        >
          <i className="ri-delete-bin-line text-[10px]" />
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ReadingListsPage() {
  const [lists, setLists] = useState<ReadingList[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [exportLoading, setExportLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    readingListsApi
      .list()
      .then((data) => {
        if (cancelled) return;
        const mapped = data.map(mapApiToReadingList);
        setLists(mapped);
        if (mapped.length > 0) setSelectedId(mapped[0].id);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load reading lists");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const selected = lists.find((l) => l.id === selectedId) || lists[0];

  // Update a list by id (immutable)
  const updateList = useCallback((id: string, updater: (l: ReadingList) => ReadingList) => {
    setLists((prev) => prev.map((l) => (l.id === id ? updater(l) : l)));
  }, []);

  const handleRename = async (id: string, name: string) => {
    const trimmed = name.trim();
    setEditingId(null);
    if (!trimmed) return;

    // Find the original name for rollback
    const original = lists.find((l) => l.id === id);
    if (!original || original.name === trimmed) return;

    // Optimistic update
    updateList(id, (l) => ({ ...l, name: trimmed }));

    try {
      await readingListsApi.update(id, { name: trimmed });
    } catch (err) {
      // Revert on failure
      updateList(id, (l) => ({ ...l, name: original.name }));
      toast({
        title: "重命名失败",
        description: err instanceof Error ? err.message : "请稍后重试",
        variant: "error",
      });
    }
  };

  const handleDelete = async (id: string) => {
    // Snapshot for rollback
    const snapshot = lists;
    const remaining = lists.filter((l) => l.id !== id);

    // Optimistic update
    setLists(remaining);
    if (selectedId === id && remaining.length > 0) setSelectedId(remaining[0].id);

    try {
      await readingListsApi.delete(id);
      toast({ title: "列表已删除", variant: "default" });
    } catch (err) {
      // Revert on failure
      setLists(snapshot);
      if (selectedId === id) setSelectedId(id);
      toast({
        title: "删除失败",
        description: err instanceof Error ? err.message : "请稍后重试",
        variant: "error",
      });
    }
  };

  const handleCreate = async () => {
    const trimmed = createName.trim();
    if (!trimmed) return;

    // Clear UI immediately
    setCreateName("");
    setShowCreate(false);

    try {
      const res = await readingListsApi.create({ name: trimmed });
      const newList = mapApiToReadingList(res);
      setLists((prev) => [...prev, newList]);
      setSelectedId(newList.id);
      toast({ title: `「${newList.name}」已创建`, variant: "success" });
    } catch (err) {
      toast({
        title: "创建失败",
        description: err instanceof Error ? err.message : "请稍后重试",
        variant: "error",
      });
    }
  };

  const handleToggleRead = (paperId: string) => {
    // Read tracking is local-only (not persisted to backend)
    updateList(selectedId, (l) => {
      const nextReadIds = new Set(l.readIds);
      if (nextReadIds.has(paperId)) {
        nextReadIds.delete(paperId);
      } else {
        nextReadIds.add(paperId);
      }
      return { ...l, readIds: nextReadIds };
    });
  };

  const handleRemovePaper = async (paperId: string) => {
    if (!selectedId) return;

    // Snapshot for rollback
    const original = lists.find((l) => l.id === selectedId);
    if (!original) return;

    // Optimistic update
    updateList(selectedId, (l) => ({
      ...l,
      paperIds: l.paperIds.filter((pid) => pid !== paperId),
      readIds: (() => { const s = new Set(l.readIds); s.delete(paperId); return s; })(),
    }));

    try {
      await readingListsApi.removePaper(selectedId, paperId);
    } catch (err) {
      // Revert on failure
      updateList(selectedId, () => original);
      toast({
        title: "移除论文失败",
        description: err instanceof Error ? err.message : "请稍后重试",
        variant: "error",
      });
    }
  };

  const handleResearch = (paperId: string) => {
    navigate("/research/new");
    toast({ title: "已启动深度研究", description: `Paper: ${paperId.slice(0, 30)}...`, variant: "success" });
  };

  const handleExportBibTeX = async () => {
    if (!selected || selected.paperIds.length === 0) return;

    setExportLoading(true);
    try {
      const bibtex = generateBibTeX(selected.name, selected.paperIds);
      await navigator.clipboard.writeText(bibtex);
      toast({
        title: "BibTeX 已导出",
        description: `${selected.paperIds.length} 篇论文的引用格式已复制到剪贴板`,
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "导出失败",
        description: err instanceof Error ? err.message : "无法复制到剪贴板",
        variant: "error",
      });
    } finally {
      setExportLoading(false);
    }
  };

  const handleBulkResearch = () => {
    if (!selected) return;
    const unreadCount = selected.paperIds.filter((pid) => !selected.readIds.has(pid)).length;
    navigate("/research/new");
    toast({ title: "批量深度研究已启动", description: `将对 ${unreadCount} 篇未读论文进行分析`, variant: "success" });
  };

  // dnd-kit: drag end reorder
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    updateList(selectedId, (l) => {
      const oldIdx = l.paperIds.findIndex((pid) => pid === active.id);
      const newIdx = l.paperIds.findIndex((pid) => pid === over.id);
      return { ...l, paperIds: arrayMove(l.paperIds, oldIdx, newIdx) };
    });
  };

  const readCount = selected ? selected.readIds.size : 0;
  const totalCount = selected ? selected.paperIds.length : 0;
  const progressPct = totalCount > 0 ? Math.round((readCount / totalCount) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#080C1A]">
      <Navbar />
      <div className="max-w-[1400px] mx-auto px-6 pt-24 pb-16">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#F1F5F9] mb-1">阅读列表</h1>
          <p className="text-[#94A3B8] text-sm">管理你收藏的论文，追踪阅读进度</p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <i className="ri-loader-4-line animate-spin text-2xl text-[#00D4B8]" />
            <span className="ml-3 text-sm text-[#94A3B8]">加载阅读列表...</span>
          </div>
        )}

        {error && !loading && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-5 py-4 text-sm text-red-400">
            <i className="ri-error-warning-line mr-2" />
            {error}
          </div>
        )}

        {!loading && !error && <div className="flex gap-6">
          {/* ── Sidebar ─── */}
          <aside className="w-64 flex-shrink-0 space-y-2">
            {/* Create new */}
            <button
              onClick={() => setShowCreate(true)}
              className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-white/[0.1] text-xs text-[#475569] hover:border-[#00D4B8]/30 hover:text-[#00D4B8] transition-all cursor-pointer"
            >
              <i className="ri-add-line" /> 新建列表
            </button>

            {showCreate && (
              <div className="flex gap-2">
                <input
                  autoFocus
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowCreate(false); }}
                  placeholder="列表名称..."
                  className="flex-1 px-3 py-2 bg-white/[0.04] border border-[#00D4B8]/50 rounded-lg text-xs text-[#F1F5F9] focus:outline-none"
                />
                <button
                  onClick={handleCreate}
                  className="px-3 py-2 rounded-lg bg-[#00D4B8] text-[#080C1A] text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  确认
                </button>
              </div>
            )}

            {lists.length === 0 ? (
              <EmptyState
                icon="ri-bookmark-line"
                title="还没有列表"
                description="创建你的第一个阅读列表"
                size="sm"
                actionLabel="新建列表"
                onAction={() => setShowCreate(true)}
              />
            ) : (
              lists.map((list) => (
                <ListSidebarItem
                  key={list.id}
                  list={list}
                  isActive={list.id === selectedId}
                  isEditing={editingId === list.id}
                  onSelect={() => setSelectedId(list.id)}
                  onStartEdit={() => setEditingId(list.id)}
                  onFinishEdit={(name) => handleRename(list.id, name)}
                  onDelete={() => handleDelete(list.id)}
                />
              ))
            )}
          </aside>

          {/* ── Main content ─── */}
          <main id="main-content" className="flex-1">
            {selected ? (
              <>
                {/* Header */}
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h2 className="text-lg font-bold text-[#F1F5F9]">{selected.name}</h2>
                    <p className="text-xs text-[#475569] mt-1">
                      {totalCount} 篇论文 · 已读 {readCount} 篇
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportBibTeX}
                      disabled={exportLoading || totalCount === 0}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/[0.08] text-xs text-[#94A3B8] hover:border-white/[0.2] hover:text-[#F1F5F9] disabled:opacity-40 cursor-pointer whitespace-nowrap transition-all"
                    >
                      {exportLoading ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-download-line" />}
                      导出 BibTeX
                    </button>
                    <button
                      onClick={handleBulkResearch}
                      disabled={totalCount === 0}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#00D4B8] text-[#080C1A] text-xs font-semibold hover:bg-[#00A896] disabled:opacity-40 cursor-pointer whitespace-nowrap transition-all"
                    >
                      <i className="ri-rocket-line" /> 批量深度研究
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                {totalCount > 0 && (
                  <div className="mb-5 bg-[#0E1428] rounded-xl p-4 border border-white/[0.06]">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-[#475569]">阅读进度</span>
                      <span className="font-mono text-[#00D4B8]">{readCount} / {totalCount} · {progressPct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#00D4B8] to-[#00A896] transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Paper list with dnd-kit */}
                {totalCount === 0 ? (
                  <div className="bg-[#0E1428] rounded-2xl border border-dashed border-white/[0.1]">
                    <EmptyState
                      icon="ri-file-add-line"
                      title="这个列表还是空的"
                      description="在论文搜索页点击书签图标，将感兴趣的论文加入此列表"
                      actionLabel="去搜索论文"
                      onAction={() => navigate("/search")}
                      actionIcon="ri-search-line"
                    />
                  </div>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={selected.paperIds} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {selected.paperIds.map((paperId, index) => (
                          <SortablePaperRow
                            key={paperId}
                            paperId={paperId}
                            index={index}
                            isRead={selected.readIds.has(paperId)}
                            onToggleRead={handleToggleRead}
                            onRemove={handleRemovePaper}
                            onResearch={handleResearch}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}

                {/* Tip */}
                {totalCount > 1 && (
                  <p className="text-[10px] text-[#334155] text-center mt-4 flex items-center justify-center gap-1.5">
                    <i className="ri-drag-move-2-line" />
                    拖拽左侧手柄可以自由排序
                  </p>
                )}
              </>
            ) : (
              <div className="bg-[#0E1428] rounded-2xl border border-dashed border-white/[0.1]">
                <EmptyState
                  icon="ri-bookmark-line"
                  title="选择一个列表开始阅读"
                  description="在左侧选择或新建阅读列表"
                />
              </div>
            )}
          </main>
        </div>}
      </div>
      <Footer />
    </div>
  );
}
