import { Dispatch, SetStateAction } from "react";
import { Plan } from "../../../mocks/experiments";
import { useToast } from "../../../components/base/Toast";

export interface SidebarConfig {
  epochs: number;
  setEpochs: Dispatch<SetStateAction<number>>;
  batchSize: number;
  setBatchSize: Dispatch<SetStateAction<number>>;
  learningRate: string;
  setLearningRate: Dispatch<SetStateAction<string>>;
  gpuMode: "fp16" | "fp32" | "bf16";
  setGpuMode: Dispatch<SetStateAction<"fp16" | "fp32" | "bf16">>;
  useAmp: boolean;
  setUseAmp: Dispatch<SetStateAction<boolean>>;
  gradClip: boolean;
  setGradClip: Dispatch<SetStateAction<boolean>>;
}

interface PlanExecutionSidebarProps {
  plan: Plan;
  config: SidebarConfig;
}

/**
 * MLE-agent style sticky execution config sidebar.
 * Contains: plan info / execution params / export / metrics.
 */
export default function PlanExecutionSidebar({ plan, config }: PlanExecutionSidebarProps) {
  const {
    epochs, setEpochs,
    batchSize, setBatchSize,
    learningRate, setLearningRate,
    gpuMode, setGpuMode,
    useAmp, setUseAmp,
    gradClip, setGradClip,
  } = config;
  const { toast } = useToast();

  const handleExport = (type: "py" | "ipynb" | "docker") => {
    const msgs = {
      py:     { title: "Python 文件已导出", desc: `${plan.name.slice(0, 20)}... 已保存到本地` },
      ipynb:  { title: "Jupyter Notebook 已导出", desc: `${plan.name.slice(0, 20)}... 已保存到本地` },
      docker: { title: "Docker 镜像生成中", desc: "预计 30 秒后可下载" },
    };
    toast({ title: msgs[type].title, description: msgs[type].desc, variant: type === "docker" ? "default" : "success" });
  };

  return (
    <div className="w-60 flex-shrink-0 space-y-3" style={{ position: "sticky", top: "96px", alignSelf: "flex-start" }}>
      {/* ── Plan Info ── */}
      <div className="bg-[#0E1428] rounded-xl border border-white/[0.06] p-4">
        <h3 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-3">方案信息</h3>
        <dl className="space-y-2.5">
          {[
            { icon: "ri-calendar-line",  term: "创建时间", value: "2026-03-14" },
            { icon: "ri-time-line",      term: "预计用时", value: "~4 小时" },
            { icon: "ri-bar-chart-line", term: "可行性",   value: `${plan.feasibilityScore}%` },
            { icon: "ri-database-2-line",term: "数据集数", value: `${plan.datasets.length} 个` },
          ].map((item) => (
            <div key={item.term} className="flex items-center justify-between">
              <dt className="flex items-center gap-1.5 text-[10px] text-[#475569]">
                <i className={`${item.icon} text-xs`} />
                {item.term}
              </dt>
              <dd className="text-[10px] font-mono text-[#94A3B8]">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* ── Execution Config ── */}
      <div className="bg-[#0E1428] rounded-xl border border-white/[0.06] p-4">
        <h3 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-3">执行配置</h3>
        <div className="space-y-3">
          {/* GPU mode */}
          <div>
            <label className="block text-[10px] text-[#475569] mb-1.5">精度模式</label>
            <div className="flex gap-1" role="group" aria-label="精度模式选择">
              {(["fp16", "bf16", "fp32"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setGpuMode(mode)}
                  aria-pressed={gpuMode === mode}
                  className={`flex-1 py-1 rounded text-[10px] font-mono transition-all cursor-pointer whitespace-nowrap ${
                    gpuMode === mode
                      ? "bg-[#00D4B8] text-[#080C1A] font-semibold"
                      : "bg-white/[0.04] border border-white/[0.08] text-[#475569] hover:border-white/[0.15]"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Epochs */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label htmlFor={`epochs-${plan.id}`} className="text-[10px] text-[#475569]">训练轮数</label>
              <span className="text-[10px] font-mono text-[#00D4B8]">{epochs}</span>
            </div>
            <input
              id={`epochs-${plan.id}`}
              type="range" min={10} max={200} step={10} value={epochs}
              onChange={(e) => setEpochs(Number(e.target.value))}
              className="w-full h-1 rounded-full appearance-none cursor-pointer"
              style={{ background: `linear-gradient(to right, #00D4B8 ${(epochs - 10) / 1.9}%, rgba(255,255,255,0.08) ${(epochs - 10) / 1.9}%)` }}
            />
            <div className="flex justify-between text-[9px] text-[#334155] mt-1">
              <span>10</span><span>200</span>
            </div>
          </div>

          {/* Batch Size */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] text-[#475569]">批次大小</span>
              <span className="text-[10px] font-mono text-[#00D4B8]">{batchSize}</span>
            </div>
            <div className="flex gap-1" role="group" aria-label="批次大小选择">
              {[8, 16, 32, 64, 128].map((v) => (
                <button
                  key={v}
                  onClick={() => setBatchSize(v)}
                  aria-pressed={batchSize === v}
                  className={`flex-1 py-1 rounded text-[9px] font-mono transition-all cursor-pointer whitespace-nowrap ${
                    batchSize === v
                      ? "bg-[#00D4B8]/20 border border-[#00D4B8]/40 text-[#00D4B8]"
                      : "bg-white/[0.03] border border-white/[0.06] text-[#475569] hover:border-white/[0.12]"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Learning Rate */}
          <div>
            <label htmlFor={`lr-${plan.id}`} className="block text-[10px] text-[#475569] mb-1.5">学习率</label>
            <select
              id={`lr-${plan.id}`}
              value={learningRate}
              onChange={(e) => setLearningRate(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[10px] font-mono text-[#94A3B8] focus:outline-none focus:border-[#00D4B8]/50 cursor-pointer"
            >
              {["1e-5", "3e-5", "1e-4", "3e-4", "1e-3"].map((lr) => (
                <option key={lr} value={lr}>{lr}</option>
              ))}
            </select>
          </div>

          {/* Toggles */}
          <div className="space-y-2 pt-1 border-t border-white/[0.06]">
            {[
              { id: `amp-${plan.id}`,       label: "混合精度 (AMP)", value: useAmp,   set: setUseAmp },
              { id: `gradclip-${plan.id}`,  label: "梯度裁剪",       value: gradClip, set: setGradClip },
            ].map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <label htmlFor={item.id} className="text-[10px] text-[#475569] cursor-pointer">{item.label}</label>
                <button
                  id={item.id}
                  role="switch"
                  aria-checked={item.value}
                  onClick={() => item.set(!item.value)}
                  className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer flex-shrink-0 ${item.value ? "bg-[#00D4B8]" : "bg-white/[0.12]"}`}
                >
                  <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${item.value ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Export ── */}
      <div className="bg-[#0E1428] rounded-xl border border-white/[0.06] p-4">
        <h3 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-3">导出方案</h3>
        <div className="space-y-2">
          {[
            { type: "py"     as const, icon: "ri-python-line",    iconColor: "text-[#00D4B8]",  iconBg: "bg-[#00D4B8]/10",   title: "Python 脚本",     sub: "model.py",          hoverBorder: "hover:border-[#00D4B8]/30", hoverBg: "hover:bg-[#00D4B8]/[0.04]" },
            { type: "ipynb"  as const, icon: "ri-book-open-line", iconColor: "text-amber-400",   iconBg: "bg-amber-400/10",   title: "Jupyter Notebook", sub: "experiment.ipynb", hoverBorder: "hover:border-amber-400/30", hoverBg: "hover:bg-amber-400/[0.04]" },
            { type: "docker" as const, icon: "ri-box-3-line",     iconColor: "text-[#94A3B8]",  iconBg: "bg-white/[0.06]",   title: "Docker 镜像",     sub: "含依赖环境",         hoverBorder: "hover:border-white/[0.12]", hoverBg: "" },
          ].map((item) => (
            <button
              key={item.type}
              onClick={() => handleExport(item.type)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] ${item.hoverBorder} ${item.hoverBg} transition-all cursor-pointer group`}
            >
              <span className={`w-7 h-7 flex items-center justify-center rounded-lg ${item.iconBg} flex-shrink-0`}>
                <i className={`${item.icon} text-sm ${item.iconColor}`} />
              </span>
              <div className="text-left">
                <p className="text-xs font-medium text-[#F1F5F9]">{item.title}</p>
                <p className="text-[10px] text-[#475569]">{item.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Metrics ── */}
      <div className="bg-[#0E1428] rounded-xl border border-white/[0.06] p-4">
        <h3 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-3">评估指标</h3>
        <ul className="space-y-1.5">
          {plan.metrics.map((m) => (
            <li key={m} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00D4B8] flex-shrink-0" />
              <span className="text-[11px] text-[#94A3B8]">{m}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
