import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import Navbar from "../../components/feature/Navbar";
import Footer from "../../components/feature/Footer";
import { experimentsApi, type ExperimentRun } from "../../lib/api";
import { EXPERIMENT_STATUS } from "../../utils/statusUtils";
import { useToast } from "../../components/base/Toast";

// ── Local UI Experiment type (richer than API response) ─────────────────────
interface Experiment {
  id: string;
  name: string;
  status: "running" | "queued" | "completed" | "failed" | "paused";
  progress: number;
  currentEpoch: number;
  totalEpochs: number;
  bestMetric: number;
  baselineMetric: number;
  metricName: string;
  runtime: number;
  planId: string;
  createdAt: string;
  metrics: { epoch: number; loss: number; accuracy: number; f1: number; val_loss: number; val_accuracy: number }[];
  iterations: {
    id: string; epoch: number; summary: string; metricValue: number; isBest: boolean; timestamp: string;
  }[];
  gpu: { utilization: number; memUsed: number; memTotal: number; temperature: number };
}

/** Map an API ExperimentRun to the richer UI Experiment shape. */
function mapRunToExperiment(run: ExperimentRun): Experiment {
  const metrics = run.metrics as Record<string, unknown> | undefined;
  const currentRound = run.current_round ?? 0;
  const maxRounds = run.max_rounds ?? 100;
  const status = (run.status === "pending" ? "queued" : run.status) as Experiment["status"];
  const progress = status === "completed" ? 100 : Math.round((currentRound / Math.max(maxRounds, 1)) * 100);

  // Extract nested data from metrics if the API provides it
  const metricHistory = Array.isArray(metrics?.history) ? (metrics.history as Experiment["metrics"]) : [];
  const iterations = Array.isArray(metrics?.iterations) ? (metrics.iterations as Experiment["iterations"]) : [];
  const gpuRaw = (metrics?.gpu ?? {}) as Record<string, number>;
  const bestMetric = typeof metrics?.best_metric === "number" ? metrics.best_metric : 0;
  const baselineMetric = typeof metrics?.baseline_metric === "number" ? metrics.baseline_metric : 0;
  const metricName = typeof metrics?.metric_name === "string" ? metrics.metric_name : "F1";
  const runtime = typeof metrics?.runtime === "number" ? metrics.runtime : 0;

  return {
    id: run.id,
    name: typeof metrics?.name === "string" ? metrics.name : `实验 ${run.id.slice(0, 6)}`,
    status,
    progress,
    currentEpoch: currentRound,
    totalEpochs: maxRounds,
    bestMetric,
    baselineMetric,
    metricName,
    runtime,
    planId: run.plan_id,
    createdAt: run.created_at,
    metrics: metricHistory,
    iterations,
    gpu: {
      utilization: gpuRaw.utilization ?? 0,
      memUsed: gpuRaw.mem_used ?? 0,
      memTotal: gpuRaw.mem_total ?? 24,
      temperature: gpuRaw.temperature ?? 40,
    },
  };
}

function formatRuntime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── GPU Memory Ring (SVG) ────────────────────────────────────────────────────
function MemoryRing({ used, total }: { used: number; total: number }) {
  const pct = used / total;
  const r = 24;
  const circ = 2 * Math.PI * r;
  const filled = pct * circ;
  const color = pct > 0.85 ? "#F87171" : pct > 0.65 ? "#F59E0B" : "#00D4B8";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: 60, height: 60 }}>
        <svg width={60} height={60} viewBox="0 0 60 60" style={{ transform: "rotate(-90deg)" }}>
          <circle cx={30} cy={30} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5} strokeLinecap="round" />
          <circle
            cx={30} cy={30} r={r}
            fill="none"
            stroke={color}
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circ - filled}`}
            style={{ filter: `drop-shadow(0 0 3px ${color}80)` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] font-bold font-mono" style={{ color }}>{Math.round(pct * 100)}%</span>
        </div>
      </div>
      <p className="text-[10px] text-[#475569] text-center leading-tight">
        {used}/{total}<br />GB
      </p>
    </div>
  );
}

// ── Temperature Gauge (SVG arc) ──────────────────────────────────────────────
function TempGauge({ temp }: { temp: number }) {
  const MAX = 100;
  const frac = Math.min(temp / MAX, 1);
  const startAngle = -210;
  const sweepAngle = 240;
  const r = 22;
  const cx = 30;
  const cy = 32;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const arcPath = (frac: number) => {
    const start = toRad(startAngle);
    const end = toRad(startAngle + sweepAngle * frac);
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const large = sweepAngle * frac > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };
  const color = temp > 85 ? "#F87171" : temp > 70 ? "#F59E0B" : "#10B981";
  return (
    <div className="flex flex-col items-center gap-1">
      <div style={{ width: 60, height: 50 }}>
        <svg width={60} height={50} viewBox="0 0 60 50">
          <path d={arcPath(1)} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5} strokeLinecap="round" />
          <path d={arcPath(frac)} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 3px ${color}80)` }} />
          <text x={cx} y={cy + 2} textAnchor="middle" fontSize={10} fontWeight="700" fontFamily="monospace" fill={color}>
            {temp}°
          </text>
        </svg>
      </div>
      <p className="text-[10px] text-[#475569]">GPU 温度</p>
    </div>
  );
}

// ── Animated utilization bar ──────────────────────────────────────────────────
function UtilBar({ pct, label }: { pct: number; label: string }) {
  const color = pct > 90 ? "#10B981" : pct > 50 ? "#00D4B8" : "#F59E0B";
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-1.5">
        <span className="text-[#475569]">{label}</span>
        <span className="font-mono font-semibold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden relative">
        <div
          className="h-full rounded-full transition-all duration-1000 relative"
          style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 6px ${color}60` }}
        >
          {/* Moving shimmer */}
          <div className="absolute inset-0 rounded-full" style={{
            background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)",
            animation: "shimmer 2s linear infinite",
          }} />
        </div>
      </div>
    </div>
  );
}

// ── Sortable queued experiment item ──────────────────────────────────────────
function SortableQueueItem({
  exp,
  index,
  isSelected,
  onSelect,
}: {
  exp: Experiment;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: exp.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className={`relative flex items-center gap-2 px-3 py-3 border-l-2 transition-all ${
      isSelected ? "border-[#00D4B8] bg-[#00D4B8]/[0.06]" : "border-transparent hover:bg-white/[0.04]"
    }`}>
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="w-5 h-5 flex items-center justify-center text-[#334155] hover:text-[#475569] cursor-grab active:cursor-grabbing flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <i className="ri-draggable text-xs" />
      </button>
      <button className="flex-1 text-left cursor-pointer" onClick={onSelect}>
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[10px] font-mono text-[#475569] w-4">{index + 1}</span>
          <span className="text-xs font-medium text-[#F1F5F9] truncate">{exp.name}</span>
        </div>
        <p className="text-[10px] text-[#475569] ml-6">等待执行</p>
      </button>
    </div>
  );
}

// ── Experiment Action Bar (pause / skip / cancel / guidance) ─────────────────
function ExperimentActionBar({ runId, onCancelled }: { runId: string; onCancelled: () => void }) {
  const [guidance, setGuidance] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const handleControl = async (action: "pause" | "skip" | "cancel") => {
    if (action === "cancel") {
      try {
        await experimentsApi.cancel(runId);
        toast({ title: "实验已取消", variant: "success" });
        onCancelled();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "取消失败";
        toast({ title: "操作失败", description: message, variant: "destructive" });
      }
    } else {
      // pause / skip require Tauri desktop WebSocket — not yet wired via REST
      toast({
        title: "功能开发中",
        description: "暂停/跳过需要桌面端连接",
        variant: "default",
      });
    }
  };

  const handleSendGuidance = async () => {
    if (!guidance.trim()) return;
    setSending(true);
    // No REST endpoint for guidance yet — show informational toast
    toast({
      title: "功能开发中",
      description: "手动指导需要桌面端连接",
      variant: "default",
    });
    setSending(false);
  };

  return (
    <div className="flex items-center gap-3">
      {([
        { icon: "ri-pause-line", label: "暂停", action: "pause" as const },
        { icon: "ri-skip-forward-line", label: "跳过迭代", action: "skip" as const },
        { icon: "ri-stop-circle-line", label: "取消", action: "cancel" as const, danger: true },
      ]).map((btn) => (
        <button
          key={btn.label}
          onClick={() => handleControl(btn.action)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all cursor-pointer whitespace-nowrap ${
            btn.danger
              ? "border-red-500/20 text-red-400 hover:bg-red-500/[0.08] hover:border-red-500/40"
              : "border-white/[0.08] text-text-secondary hover:border-white/[0.2] hover:text-text-primary"
          }`}
        >
          <i className={btn.icon} />{btn.label}
        </button>
      ))}
      <div className="flex-1" />
      <div className="flex items-center gap-2 glass border border-white/[0.08] rounded-xl overflow-hidden">
        <input
          value={guidance}
          onChange={(e) => setGuidance(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendGuidance()}
          className="flex-1 px-4 py-2.5 bg-transparent text-sm text-text-primary placeholder-text-muted focus:outline-none"
          placeholder="手动指导 AI..."
        />
        <button
          onClick={handleSendGuidance}
          disabled={sending || !guidance.trim()}
          className="px-4 py-2.5 text-sm text-accent-cyan hover:bg-accent-cyan/[0.08] transition-all cursor-pointer whitespace-nowrap border-l border-white/[0.08] disabled:opacity-40"
        >
          发送
        </button>
      </div>
    </div>
  );
}

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [selected, setSelected] = useState<Experiment | null>(null);
  const [queuedList, setQueuedList] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchExperiments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const runs = await experimentsApi.list();
      const mapped = runs.map(mapRunToExperiment);
      setExperiments(mapped);
      setQueuedList(mapped.filter((e) => e.status === "queued"));
      // Select the first experiment if nothing is selected yet, or refresh the selected one
      setSelected((prev) => {
        if (prev) {
          const refreshed = mapped.find((e) => e.id === prev.id);
          return refreshed ?? mapped[0] ?? null;
        }
        return mapped[0] ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载实验列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExperiments();
  }, [fetchExperiments]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setQueuedList((items) => {
        const oldIdx = items.findIndex((e) => e.id === active.id);
        const newIdx = items.findIndex((e) => e.id === over.id);
        return arrayMove(items, oldIdx, newIdx);
      });
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <Navbar />
        <div className="flex items-center justify-center h-screen pt-[68px]">
          <div className="flex flex-col items-center gap-4">
            <i className="ri-loader-4-line text-3xl text-accent-cyan animate-spin" />
            <p className="text-sm text-text-muted">加载实验列表...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <Navbar />
        <div className="flex items-center justify-center h-screen pt-[68px]">
          <div className="flex flex-col items-center gap-4 max-w-md text-center">
            <i className="ri-error-warning-line text-3xl text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={fetchExperiments}
              className="px-4 py-2 rounded-lg bg-accent-cyan text-bg-primary text-sm font-medium hover:bg-accent-cyan-dim cursor-pointer transition-all"
            >
              重试
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (!selected) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <Navbar />
        <div className="flex items-center justify-center h-screen pt-[68px]">
          <div className="flex flex-col items-center gap-4">
            <i className="ri-flask-line text-3xl text-text-muted" />
            <p className="text-sm text-text-muted">暂无实验</p>
          </div>
        </div>
      </div>
    );
  }

  const groups = {
    running: experiments.filter((e) => e.status === "running"),
    completed: experiments.filter((e) => e.status === "completed" || e.status === "failed"),
  };

  const improvement = selected.bestMetric > 0
    ? (((selected.bestMetric - selected.baselineMetric) / selected.baselineMetric) * 100).toFixed(1)
    : "0";

  const chartData = selected.metrics.slice(-20).map((m) => ({
    epoch: m.epoch,
    训练Loss: parseFloat(m.loss.toFixed(4)),
    验证Loss: parseFloat(m.val_loss.toFixed(4)),
    Accuracy: parseFloat(m.accuracy.toFixed(4)),
    F1: parseFloat(m.f1.toFixed(4)),
  }));

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />
      <div className="flex h-screen pt-[68px]">
        {/* Left Sidebar */}
        <aside className="w-72 flex-shrink-0 border-r border-white/[0.06] flex flex-col overflow-hidden bg-bg-secondary">
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">实验列表</h2>
            <button className="w-7 h-7 flex items-center justify-center rounded-lg bg-accent-cyan text-bg-primary hover:bg-accent-cyan-dim cursor-pointer transition-all" title="新建实验">
              <i className="ri-add-line text-sm" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {/* Running */}
            {groups.running.length > 0 && (
              <div>
                <div className="px-4 py-2 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                  运行中 ({groups.running.length})
                </div>
                {groups.running.map((exp) => {
                  const st = EXPERIMENT_STATUS[exp.status];
                  return (
                    <button
                      key={exp.id}
                      onClick={() => setSelected(exp)}
                      className={`w-full text-left px-4 py-3 border-l-2 transition-all hover:bg-white/[0.04] cursor-pointer ${
                        selected.id === exp.id
                            ? "border-accent-cyan bg-accent-cyan/[0.06]"
                            : "border-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-text-primary truncate pr-2">{exp.name}</span>
                        <span className={`flex items-center gap-1 flex-shrink-0 ${st.color}`}>
                          <i className={`${st.icon} text-xs animate-spin`} />
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-white/[0.08] mt-1.5">
                        <div className="h-full rounded-full bg-accent-cyan/60 transition-all" style={{ width: `${exp.progress}%` }} />
                      </div>
                      <p className="text-[10px] text-text-muted mt-1 font-mono">{exp.progress}% · 最佳 {exp.metricName}: {exp.bestMetric.toFixed(3)}</p>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Queued — drag-and-drop */}
            {queuedList.length > 0 && (
              <div>
                <div className="px-4 py-2 text-[10px] font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
                  排队中 ({queuedList.length})
                  <span className="text-[10px] text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full border border-green-400/20">· 拖拽排序</span>
                </div>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={queuedList.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                    {queuedList.map((exp, idx) => (
                      <SortableQueueItem
                        key={exp.id}
                        exp={exp}
                        index={idx}
                        isSelected={selected.id === exp.id}
                        onSelect={() => setSelected(exp)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            )}

            {/* Completed */}
            {groups.completed.length > 0 && (
              <div>
                <div className="px-4 py-2 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                  已完成 ({groups.completed.length})
                </div>
                {groups.completed.map((exp) => {
                  const st = EXPERIMENT_STATUS[exp.status];
                  return (
                    <button
                      key={exp.id}
                      onClick={() => setSelected(exp)}
                      className={`w-full text-left px-4 py-3 border-l-2 transition-all hover:bg-white/[0.04] cursor-pointer ${
                        selected.id === exp.id ? "border-accent-cyan bg-accent-cyan/[0.06]" : "border-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-text-primary truncate pr-2">{exp.name}</span>
                        <span className={`flex items-center gap-1 flex-shrink-0 ${st.color}`}>
                          <i className={`${st.icon} text-xs`} />
                        </span>
                      </div>
                      {exp.bestMetric > 0 && (
                        <p className="text-[10px] text-text-muted mt-0.5 font-mono">最佳 {exp.metricName}: {exp.bestMetric.toFixed(3)}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto" id="main-content">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-xl font-bold text-text-primary">{selected.name}</h1>
                  <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${EXPERIMENT_STATUS[selected.status].color} bg-white/[0.05]`}>
                    <i className={`${EXPERIMENT_STATUS[selected.status].icon} ${selected.status === "running" ? "animate-spin" : ""}`} />
                    {EXPERIMENT_STATUS[selected.status].label}
                  </span>
                </div>
                <p className="text-sm text-text-muted">方案：{selected.planId} · 运行时长：{formatRuntime(selected.runtime)}</p>
              </div>
              {selected.status === "completed" && (
                <button
                  onClick={() => navigate(`/experiments/${selected.id}/report`)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent-cyan text-bg-primary text-sm font-semibold hover:bg-accent-cyan-dim cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-file-chart-line" /> 查看报告
                </button>
              )}
            </div>

            {/* Overview Cards */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[
                { label: "当前轮次", value: `${selected.currentEpoch}/${selected.totalEpochs}`, icon: "ri-refresh-line", color: "text-accent-cyan" },
                { label: `最佳 ${selected.metricName}`, value: selected.bestMetric > 0 ? selected.bestMetric.toFixed(3) : "--", icon: "ri-trophy-line", color: "text-amber-400" },
                { label: "vs 基线提升", value: `+${improvement}%`, icon: "ri-arrow-up-line", color: "text-green-400" },
                { label: "运行时长", value: formatRuntime(selected.runtime), icon: "ri-time-line", color: "text-text-secondary" },
              ].map((card) => (
                <div key={card.label} className="glass rounded-xl p-4 border border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-4 h-4 flex items-center justify-center ${card.color}`}>
                      <i className={`${card.icon} text-sm`} />
                    </span>
                    <span className="text-xs text-text-muted">{card.label}</span>
                  </div>
                  <div className={`text-xl font-bold font-mono ${card.color}`}>{card.value}</div>
                </div>
              ))}
            </div>

            {/* Training Chart */}
            {chartData.length > 0 && (
              <div className="glass rounded-xl p-5 border border-white/[0.06] mb-6">
                <h3 className="text-sm font-semibold text-text-primary mb-4">训练曲线</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="epoch" stroke="#475569" tick={{ fontSize: 11 }} label={{ value: "Epoch", position: "insideBottom", fill: "#475569", fontSize: 11 }} />
                    <YAxis stroke="#475569" tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#131929", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "12px" }}
                      labelStyle={{ color: "#94A3B8" }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                    <Line type="monotone" dataKey="训练Loss" stroke="#00D4B8" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="验证Loss" stroke="#F59E0B" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                    <Line type="monotone" dataKey="F1" stroke="#10B981" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Iteration History */}
            {selected.iterations.length > 0 && (
              <div className="glass rounded-xl border border-white/[0.06] mb-6">
                <div className="px-5 py-3.5 border-b border-white/[0.06]">
                  <h3 className="text-sm font-semibold text-text-primary">迭代历史</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/[0.04]">
                        {["轮次", "代码修改摘要", `${selected.metricName}`, "状态", "时间"].map((h) => (
                          <th key={h} className="px-5 py-3 text-left text-[11px] font-medium text-text-muted">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selected.iterations.map((it) => (
                        <tr key={it.id} className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${it.isBest ? "bg-accent-cyan/[0.03]" : ""}`}>
                          <td className="px-5 py-3 text-sm font-mono text-text-secondary">Epoch {it.epoch}</td>
                          <td className="px-5 py-3 text-sm text-text-secondary max-w-xs truncate">{it.summary}</td>
                          <td className={`px-5 py-3 text-sm font-mono font-semibold ${it.isBest ? "text-accent-cyan" : "text-text-secondary"}`}>
                            {it.metricValue.toFixed(3)}
                            {it.isBest && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20">最优</span>}
                          </td>
                          <td className="px-5 py-3">
                            {it.isBest ? (
                              <span className="text-xs text-green-400 flex items-center gap-1">
                                <i className="ri-checkbox-circle-line" /> 保留
                              </span>
                            ) : (
                              <span className="text-xs text-text-muted">覆盖</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-xs text-text-muted">{new Date(it.timestamp).toLocaleTimeString("zh-CN")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Enhanced GPU Monitoring Panel ────────────────────────────── */}
            <div className="glass rounded-xl p-5 border border-white/[0.06] mb-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-text-primary">GPU 监控</h3>
                  {selected.status === "running" && (
                    <span className="flex items-center gap-1 text-[10px] text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full border border-green-400/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      实时
                    </span>
                  )}
                </div>
                <span className="text-xs text-[#475569] font-mono">NVIDIA A100 80GB · PCIe</span>
              </div>

              <div className="flex gap-6 items-center mb-5">
                {/* Memory Ring */}
                <MemoryRing used={selected.gpu.memUsed} total={selected.gpu.memTotal} />
                {/* Temperature Gauge */}
                <TempGauge temp={selected.gpu.temperature} />
                {/* Utilization bars */}
                <div className="flex-1 space-y-3">
                  <UtilBar pct={selected.gpu.utilization} label="GPU 利用率" />
                  <UtilBar pct={Math.round((selected.gpu.memUsed / selected.gpu.memTotal) * 100)} label="显存占用率" />
                  <UtilBar pct={Math.min(selected.gpu.utilization * 0.6 + 20, 98)} label="功耗利用率" />
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "GPU 型号", value: "A100 80GB", icon: "ri-cpu-line", color: "text-[#94A3B8]" },
                  { label: "显存带宽", value: "2.0 TB/s", icon: "ri-speed-line", color: "text-[#00D4B8]" },
                  { label: "功耗", value: `${Math.round(selected.gpu.utilization * 3.5)}W`, icon: "ri-flashlight-line", color: "text-amber-400" },
                  { label: "驱动版本", value: "550.90.07", icon: "ri-git-commit-line", color: "text-[#475569]" },
                ].map((item) => (
                  <div key={item.label} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <div className="flex items-center gap-1.5 mb-1">
                      <i className={`${item.icon} text-xs ${item.color}`} />
                      <p className="text-[10px] text-[#475569]">{item.label}</p>
                    </div>
                    <p className={`text-sm font-bold font-mono ${item.color}`}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Bar */}
            {selected.status === "running" && (
              <ExperimentActionBar runId={selected.id} onCancelled={fetchExperiments} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
