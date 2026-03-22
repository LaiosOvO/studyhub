import { useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Navbar from "../../components/feature/Navbar";
import {
  getEnabledSkills,
  getSkillById,
  getSkillsByCategory,
  executeSkill,
  CATEGORY_LABELS,
  type SkillDefinition,
  type AgentEvent,
} from "../../lib/agent";
import { getLLMConfig } from "../../lib/deep-research";

type View = "browse" | "configure" | "running" | "done";

export default function AgentPage() {
  const [searchParams] = useSearchParams();
  const skillParam = searchParams.get("skill") || "";
  const navigate = useNavigate();

  const [view, setView] = useState<View>(skillParam ? "configure" : "browse");
  const [selectedSkill, setSelectedSkill] = useState<SkillDefinition | null>(
    skillParam ? getSkillById(skillParam) ?? null : null,
  );
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleSelectSkill = (skill: SkillDefinition) => {
    setSelectedSkill(skill);
    const defaults: Record<string, string> = {};
    for (const input of skill.inputs) {
      if (input.defaultValue) defaults[input.key] = input.defaultValue;
    }
    setInputs(defaults);
    setView("configure");
    setOutput(null);
    setError(null);
    setEvents([]);
  };

  const handleRun = async () => {
    if (!selectedSkill) return;

    const llm = getLLMConfig();
    if (!llm) {
      setError("请先在设置页面配置 LLM API Key、API Base 和模型名称");
      return;
    }

    for (const input of selectedSkill.inputs) {
      if (input.required && !inputs[input.key]?.trim()) {
        setError(`请填写: ${input.labelZh}`);
        return;
      }
    }

    setIsRunning(true);
    setError(null);
    setOutput(null);
    setEvents([]);
    setView("running");

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const result = await executeSkill(
        selectedSkill,
        inputs,
        llm,
        (event) => setEvents((prev) => [...prev, event]),
        abortController.signal,
      );
      setOutput(result);
      setView("done");
    } catch (err) {
      if (abortController.signal.aborted) {
        setView("configure");
      } else {
        setError(err instanceof Error ? err.message : String(err));
        setView("done");
      }
    } finally {
      setIsRunning(false);
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />
      <div className="pt-24 pb-16 px-6">
        {view === "browse" && (
          <SkillBrowser onSelect={handleSelectSkill} />
        )}
        {view === "configure" && selectedSkill && (
          <SkillConfigurator
            skill={selectedSkill}
            inputs={inputs}
            onInputChange={(k, v) => setInputs({ ...inputs, [k]: v })}
            onRun={handleRun}
            onBack={() => { setView("browse"); setSelectedSkill(null); }}
            error={error}
          />
        )}
        {view === "running" && selectedSkill && (
          <RunningView skill={selectedSkill} events={events} onCancel={handleCancel} />
        )}
        {view === "done" && selectedSkill && (
          <ResultView
            skill={selectedSkill}
            output={output}
            error={error}
            events={events}
            onBack={() => setView("configure")}
            onNew={() => { setView("browse"); setSelectedSkill(null); }}
          />
        )}
      </div>
    </div>
  );
}

// ── Skill Browser ────────────────────────────────────────────────────────────
function SkillBrowser({ onSelect }: { onSelect: (skill: SkillDefinition) => void }) {
  const grouped = getSkillsByCategory();
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-accent-cyan/30 bg-accent-cyan/[0.08] mb-4">
          <i className="ri-robot-line text-accent-cyan" />
          <span className="text-xs font-medium text-accent-cyan">AI Agent</span>
        </div>
        <h1 className="text-3xl font-bold text-text-primary mb-3">研究助手技能</h1>
        <p className="text-text-secondary">选择一个 AI 技能来辅助你的研究工作</p>
      </div>

      <div className="space-y-8">
        {Object.entries(grouped).map(([category, skills]) => {
          const catMeta = CATEGORY_LABELS[category] || { label: category, icon: "ri-apps-line" };
          return (
            <div key={category}>
              <h2 className="text-sm font-semibold text-text-secondary flex items-center gap-2 mb-4">
                <i className={`${catMeta.icon} text-accent-cyan`} />
                {catMeta.label}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {skills.map((skill) => (
                  <button
                    key={skill.id}
                    onClick={() => onSelect(skill)}
                    className="text-left p-5 rounded-xl glass border border-white/[0.06] hover:border-accent-cyan/30 transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-accent-cyan/10 border border-accent-cyan/20 group-hover:bg-accent-cyan/20 transition-colors">
                        <i className={`${skill.icon} text-accent-cyan text-lg`} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-text-primary">{skill.nameZh}</h3>
                        <p className="text-[10px] text-text-muted">{skill.name}</p>
                      </div>
                    </div>
                    <p className="text-xs text-text-secondary line-clamp-2">{skill.descriptionZh}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-text-muted">
                        ~{skill.estimatedCalls} 次 LLM 调用
                      </span>
                      {!skill.builtin && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20">
                          自定义
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-10 text-center">
        <button
          onClick={() => navigate("/settings?tab=skills")}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/[0.08] text-text-muted text-xs hover:border-accent-cyan/20 hover:text-accent-cyan transition-colors"
        >
          <i className="ri-settings-3-line" /> 管理技能配置
        </button>
      </div>
    </div>
  );
}

// ── Skill Configurator ───────────────────────────────────────────────────────
function SkillConfigurator({
  skill,
  inputs,
  onInputChange,
  onRun,
  onBack,
  error,
}: {
  skill: SkillDefinition;
  inputs: Record<string, string>;
  onInputChange: (key: string, value: string) => void;
  onRun: () => void;
  onBack: () => void;
  error: string | null;
}) {
  const llmConfig = getLLMConfig();
  const inputCls = "w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.1] text-sm text-text-primary placeholder:text-text-muted focus:border-accent-cyan/40 focus:outline-none transition-colors";

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary mb-6 transition-colors"
      >
        <i className="ri-arrow-left-line" /> 返回技能列表
      </button>

      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-accent-cyan/10 border border-accent-cyan/20">
          <i className={`${skill.icon} text-accent-cyan text-2xl`} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{skill.nameZh}</h1>
          <p className="text-sm text-text-secondary">{skill.descriptionZh}</p>
        </div>
      </div>

      {!llmConfig && (
        <div className="p-4 rounded-xl bg-amber-400/[0.08] border border-amber-400/20 mb-6">
          <p className="text-sm text-amber-300">
            <i className="ri-alert-line mr-1" />
            需要先在<a href="/settings" className="underline">设置页面</a>配置 LLM API Key
          </p>
        </div>
      )}

      <div className="glass rounded-2xl p-6 border border-white/[0.06] space-y-5">
        {skill.inputs.map((input) => (
          <div key={input.key}>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              {input.labelZh}
              {input.required && <span className="text-red-400 ml-0.5">*</span>}
            </label>
            {input.type === "textarea" ? (
              <textarea
                value={inputs[input.key] || ""}
                onChange={(e) => onInputChange(input.key, e.target.value)}
                placeholder={input.placeholder}
                rows={4}
                className={`${inputCls} resize-none`}
              />
            ) : input.type === "select" ? (
              <select
                value={inputs[input.key] || input.defaultValue || ""}
                onChange={(e) => onInputChange(input.key, e.target.value)}
                className={inputCls}
              >
                {input.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : (
              <input
                type={input.type === "number" ? "number" : "text"}
                value={inputs[input.key] || ""}
                onChange={(e) => onInputChange(input.key, e.target.value)}
                placeholder={input.placeholder}
                className={inputCls}
              />
            )}
          </div>
        ))}

        {error && (
          <div className="p-3 rounded-lg bg-red-400/[0.08] border border-red-400/20">
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        <button
          onClick={onRun}
          disabled={!llmConfig}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold bg-accent-cyan text-bg-primary hover:opacity-90 disabled:opacity-40 transition-all cursor-pointer cyan-glow"
        >
          <i className="ri-play-line" /> 运行 {skill.nameZh}
        </button>
      </div>
    </div>
  );
}

// ── Running View ─────────────────────────────────────────────────────────────
function RunningView({
  skill,
  events,
  onCancel,
}: {
  skill: SkillDefinition;
  events: AgentEvent[];
  onCancel: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 flex items-center justify-center rounded-2xl bg-accent-cyan/10 border-2 border-accent-cyan mx-auto mb-4">
          <i className={`${skill.icon} text-accent-cyan text-2xl animate-pulse`} />
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-2">正在执行: {skill.nameZh}</h1>
        <p className="text-sm text-text-secondary">AI 正在处理你的请求...</p>
      </div>

      <div className="glass rounded-xl border border-white/[0.06] p-5 mb-6">
        <div className="space-y-2">
          {events.map((evt, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                evt.type === "step_done" || evt.type === "agent_done" ? "bg-green-400" :
                evt.type === "step_failed" || evt.type === "agent_failed" ? "bg-red-400" :
                evt.type === "step_start" || evt.type === "step_progress" ? "bg-accent-cyan animate-pulse" :
                "bg-white/30"
              }`} />
              <span className={`text-xs ${
                evt.type === "step_done" || evt.type === "agent_done" ? "text-green-400" :
                evt.type === "step_failed" || evt.type === "agent_failed" ? "text-red-400" :
                "text-text-secondary"
              }`}>{evt.message}</span>
            </div>
          ))}
          {events.length === 0 && (
            <div className="flex items-center gap-2">
              <i className="ri-loader-4-line animate-spin text-accent-cyan" />
              <span className="text-xs text-text-muted">初始化中...</span>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={onCancel}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-400/20 text-red-400 text-sm font-medium hover:bg-red-400/10 transition-colors"
      >
        <i className="ri-stop-circle-line" /> 取消执行
      </button>
    </div>
  );
}

// ── Result View ──────────────────────────────────────────────────────────────
function ResultView({
  skill,
  output,
  error,
  events,
  onBack,
  onNew,
}: {
  skill: SkillDefinition;
  output: string | null;
  error: string | null;
  events: AgentEvent[];
  onBack: () => void;
  onNew: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (output) {
      navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 flex items-center justify-center rounded-xl ${
            error && !output ? "bg-red-400/10 border border-red-400/20" : "bg-green-400/10 border border-green-400/20"
          }`}>
            <i className={error && !output ? "ri-error-warning-line text-red-400" : "ri-check-double-line text-green-400"} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">
              {error && !output ? "执行失败" : `${skill.nameZh} 完成`}
            </h1>
            <p className="text-xs text-text-muted">
              {events.filter(e => e.type === "step_done").length} 步完成
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-lg border border-white/[0.08] text-text-secondary text-xs font-medium hover:border-accent-cyan/20 hover:text-accent-cyan transition-colors"
          >
            <i className="ri-edit-line mr-1" /> 修改重新运行
          </button>
          <button
            onClick={onNew}
            className="px-4 py-2 rounded-lg bg-accent-cyan text-bg-primary text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <i className="ri-add-line mr-1" /> 新任务
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-400/[0.08] border border-red-400/20 mb-6">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {output && (
        <div className="glass rounded-2xl border border-white/[0.06]">
          <div className="flex items-center justify-between px-6 py-3 border-b border-white/[0.06]">
            <span className="text-sm font-medium text-text-primary">结果输出</span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-text-muted text-xs hover:text-accent-cyan hover:border-accent-cyan/20 transition-colors"
            >
              <i className={copied ? "ri-check-line" : "ri-clipboard-line"} />
              {copied ? "已复制" : "复制"}
            </button>
          </div>
          <div className="p-6">
            <div className="prose prose-invert prose-sm max-w-none text-text-secondary leading-relaxed whitespace-pre-wrap">
              {output}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
