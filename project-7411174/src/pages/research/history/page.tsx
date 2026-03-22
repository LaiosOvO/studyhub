import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../../components/feature/Navbar";
import { researchApi, type DeepResearchTask } from "../../../lib/api";

const STATUS_MAP: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: "等待中", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20", icon: "ri-time-line" },
  running: { label: "进行中", color: "text-accent-cyan bg-accent-cyan/10 border-accent-cyan/20", icon: "ri-loader-4-line animate-spin" },
  completed: { label: "已完成", color: "text-green-400 bg-green-400/10 border-green-400/20", icon: "ri-check-line" },
  failed: { label: "失败", color: "text-red-400 bg-red-400/10 border-red-400/20", icon: "ri-close-line" },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} 小时前`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} 天前`;
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric", year: "numeric" });
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "< 1 分钟";
  if (min < 60) return `${min} 分钟`;
  const hr = Math.floor(min / 60);
  const remainMin = min % 60;
  return remainMin > 0 ? `${hr} 小时 ${remainMin} 分钟` : `${hr} 小时`;
}

interface LocalResearch {
  id: string;
  direction: string;
  createdAt: string;
  result: { totalPapers: number; analyzedPapers: number; report: { overview: string } | null };
}

export default function ResearchHistoryPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<DeepResearchTask[]>([]);
  const [localResults, setLocalResults] = useState<LocalResearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Load local research history from localStorage
    try {
      const stored = JSON.parse(localStorage.getItem("studyhub_research_history") || "[]");
      setLocalResults(stored);
    } catch { /* ignore */ }

    researchApi
      .list({ limit: 50 })
      .then((data) => {
        const sorted = [...data].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setTasks(sorted);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "加载失败"))
      .finally(() => setLoading(false));
  }, []);

  const handleTaskClick = (task: DeepResearchTask) => {
    if (task.status === "completed") {
      navigate(`/research/${task.id}`);
    } else {
      // Running, pending, or failed — show task detail with live progress
      navigate(`/research/${task.id}/detail`);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-text-primary">研究历史</h1>
              <p className="text-sm text-text-muted mt-1">
                查看所有深度研究任务的状态和结果
              </p>
            </div>
            <button
              onClick={() => navigate("/research/new")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan text-sm font-medium hover:bg-accent-cyan/20 transition-colors"
            >
              <i className="ri-add-line" />
              新建研究
            </button>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <i className="ri-loader-4-line animate-spin text-3xl text-accent-cyan" />
              <p className="text-sm text-text-muted">加载中...</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 rounded-xl bg-red-400/[0.08] border border-red-400/20 text-center">
              <p className="text-sm text-red-300">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 text-xs text-red-400 underline"
              >
                重试
              </button>
            </div>
          )}

          {/* Local research results */}
          {localResults.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
                <i className="ri-computer-line text-accent-cyan" />
                本地研究（浏览器端）
              </h2>
              <div className="space-y-3">
                {localResults.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navigate(`/research/new?local=${item.id}`)}
                    className="w-full text-left p-4 rounded-xl bg-white/[0.03] border border-accent-cyan/10 hover:border-accent-cyan/30 hover:bg-white/[0.05] transition-all group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-text-primary truncate group-hover:text-accent-cyan transition-colors">
                          {item.direction}
                        </h3>
                        <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
                          <span className="flex items-center gap-1">
                            <i className="ri-time-line" />
                            {formatDate(item.createdAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <i className="ri-file-text-line" />
                            {item.result.totalPapers} 篇论文
                          </span>
                          <span className="flex items-center gap-1">
                            <i className="ri-robot-line" />
                            {item.result.analyzedPapers} 篇已分析
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium whitespace-nowrap text-green-400 bg-green-400/10 border-green-400/20">
                        <i className="ri-check-line" />
                        已完成
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && tasks.length === 0 && localResults.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <i className="ri-search-eye-line text-5xl text-text-muted" />
              <p className="text-text-muted">暂无研究任务</p>
              <button
                onClick={() => navigate("/research/new")}
                className="px-4 py-2 rounded-lg bg-accent-cyan text-bg-primary text-sm font-medium hover:opacity-90 transition-opacity"
              >
                开始第一次深度研究
              </button>
            </div>
          )}

          {/* Task list */}
          {!loading && tasks.length > 0 && (
            <div className="space-y-3">
              {tasks.map((task) => {
                const status = STATUS_MAP[task.status] || STATUS_MAP.pending;
                return (
                  <button
                    key={task.id}
                    onClick={() => handleTaskClick(task)}
                    className="w-full text-left p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-accent-cyan/30 hover:bg-white/[0.05] transition-all group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Direction / title */}
                        <h3 className="text-sm font-medium text-text-primary truncate group-hover:text-accent-cyan transition-colors">
                          {task.research_direction}
                        </h3>

                        {/* Meta row */}
                        <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
                          <span className="flex items-center gap-1">
                            <i className="ri-time-line" />
                            {formatDate(task.created_at)}
                          </span>
                          {task.completed_at && (
                            <span className="flex items-center gap-1">
                              <i className="ri-timer-line" />
                              {formatDuration(task.created_at, task.completed_at)}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <i className="ri-file-text-line" />
                            {task.papers_found} 篇论文
                          </span>
                          {task.papers_analyzed > 0 && (
                            <span className="flex items-center gap-1">
                              <i className="ri-robot-line" />
                              {task.papers_analyzed} 篇已分析
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status badge */}
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium whitespace-nowrap ${status.color}`}>
                        <i className={status.icon} />
                        {status.label}
                      </div>
                    </div>

                    {/* Action hint for completed */}
                    {task.status === "completed" && (
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/[0.06]">
                        <span
                          className="text-xs text-accent-cyan/70 hover:text-accent-cyan flex items-center gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/research/${task.id}`);
                          }}
                        >
                          <i className="ri-mind-map" /> 论文地图
                        </span>
                        <span
                          className="text-xs text-accent-cyan/70 hover:text-accent-cyan flex items-center gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/research/${task.id}/report`);
                          }}
                        >
                          <i className="ri-file-chart-line" /> 查看报告
                        </span>
                        <span
                          className="text-xs text-accent-cyan/70 hover:text-accent-cyan flex items-center gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/research/${task.id}/workspace`);
                          }}
                        >
                          <i className="ri-flask-line" /> 工作空间
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
