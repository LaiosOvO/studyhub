import { Dispatch, SetStateAction } from "react";
import { Plan } from "../../../mocks/experiments";
import SyntaxHighlight from "./SyntaxHighlight";

export type PlanTabKey = "overview" | "datasets" | "code";

interface PlanDetailTabsProps {
  plan: Plan;
  activeTab: PlanTabKey;
  isEditing: boolean;
  setIsEditing: Dispatch<SetStateAction<boolean>>;
  editedCode: string;
  setEditedCode: Dispatch<SetStateAction<string>>;
  onCopyCode: () => void;
}

/**
 * Tab content panel for Plan detail:
 *   overview  — hypothesis / method / roadmap
 *   datasets  — recommended datasets list
 *   code      — MLE-agent style syntax-highlighted / editable code skeleton
 */
export default function PlanDetailTabs({
  plan,
  activeTab,
  isEditing,
  setIsEditing,
  editedCode,
  setEditedCode,
  onCopyCode,
}: PlanDetailTabsProps) {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* ── Overview ────────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-5">
          <section>
            <h4 className="text-xs font-semibold text-[#00D4B8] uppercase tracking-wider mb-2">研究假设</h4>
            <p className="text-sm text-[#94A3B8] leading-relaxed">{plan.hypothesis}</p>
          </section>

          <section>
            <h4 className="text-xs font-semibold text-[#00D4B8] uppercase tracking-wider mb-2">方法说明</h4>
            <p className="text-sm text-[#94A3B8] leading-relaxed whitespace-pre-line">{plan.method}</p>
          </section>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <h4 className="text-xs text-[#475569] mb-2">基线方法</h4>
              <p className="text-sm text-[#F1F5F9]">{plan.baselineMethod}</p>
            </div>
            <div className="p-4 rounded-xl bg-[#00D4B8]/[0.04] border border-[#00D4B8]/20">
              <h4 className="text-xs text-[#475569] mb-2">预期提升</h4>
              <p className="text-sm text-[#00D4B8]">{plan.expectedImprovement}</p>
            </div>
          </div>

          <section>
            <h4 className="text-xs font-semibold text-[#00D4B8] uppercase tracking-wider mb-3">技术路线图</h4>
            <ol className="space-y-2">
              {plan.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full border border-[#00D4B8]/30 bg-[#00D4B8]/[0.08] flex items-center justify-center text-[10px] font-mono text-[#00D4B8] flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm text-[#94A3B8] leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}

      {/* ── Datasets ─────────────────────────────────────────────────── */}
      {activeTab === "datasets" && (
        <div className="space-y-3">
          {plan.datasets.map((ds) => (
            <div
              key={ds.name}
              className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-all"
            >
              <span className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#00D4B8]/10 border border-[#00D4B8]/20 flex-shrink-0">
                <i className="ri-database-2-line text-sm text-[#00D4B8]" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#F1F5F9]">{ds.name}</p>
                <p className="text-xs text-[#475569] mt-0.5">规模：{ds.size}</p>
              </div>
              <a
                href={ds.url}
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/[0.08] text-xs text-[#94A3B8] hover:border-[#00D4B8]/30 hover:text-[#00D4B8] transition-all cursor-pointer whitespace-nowrap"
              >
                <i className="ri-download-line text-xs" /> 下载
              </a>
            </div>
          ))}
        </div>
      )}

      {/* ── Code ─────────────────────────────────────────────────────── */}
      {activeTab === "code" && (
        <div className="space-y-3">
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#475569]">AI 生成的代码骨架，可在此编辑后导出</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                  isEditing
                    ? "border-[#00D4B8]/40 text-[#00D4B8] bg-[#00D4B8]/10"
                    : "border-white/[0.08] text-[#94A3B8] hover:border-white/[0.15]"
                }`}
              >
                <i className={isEditing ? "ri-eye-line" : "ri-edit-line"} />
                {isEditing ? "预览" : "编辑"}
              </button>
              <button
                onClick={onCopyCode}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-white/[0.08] text-[#94A3B8] hover:border-white/[0.15] transition-all cursor-pointer whitespace-nowrap"
              >
                <i className="ri-file-copy-line" /> 复制
              </button>
            </div>
          </div>

          {/* Code area */}
          {isEditing ? (
            <div className="rounded-xl bg-[#080C1A] border border-white/[0.08] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                </div>
                <span className="text-xs text-[#475569] font-mono ml-2">model.py — 编辑模式</span>
              </div>
              <label className="sr-only" htmlFor={`code-editor-${plan.id}`}>代码编辑器</label>
              <textarea
                id={`code-editor-${plan.id}`}
                value={editedCode}
                onChange={(e) => setEditedCode(e.target.value)}
                className="w-full p-4 bg-transparent text-xs font-mono text-[#94A3B8] resize-none focus:outline-none leading-5"
                style={{ minHeight: "320px" }}
                spellCheck={false}
              />
            </div>
          ) : (
            <SyntaxHighlight code={editedCode} />
          )}
        </div>
      )}
    </div>
  );
}
