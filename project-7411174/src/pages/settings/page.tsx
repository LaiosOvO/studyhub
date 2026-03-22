import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../../components/feature/Navbar";
import { profilesApi, type ProfileResponse } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import {
  getAllSkills,
  toggleSkill,
  saveCustomSkill,
  deleteCustomSkill,
  CATEGORY_LABELS,
  type SkillDefinition,
} from "../../lib/agent";
import { getProviders, type ProviderInfo, type ModelInfo } from "../../lib/models-registry";

type Tab = "profile" | "llm" | "skills" | "account";

const KNOWN_INSTITUTIONS = [
  "北京大学", "清华大学", "复旦大学", "上海交通大学", "浙江大学",
  "中国科学技术大学", "南京大学", "武汉大学", "华中科技大学", "中山大学",
  "哈尔滨工业大学", "西安交通大学", "同济大学", "北京航空航天大学", "北京理工大学",
  "中国人民大学", "南开大学", "天津大学", "东南大学", "厦门大学",
  "四川大学", "中南大学", "山东大学", "吉林大学", "大连理工大学",
  "中国科学院", "中国医学科学院", "军事医学研究院",
  "华南理工大学", "电子科技大学", "重庆大学", "湖南大学",
  "首都医科大学", "协和医学院", "上海中医药大学",
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, logout } = useAuth();
  const initialTab = (searchParams.get("tab") as Tab) || "profile";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [noProfile, setNoProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Profile form state
  const [displayName, setDisplayName] = useState("");
  const [institution, setInstitution] = useState("");
  const [title, setTitle] = useState("");
  const [bio, setBio] = useState("");
  const [directions, setDirections] = useState("");
  const [expertise, setExpertise] = useState("");

  // LLM config (stored in localStorage for now)
  const [llmApiKey, setLlmApiKey] = useState(() => localStorage.getItem("studyhub_llm_api_key") || "");
  const [llmApiBase, setLlmApiBase] = useState(() => localStorage.getItem("studyhub_llm_api_base") || "");
  const [llmModel, setLlmModel] = useState(() => localStorage.getItem("studyhub_llm_model") || "");
  const [llmMaxTokens, setLlmMaxTokens] = useState(() => localStorage.getItem("studyhub_llm_max_tokens") || "32000");
  const [llmMaxOutput, setLlmMaxOutput] = useState(() => localStorage.getItem("studyhub_llm_max_output") || "4096");
  const [llmSaved, setLlmSaved] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);

  // Models registry
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState(() => localStorage.getItem("studyhub_llm_provider") || "");
  const [selectedModelId, setSelectedModelId] = useState(() => localStorage.getItem("studyhub_llm_model_id") || "");
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registryError, setRegistryError] = useState("");
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testing, setTesting] = useState(false);

  // Load models registry
  useEffect(() => {
    if (tab === "llm" && providers.length === 0) {
      setRegistryLoading(true);
      setRegistryError("");
      getProviders()
        .then(setProviders)
        .catch((e) => setRegistryError(e.message))
        .finally(() => setRegistryLoading(false));
    }
  }, [tab]);

  // Derived: models for selected provider
  const currentProviderModels = useMemo(() => {
    const p = providers.find((p) => p.id === selectedProvider);
    return p?.models ?? [];
  }, [providers, selectedProvider]);

  // When provider changes, update apiBase
  const handleProviderChange = (providerId: string) => {
    setSelectedProvider(providerId);
    const p = providers.find((p) => p.id === providerId);
    if (p) {
      setLlmApiBase(p.apiBase);
    }
    // Reset model selection
    setSelectedModelId("");
  };

  // When model changes, update model name + limits
  const handleModelSelect = (modelId: string) => {
    setSelectedModelId(modelId);
    const model = currentProviderModels.find((m) => m.id === modelId);
    if (model) {
      setLlmModel(model.id);
      if (model.contextLimit > 0) setLlmMaxTokens(String(model.contextLimit));
      if (model.outputLimit > 0) setLlmMaxOutput(String(model.outputLimit));
    }
  };

  useEffect(() => {
    profilesApi
      .getMe()
      .then((p) => {
        setProfile(p);
        setDisplayName(p.name || "");
        setInstitution(p.institution || "");
        setTitle(p.title || "");
        setBio(p.bio || "");
        setDirections((p.research_directions || []).join(", "));
        setExpertise((p.expertise || []).join(", "));
      })
      .catch(() => setNoProfile(true))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const dirList = directions.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
      const expList = expertise.split(/[,，]/).map((s) => s.trim()).filter(Boolean);

      if (noProfile) {
        const created = await profilesApi.createMe({
          display_name: displayName || user?.name || "Anonymous",
          institution: institution || undefined,
          title: title || undefined,
          research_directions: dirList,
          expertise_tags: expList,
        });
        setProfile(created);
        setNoProfile(false);
        setMessage({ type: "ok", text: "个人资料已创建" });
      } else {
        const updated = await profilesApi.updateMe({
          display_name: displayName || undefined,
          institution: institution || undefined,
          title: title || undefined,
          bio: bio || undefined,
          research_directions: dirList.length > 0 ? dirList : undefined,
          expertise_tags: expList.length > 0 ? expList : undefined,
        });
        setProfile(updated);
        setMessage({ type: "ok", text: "已保存" });
      }
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "保存失败" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLlm = () => {
    localStorage.setItem("studyhub_llm_api_key", llmApiKey);
    localStorage.setItem("studyhub_llm_api_base", llmApiBase);
    localStorage.setItem("studyhub_llm_model", llmModel);
    localStorage.setItem("studyhub_llm_max_tokens", llmMaxTokens);
    localStorage.setItem("studyhub_llm_max_output", llmMaxOutput);
    localStorage.setItem("studyhub_llm_provider", selectedProvider);
    localStorage.setItem("studyhub_llm_model_id", selectedModelId);
    setLlmSaved(true);
    setTimeout(() => setLlmSaved(false), 2000);
  };

  const handleTestLlm = async () => {
    if (!llmApiBase || !llmApiKey || !llmModel) return;
    setTesting(true);
    setTestResult(null);
    try {
      const API_URL = import.meta.env.VITE_API_URL || "";
      const start = Date.now();
      const resp = await fetch(`${API_URL}/llm/proxy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_base: llmApiBase,
          api_key: llmApiKey,
          model: llmModel,
          messages: [{ role: "user", content: "Say hello in one word." }],
          temperature: 0,
          max_tokens: 20,
          stream: false,
        }),
      });
      const elapsed = Date.now() - start;
      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        setTestResult({ ok: false, msg: `HTTP ${resp.status}: ${errText.slice(0, 200)}` });
      } else {
        const data = await resp.json();
        const content = data.choices?.[0]?.message?.content || "";
        const model = currentProviderModels.find((m) => m.id === selectedModelId);
        const costInfo = model ? `输入 $${model.costInput}/M · 输出 $${model.costOutput}/M` : "";
        setTestResult({
          ok: true,
          msg: `${elapsed}ms · 回复: "${content.slice(0, 50)}"${costInfo ? ` · ${costInfo}` : ""}`,
        });
      }
    } catch (e) {
      setTestResult({ ok: false, msg: e instanceof Error ? e.message : "连接失败" });
    }
    setTesting(false);
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "profile", label: "个人资料", icon: "ri-user-line" },
    { key: "llm", label: "LLM 配置", icon: "ri-robot-line" },
    { key: "skills", label: "技能管理", icon: "ri-tools-line" },
    { key: "account", label: "账户", icon: "ri-shield-user-line" },
  ];

  const inputCls = "w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.1] text-sm text-text-primary placeholder:text-text-muted focus:border-accent-cyan/40 focus:outline-none transition-colors";

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-text-primary mb-6">设置</h1>

          {/* Tabs */}
          <div className="flex gap-1 mb-8 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] w-fit">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === t.key
                    ? "bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                <i className={t.icon} />
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Profile Tab ── */}
          {tab === "profile" && (
            <div className="space-y-6">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <i className="ri-loader-4-line animate-spin text-2xl text-accent-cyan" />
                </div>
              ) : (
                <>
                  {noProfile && (
                    <div className="p-4 rounded-xl bg-amber-400/[0.06] border border-amber-400/20">
                      <p className="text-sm text-amber-300">
                        <i className="ri-information-line mr-1" />
                        你还没有创建研究者资料。填写下方信息后点击保存即可创建。
                      </p>
                    </div>
                  )}

                  <div className="space-y-4">
                    <Field label="显示名称" required>
                      <input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder={user?.name || "你的名字"}
                        className={inputCls}
                      />
                    </Field>

                    <Field label="机构" hint="选择或输入">
                      <ComboBox
                        value={institution}
                        onChange={setInstitution}
                        options={KNOWN_INSTITUTIONS}
                        placeholder="选择或输入机构名称"
                      />
                    </Field>

                    <Field label="职称">
                      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：副教授、博士生" className={inputCls} />
                    </Field>

                    <Field label="个人简介">
                      <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="简单介绍你的研究背景和兴趣" className={`${inputCls} resize-none`} />
                    </Field>

                    <Field label="研究方向" hint="用逗号分隔">
                      <input value={directions} onChange={(e) => setDirections(e.target.value)} placeholder="例如：ECG 智能诊断, 医学图像分析" className={inputCls} />
                    </Field>

                    <Field label="专业技能" hint="用逗号分隔">
                      <input value={expertise} onChange={(e) => setExpertise(e.target.value)} placeholder="例如：Python, PyTorch, 信号处理" className={inputCls} />
                    </Field>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSave}
                      disabled={saving || !displayName.trim()}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent-cyan text-bg-primary text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {saving ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-save-line" />}
                      {noProfile ? "创建资料" : "保存修改"}
                    </button>
                    {message && (
                      <span className={`text-sm ${message.type === "ok" ? "text-green-400" : "text-red-400"}`}>{message.text}</span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── LLM Config Tab ── */}
          {tab === "llm" && (
            <div className="space-y-6">
              {/* Provider & Model Selection */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs text-text-muted">
                    选择 LLM 提供商和模型，仅需填写 API Key。
                  </p>
                  {registryLoading && <i className="ri-loader-4-line animate-spin text-accent-cyan text-sm" />}
                </div>
                {registryError && (
                  <div className="mb-4 p-2 rounded-lg bg-red-400/[0.06] border border-red-400/20 text-xs text-red-300">
                    模型注册表加载失败: {registryError}
                  </div>
                )}
                <div className="space-y-4">
                  <Field label="提供商" hint={`${providers.length} 个可选`}>
                    <SearchableSelect
                      value={selectedProvider}
                      onChange={handleProviderChange}
                      placeholder="搜索提供商..."
                      options={providers.map((p) => ({
                        value: p.id,
                        label: p.name,
                        hint: `${p.models.length} 模型`,
                      }))}
                    />
                  </Field>

                  <Field label="模型" hint={selectedProvider ? `${currentProviderModels.length} 个可选` : ""}>
                    <SearchableSelect
                      value={selectedModelId}
                      onChange={handleModelSelect}
                      placeholder={selectedProvider ? "搜索模型..." : "先选择提供商"}
                      disabled={!selectedProvider}
                      options={currentProviderModels.map((m) => ({
                        value: m.id,
                        label: m.name + (m.reasoning ? " [推理]" : ""),
                        hint: `ctx:${m.contextLimit > 0 ? `${Math.round(m.contextLimit / 1000)}k` : "?"} · $${m.costInput}/$${m.costOutput}`,
                      }))}
                    />
                  </Field>

                  {/* Selected model info card */}
                  {selectedModelId && (() => {
                    const m = currentProviderModels.find((m) => m.id === selectedModelId);
                    if (!m) return null;
                    return (
                      <div className="p-3 rounded-lg bg-accent-cyan/[0.04] border border-accent-cyan/10 grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-text-muted">上下文窗口:</span> <span className="text-text-primary font-medium">{m.contextLimit > 0 ? m.contextLimit.toLocaleString() : "未知"}</span></div>
                        <div><span className="text-text-muted">最大输出:</span> <span className="text-text-primary font-medium">{m.outputLimit > 0 ? m.outputLimit.toLocaleString() : "未知"}</span></div>
                        <div><span className="text-text-muted">输入价格:</span> <span className="text-text-primary font-medium">${m.costInput}/M tokens</span></div>
                        <div><span className="text-text-muted">输出价格:</span> <span className="text-text-primary font-medium">${m.costOutput}/M tokens</span></div>
                        {m.reasoning && <div className="col-span-2"><span className="px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-300 text-[10px]">推理模型</span></div>}
                      </div>
                    );
                  })()}

                  <Field label="API Key">
                    <input
                      type="password"
                      value={llmApiKey}
                      onChange={(e) => setLlmApiKey(e.target.value)}
                      placeholder="sk-..."
                      className={inputCls}
                    />
                  </Field>

                  {/* Advanced: editable fields auto-filled from selection */}
                  <details className="group">
                    <summary className="text-xs text-text-muted cursor-pointer hover:text-text-secondary">
                      <i className="ri-settings-3-line mr-1" />高级选项（自动填充，通常无需修改）
                    </summary>
                    <div className="mt-3 space-y-3 pl-4 border-l border-white/[0.06]">
                      <Field label="API Base URL">
                        <input
                          value={llmApiBase}
                          onChange={(e) => setLlmApiBase(e.target.value)}
                          placeholder="自动从提供商获取"
                          className={inputCls}
                        />
                      </Field>
                      <Field label="模型 ID">
                        <input
                          value={llmModel}
                          onChange={(e) => setLlmModel(e.target.value)}
                          placeholder="自动从模型选择获取"
                          className={inputCls}
                        />
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="上下文窗口">
                          <input
                            type="number"
                            value={llmMaxTokens}
                            onChange={(e) => setLlmMaxTokens(e.target.value)}
                            className={inputCls}
                          />
                        </Field>
                        <Field label="最大输出">
                          <input
                            type="number"
                            value={llmMaxOutput}
                            onChange={(e) => setLlmMaxOutput(e.target.value)}
                            className={inputCls}
                          />
                        </Field>
                      </div>
                    </div>
                  </details>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={handleSaveLlm}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent-cyan text-bg-primary text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  <i className="ri-save-line" /> 保存配置
                </button>
                <button
                  onClick={handleTestLlm}
                  disabled={testing || !llmApiBase || !llmApiKey || !llmModel}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-accent-cyan/30 text-accent-cyan text-sm font-medium hover:bg-accent-cyan/10 transition-colors disabled:opacity-30"
                >
                  {testing ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-play-circle-line" />}
                  测试连接
                </button>
                {llmSaved && <span className="text-sm text-green-400">已保存到本地</span>}
              </div>

              {/* Test result */}
              {testResult && (
                <div className={`p-3 rounded-xl text-xs ${
                  testResult.ok
                    ? "bg-green-400/[0.06] border border-green-400/20 text-green-300"
                    : "bg-red-400/[0.06] border border-red-400/20 text-red-300"
                }`}>
                  <i className={testResult.ok ? "ri-check-line mr-1" : "ri-error-warning-line mr-1"} />
                  {testResult.msg}
                </div>
              )}

              <div className="p-3 rounded-xl bg-amber-400/[0.04] border border-amber-400/10">
                <p className="text-xs text-amber-300/70">
                  <i className="ri-information-line mr-1" />
                  LLM 配置保存在浏览器本地。模型信息来自 models.dev 开源数据库。
                </p>
              </div>
            </div>
          )}

          {/* ── Skills Tab ── */}
          {tab === "skills" && <SkillsManager />}

          {/* ── Account Tab ── */}
          {tab === "account" && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <h3 className="text-sm font-medium text-text-primary mb-3">账户信息</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-text-muted w-16">邮箱</span>
                    <span className="text-text-secondary">{user?.email || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-text-muted w-16">昵称</span>
                    <span className="text-text-secondary">{user?.name || "—"}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-red-400/[0.04] border border-red-400/10">
                <h3 className="text-sm font-medium text-red-400 mb-2">退出登录</h3>
                <p className="text-xs text-text-muted mb-3">退出当前账户，将返回登录页面。</p>
                <button
                  onClick={async () => { await logout(); navigate("/login"); }}
                  className="px-4 py-2 rounded-lg border border-red-400/20 text-red-400 text-sm font-medium hover:bg-red-400/10 transition-colors"
                >
                  退出登录
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Reusable form field wrapper */
function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-text-secondary">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
        {hint && <span className="text-text-muted font-normal ml-1.5">({hint})</span>}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

/** Skills management component */
function SkillsManager() {
  const [skills, setSkills] = useState(getAllSkills());
  const [showCreate, setShowCreate] = useState(false);
  const [newSkill, setNewSkill] = useState({
    id: "",
    nameZh: "",
    name: "",
    descriptionZh: "",
    description: "",
    icon: "ri-tools-line",
    systemPrompt: "",
    userPromptTemplate: "",
  });

  const handleToggle = (id: string, enabled: boolean) => {
    toggleSkill(id, enabled);
    setSkills(getAllSkills());
  };

  const handleDelete = (id: string) => {
    deleteCustomSkill(id);
    setSkills(getAllSkills());
  };

  const handleCreate = () => {
    if (!newSkill.id || !newSkill.nameZh || !newSkill.systemPrompt || !newSkill.userPromptTemplate) return;

    const skill: SkillDefinition = {
      id: newSkill.id,
      name: newSkill.name || newSkill.nameZh,
      nameZh: newSkill.nameZh,
      description: newSkill.description || newSkill.descriptionZh,
      descriptionZh: newSkill.descriptionZh,
      icon: newSkill.icon,
      category: "custom",
      systemPrompt: newSkill.systemPrompt,
      userPromptTemplate: newSkill.userPromptTemplate,
      inputs: [
        { key: "topic", label: "Topic", labelZh: "主题", type: "textarea", required: true, placeholder: "输入主题" },
        { key: "context", label: "Context", labelZh: "上下文", type: "textarea", required: false, placeholder: "补充信息（可选）" },
        { key: "language", label: "Language", labelZh: "语言", type: "select", required: true, defaultValue: "Chinese (中文)", options: [{ value: "Chinese (中文)", label: "中文" }, { value: "English", label: "English" }] },
      ],
      outputFormat: "markdown",
      estimatedCalls: 1,
      builtin: false,
      enabled: true,
    };

    saveCustomSkill(skill);
    setSkills(getAllSkills());
    setShowCreate(false);
    setNewSkill({ id: "", nameZh: "", name: "", descriptionZh: "", description: "", icon: "ri-tools-line", systemPrompt: "", userPromptTemplate: "" });
  };

  const inputCls = "w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.1] text-sm text-text-primary placeholder:text-text-muted focus:border-accent-cyan/40 focus:outline-none transition-colors";

  const grouped: Record<string, typeof skills> = {};
  for (const s of skills) {
    const cat = s.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(s);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">管理 AI Agent 技能：启用/禁用内置技能，创建自定义技能</p>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan text-xs font-medium hover:bg-accent-cyan/20 transition-colors"
        >
          <i className={showCreate ? "ri-close-line" : "ri-add-line"} />
          {showCreate ? "取消" : "创建自定义技能"}
        </button>
      </div>

      {/* Create Custom Skill Form */}
      {showCreate && (
        <div className="p-4 rounded-xl bg-white/[0.03] border border-accent-cyan/20 space-y-3">
          <h3 className="text-sm font-medium text-text-primary">创建自定义技能</h3>
          <div className="grid grid-cols-2 gap-3">
            <input value={newSkill.id} onChange={(e) => setNewSkill({ ...newSkill, id: e.target.value.replace(/\s/g, "-").toLowerCase() })} placeholder="skill-id (英文)" className={inputCls} />
            <input value={newSkill.nameZh} onChange={(e) => setNewSkill({ ...newSkill, nameZh: e.target.value })} placeholder="技能名称（中文）" className={inputCls} />
          </div>
          <input value={newSkill.descriptionZh} onChange={(e) => setNewSkill({ ...newSkill, descriptionZh: e.target.value })} placeholder="技能描述" className={inputCls} />
          <textarea value={newSkill.systemPrompt} onChange={(e) => setNewSkill({ ...newSkill, systemPrompt: e.target.value })} placeholder="System Prompt (系统提示词，可用 {language} 等变量)" rows={3} className={`${inputCls} resize-none font-mono text-xs`} />
          <textarea value={newSkill.userPromptTemplate} onChange={(e) => setNewSkill({ ...newSkill, userPromptTemplate: e.target.value })} placeholder="User Prompt Template (用户提示模板，可用 {topic} {context} {language} 变量)" rows={4} className={`${inputCls} resize-none font-mono text-xs`} />
          <button
            onClick={handleCreate}
            disabled={!newSkill.id || !newSkill.nameZh || !newSkill.systemPrompt || !newSkill.userPromptTemplate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-cyan text-bg-primary text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            <i className="ri-save-line" /> 保存技能
          </button>
        </div>
      )}

      {/* Skill List */}
      {Object.entries(grouped).map(([category, catSkills]) => {
        const catMeta = CATEGORY_LABELS[category] || { label: category, icon: "ri-apps-line" };
        return (
          <div key={category}>
            <h3 className="text-xs font-semibold text-text-secondary flex items-center gap-1.5 mb-3">
              <i className={`${catMeta.icon} text-accent-cyan`} />
              {catMeta.label}
            </h3>
            <div className="space-y-2">
              {catSkills.map((skill) => (
                <div key={skill.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-accent-cyan/10">
                      <i className={`${skill.icon} text-accent-cyan text-sm`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-primary">{skill.nameZh}</p>
                      <p className="text-[10px] text-text-muted">{skill.name} · ~{skill.estimatedCalls} 次调用</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!skill.builtin && (
                      <button
                        onClick={() => handleDelete(skill.id)}
                        className="p-1.5 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                      >
                        <i className="ri-delete-bin-line text-sm" />
                      </button>
                    )}
                    <button
                      onClick={() => handleToggle(skill.id, !skill.enabled)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        skill.enabled ? "bg-accent-cyan" : "bg-white/[0.12]"
                      }`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        skill.enabled ? "left-5.5 translate-x-0.5" : "left-0.5"
                      }`} style={{ left: skill.enabled ? "22px" : "2px" }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Searchable select — custom dropdown with search filter */
function SearchableSelect({ value, onChange, options, placeholder, disabled }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; hint?: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = options.find((o) => o.value === value);
  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()) || o.value.toLowerCase().includes(search.toLowerCase()))
    : options;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setOpen(!open);
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        }}
        className={`w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.1] text-sm text-left transition-colors flex items-center justify-between gap-2 ${
          disabled ? "opacity-40 cursor-not-allowed" : "hover:border-white/[0.2] cursor-pointer"
        } ${open ? "border-accent-cyan/40" : ""}`}
      >
        <span className={selected ? "text-text-primary" : "text-text-muted"}>
          {selected ? selected.label : placeholder || "选择..."}
        </span>
        <i className={`ri-arrow-down-s-line text-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg bg-[#131929] border border-white/[0.12] shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-white/[0.06]">
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索..."
              className="w-full px-2.5 py-1.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan/30"
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-text-muted text-center">无匹配结果</div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors ${
                    opt.value === value
                      ? "bg-accent-cyan/10 text-accent-cyan"
                      : "text-text-secondary hover:bg-white/[0.06]"
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(opt.value);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <span className="truncate">{opt.label}</span>
                  {opt.hint && <span className="text-[10px] text-text-muted flex-shrink-0">{opt.hint}</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Combo box — filterable dropdown + custom input */
function ComboBox({ value, onChange, options, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes((filter || value).toLowerCase())
  );

  return (
    <div ref={ref} className="relative">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setFilter(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.1] text-sm text-text-primary placeholder:text-text-muted focus:border-accent-cyan/40 focus:outline-none transition-colors"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg bg-[#131929] border border-white/[0.1] shadow-xl">
          {filtered.slice(0, 20).map((opt) => (
            <button
              key={opt}
              type="button"
              className={`w-full text-left px-3 py-2 text-sm hover:bg-white/[0.06] transition-colors ${
                opt === value ? "text-accent-cyan" : "text-text-secondary"
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(opt);
                setFilter("");
                setOpen(false);
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
