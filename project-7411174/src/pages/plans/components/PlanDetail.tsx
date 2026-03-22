import { useState } from "react";
import { Plan } from "../../../mocks/experiments";
import { PLAN_STATUS } from "../../../utils/statusUtils";
import { useToast } from "../../../components/base/Toast";
import PlanDetailTabs, { PlanTabKey } from "./PlanDetailTabs";
import PlanExecutionSidebar from "./PlanExecutionSidebar";

interface PlanDetailProps {
  plan: Plan;
  onClose: () => void;
  onRun: (id: string) => void;
}

const TABS: { key: PlanTabKey; label: string }[] = [
  { key: "overview",  label: "方案概览" },
  { key: "datasets",  label: "推荐数据集" },
  { key: "code",      label: "代码骨架" },
];

/**
 * Main plan detail panel (header + feasibility bars + tabs + actions + sidebar).
 * State lives here and is passed down to sub-components.
 */
export default function PlanDetail({ plan, onClose, onRun }: PlanDetailProps) {
  const [activeTab, setActiveTab] = useState<PlanTabKey>("overview");
  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState(plan.codeSketch);

  // Execution config (MLE-agent sidebar state)
  const [epochs, setEpochs] = useState(50);
  const [batchSize, setBatchSize] = useState(32);
  const [learningRate, setLearningRate] = useState("1e-4");
  const [gpuMode, setGpuMode] = useState<"fp16" | "fp32" | "bf16">("fp16");
  const [useAmp, setUseAmp] = useState(true);
  const [gradClip, setGradClip] = useState(true);

  const { toast } = useToast();
  const st = PLAN_STATUS[plan.status];

  const handleCopyCode = () => {
    navigator.clipboard.writeText(editedCode);
    toast({ title: "已复制", description: "代码已复制到剪贴板", variant: "success" });
  };

  return (
    <div className="flex-1 flex gap-4 overflow-hidden">
      {/* ── Main detail panel ──────────────────────────────────────── */}
      <div className="flex-1 bg-[#0E1428] rounded-2xl border border-white/[0.06] overflow-hidden flex flex-col min-w-0">
        {/* Header */}
        <header className="p-6 border-b border-white/[0.06]">
          <div className="flex items-start justify-between mb-3">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${st.bg} ${st.color}`}>
              {st.label}
            </span>
            <button
              onClick={onClose}
              aria-label="关闭详情"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[#475569] hover:text-[#F1F5F9] hover:bg-white/[0.05] cursor-pointer"
            >
              <i className="ri-close-line text-sm" />
            </button>
          </div>
          <h2 className="text-xl font-bold text-[#F1F5F9] mb-2">{plan.name}</h2>
          <p className="text-sm text-[#475569]">目标论文：{plan.targetPaper}</p>
        </header>

        {/* Feasibility breakdown */}
        <section className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.01]" aria-label="可行性评分">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-[#94A3B8]">综合可行性评分</span>
            <span className="text-lg font-bold text-[#00D4B8] font-mono">{plan.feasibilityScore}%</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {plan.feasibilityBreakdown.map((dim) => (
              <div key={dim.label}>
                <div className="flex justify-between text-[10px] mb-1.5">
                  <span className="text-[#475569]">{dim.label}</span>
                  <span className="text-[#94A3B8] font-mono">{dim.score}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#00D4B8] to-[#00A896] transition-all duration-700"
                    style={{ width: `${dim.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tab bar */}
        <nav className="flex gap-1 px-6 py-3 border-b border-white/[0.06]" role="tablist" aria-label="方案详情标签">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.key
                  ? "bg-[#00D4B8] text-[#080C1A]"
                  : "text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/[0.05]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Tab content */}
        <PlanDetailTabs
          plan={plan}
          activeTab={activeTab}
          isEditing={isEditing}
          setIsEditing={setIsEditing}
          editedCode={editedCode}
          setEditedCode={setEditedCode}
          onCopyCode={handleCopyCode}
        />

        {/* Action footer */}
        <footer className="p-5 border-t border-white/[0.06] flex gap-3">
          <button
            onClick={() => onRun(plan.id)}
            disabled={plan.status === "running" || plan.status === "completed"}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[#00D4B8] text-[#080C1A] hover:bg-[#00A896] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
          >
            <i className="ri-play-line" />
            {plan.status === "running" ? "执行中..." : plan.status === "completed" ? "已完成" : "在桌面端执行"}
          </button>
          <button
            onClick={() => setActiveTab("code")}
            aria-label="查看代码"
            className="w-10 h-10 flex items-center justify-center rounded-xl border border-white/[0.08] text-[#475569] hover:text-[#F1F5F9] hover:border-white/[0.15] transition-all cursor-pointer flex-shrink-0"
          >
            <i className="ri-code-line text-sm" />
          </button>
          <button
            aria-label="删除方案"
            className="w-10 h-10 flex items-center justify-center rounded-xl border border-red-500/20 text-red-400/60 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/[0.05] transition-all cursor-pointer flex-shrink-0"
          >
            <i className="ri-delete-bin-line text-sm" />
          </button>
        </footer>
      </div>

      {/* ── MLE-agent sticky config sidebar ───────────────────────── */}
      <PlanExecutionSidebar
        plan={plan}
        config={{
          epochs, setEpochs,
          batchSize, setBatchSize,
          learningRate, setLearningRate,
          gpuMode, setGpuMode,
          useAmp, setUseAmp,
          gradClip, setGradClip,
        }}
      />
    </div>
  );
}
