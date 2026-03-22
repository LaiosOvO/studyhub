import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../../../components/feature/Navbar";
import { researchApi, type DeepResearchTask } from "../../../lib/api";

/**
 * Task detail page — routes based on task status:
 * - completed → redirect to map
 * - running/pending → show live progress
 * - failed → show error
 */
export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<DeepResearchTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!taskId) return;
    researchApi
      .get(taskId)
      .then((t) => {
        setTask(t);
        if (t.status === "completed") {
          // Redirect to map for completed tasks
          navigate(`/research/${taskId}`, { replace: true });
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [taskId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <Navbar />
        <div className="flex items-center justify-center pt-40">
          <i className="ri-loader-4-line animate-spin text-3xl text-accent-cyan" />
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <Navbar />
        <div className="flex flex-col items-center justify-center pt-40 gap-3">
          <i className="ri-error-warning-line text-3xl text-red-400" />
          <p className="text-sm text-red-300">{error || "任务不存在"}</p>
          <button onClick={() => navigate("/research")} className="text-xs text-accent-cyan hover:underline">
            返回任务列表
          </button>
        </div>
      </div>
    );
  }

  // Running or pending — show status with auto-refresh
  return <RunningTaskView task={task} />;
}

function RunningTaskView({ task: initialTask }: { task: DeepResearchTask }) {
  const navigate = useNavigate();
  const [task, setTask] = useState(initialTask);
  const [logs, setLogs] = useState<string[]>([]);
  const [errorDetail, setErrorDetail] = useState("");

  // Poll task status every 5 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const updated = await researchApi.get(task.id);
        setTask(updated);
        if (updated.status === "completed") {
          clearInterval(interval);
          // Small delay to show completion before redirect
          setTimeout(() => navigate(`/research/${task.id}`, { replace: true }), 1500);
        }
      } catch {
        // ignore polling errors
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [task.id, navigate]);

  // Connect WebSocket for live logs
  useEffect(() => {
    const wsUrl = researchApi.wsUrl(task.id);
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          const activity = data.current_activity || data.phase;
          if (activity) {
            setLogs((prev) => {
              if (prev[prev.length - 1] === activity) return prev;
              return [...prev.slice(-50), activity];
            });
          }
          // Update task counts from WS
          if (data.papers_found !== undefined || data.papers_analyzed !== undefined) {
            setTask((prev) => ({
              ...prev,
              papers_found: data.papers_found ?? prev.papers_found,
              papers_analyzed: data.papers_analyzed ?? prev.papers_analyzed,
              status: data.phase === "completed" ? "completed" : data.phase === "failed" ? "failed" : prev.status,
            }));
          }
          // Capture error details
          if (data.error) {
            setErrorDetail(data.error);
          }
        } catch {
          // ignore parse errors
        }
      };
    } catch {
      // WebSocket not available
    }
    return () => ws?.close();
  }, [task.id]);

  // Detect stuck tasks (running > 10 min with no papers)
  const ageMinutes = (Date.now() - new Date(task.created_at).getTime()) / 60000;
  const isStuck = task.status === "running" && task.papers_found === 0 && ageMinutes > 10;

  const statusLabel = task.status === "running"
    ? (isStuck ? "可能已卡住" : "进行中")
    : task.status === "failed" ? "失败"
    : task.status === "completed" ? "已完成" : "等待中";

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-2xl mx-auto">
          {/* Back */}
          <button
            onClick={() => navigate("/research")}
            className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary mb-6 transition-colors"
          >
            <i className="ri-arrow-left-line" /> 返回任务列表
          </button>

          {/* Task info card */}
          <div className="glass rounded-2xl p-6 border border-white/[0.06] mb-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h1 className="text-lg font-bold text-text-primary">{task.research_direction}</h1>
                <p className="text-xs text-text-muted mt-1">
                  创建于 {new Date(task.created_at).toLocaleString("zh-CN")}
                </p>
              </div>
              <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${
                isStuck ? "text-amber-400 bg-amber-400/10 border-amber-400/20" :
                task.status === "running" ? "text-accent-cyan bg-accent-cyan/10 border-accent-cyan/20" :
                task.status === "failed" ? "text-red-400 bg-red-400/10 border-red-400/20" :
                task.status === "completed" ? "text-green-400 bg-green-400/10 border-green-400/20" :
                "text-yellow-400 bg-yellow-400/10 border-yellow-400/20"
              }`}>
                {task.status === "running" && !isStuck && <i className="ri-loader-4-line animate-spin" />}
                {isStuck && <i className="ri-alert-line" />}
                {statusLabel}
              </span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] text-center">
                <div className="text-xl font-bold font-mono text-accent-cyan">{task.papers_found}</div>
                <div className="text-[10px] text-text-muted mt-0.5">发现论文</div>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] text-center">
                <div className="text-xl font-bold font-mono text-text-primary">{task.papers_analyzed}</div>
                <div className="text-[10px] text-text-muted mt-0.5">已分析</div>
              </div>
            </div>
          </div>

          {/* Stuck warning */}
          {isStuck && (
            <div className="p-4 rounded-xl bg-amber-400/[0.06] border border-amber-400/20 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <i className="ri-alert-line text-amber-400" />
                <span className="text-sm font-medium text-amber-300">任务可能已卡住</span>
              </div>
              <p className="text-xs text-amber-300/70 mb-3">
                任务已运行 {Math.floor(ageMinutes)} 分钟但未发现论文。可能是后端工作流崩溃或学术 API 限流。
              </p>
              <button
                onClick={() => navigate(`/research/new?direction=${encodeURIComponent(task.research_direction)}`)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-400/10 border border-amber-400/20 text-amber-300 text-xs font-medium hover:bg-amber-400/20 transition-colors"
              >
                <i className="ri-restart-line" /> 用相同方向重新创建
              </button>
            </div>
          )}

          {/* Live logs */}
          {logs.length > 0 && (
            <div className="glass rounded-xl border border-white/[0.06] overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent-cyan animate-pulse" />
                <span className="text-xs font-medium text-text-secondary">实时日志</span>
              </div>
              <div className="p-4 max-h-64 overflow-y-auto space-y-1 font-mono text-xs">
                {logs.map((log, i) => (
                  <div key={i} className="text-text-muted">
                    <span className="text-text-secondary/50 mr-2">{String(i + 1).padStart(3, " ")}</span>
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed redirect notice */}
          {task.status === "completed" && (
            <div className="mt-6 p-4 rounded-xl bg-green-400/[0.08] border border-green-400/20 text-center">
              <p className="text-sm text-green-300">
                <i className="ri-check-line mr-1" /> 任务完成，正在跳转到论文地图...
              </p>
            </div>
          )}

          {/* Failed */}
          {task.status === "failed" && (
            <div className="mt-6 space-y-4">
              <div className="p-4 rounded-xl bg-red-400/[0.08] border border-red-400/20">
                <div className="flex items-center gap-2 mb-2">
                  <i className="ri-close-circle-line text-red-400" />
                  <span className="text-sm font-medium text-red-300">任务失败</span>
                </div>
                {errorDetail && (
                  <p className="text-xs text-red-300/70 bg-red-400/[0.05] rounded-lg p-3 font-mono break-all">
                    {errorDetail}
                  </p>
                )}
                {!errorDetail && (
                  <p className="text-xs text-red-300/70">
                    可能原因：学术数据源 API 限流（429 Too Many Requests）或网络超时。
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate(`/research/new?direction=${encodeURIComponent(task.research_direction)}`)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent-cyan text-bg-primary text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  <i className="ri-restart-line" /> 用相同方向重试
                </button>
                <button
                  onClick={() => navigate("/research/new")}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-text-secondary text-sm font-medium hover:bg-white/[0.06] transition-colors"
                >
                  <i className="ri-add-line" /> 新建研究
                </button>
              </div>
            </div>
          )}

          {/* Actions for completed */}
          {task.status === "completed" && (
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => navigate(`/research/${task.id}`)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan text-sm font-medium"
              >
                <i className="ri-mind-map" /> 论文地图
              </button>
              <button
                onClick={() => navigate(`/research/${task.id}/report`)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-text-secondary text-sm font-medium"
              >
                <i className="ri-file-chart-line" /> 查看报告
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
