import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { mockResearchDirections } from "../../../mocks/papers";
import { useStreamingText, useStreamingCursor } from "../../../hooks/useStreamingText";
import { llmApi, isAuthenticated } from "../../../lib/api";

type TabType = "direction" | "paper" | "chat";

interface ChatMessage {
  role: "ai" | "user";
  content: string;
  isStreaming?: boolean;
}

// Slash command suggestions (khoj pattern)
const SLASH_COMMANDS = [
  { cmd: "/综述", desc: "生成文献综述报告" },
  { cmd: "/地图", desc: "构建论文关系图谱" },
  { cmd: "/方案", desc: "生成实验改进方案" },
  { cmd: "/学者", desc: "匹配跨学科合作者" },
];

// Streaming message bubble — uses shared useStreamingText hook (khoj pattern)
function StreamingBubble({ content, isStreaming }: { content: string; isStreaming: boolean }) {
  const { displayed, isDone } = useStreamingText(content, isStreaming);
  const showCursor = useStreamingCursor(isStreaming, isDone);
  const text = isStreaming ? displayed : content;

  return (
    <span>
      {text}
      {showCursor && (
        <span className="inline-block w-0.5 h-3.5 bg-[#00D4B8] ml-0.5 align-middle animate-pulse" />
      )}
    </span>
  );
}

// Suggestion chips with staggered entrance (gpt-researcher pattern)
function SuggestionChips({
  prompts,
  onSelect,
}: {
  prompts: string[];
  onSelect: (p: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-wrap justify-center gap-2 mt-3">
      {prompts.map((p, i) => (
        <button
          key={p}
          onClick={() => onSelect(p)}
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(12px)",
            transition: `opacity 0.4s ease ${0.1 + i * 0.08}s, transform 0.4s ease ${0.1 + i * 0.08}s`,
          }}
          className="text-xs px-3 py-1.5 rounded-full border border-white/[0.1] bg-white/[0.02] text-[#94A3B8] hover:border-[#00D4B8]/40 hover:text-[#00D4B8] hover:bg-[#00D4B8]/[0.06] transition-colors cursor-pointer whitespace-nowrap"
        >
          {p}
        </button>
      ))}
    </div>
  );
}

// AI Chat Tab (khoj ChatInputArea pattern)
function AIChatTab() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "ai", content: "你好！请告诉我你的研究方向或感兴趣的话题，我来帮你规划研究路径。" },
  ]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const quickPrompts = [
    "大模型在医疗影像中的应用",
    "基于 Transformer 的蛋白质结构预测",
    "联邦学习隐私保护最新进展",
  ];

  // Auto-resize textarea (khoj pattern)
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 96) + "px";

    if (input.startsWith("/") && !input.includes(" ")) {
      setShowCommands(true);
    } else {
      setShowCommands(false);
    }
  }, [input]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const [showLoginHint, setShowLoginHint] = useState(false);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isThinking) return;

    // Check auth before sending
    if (!isAuthenticated()) {
      setShowLoginHint(true);
      return;
    }

    const userMsg = input.trim();
    setInput("");
    setShowLoginHint(false);
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsThinking(true);

    try {
      const systemPrompt = "你是 StudyHub 的 AI 研究助手。用户会描述他们的研究方向或兴趣，你需要：1) 分析研究方向 2) 识别核心关键词 3) 建议研究路径。回复要简洁专业，用中文回答。如果用户使用了斜杠命令如 /综述、/地图、/方案、/学者，请针对性回答。";
      const prompt = `${systemPrompt}\n\n用户: ${userMsg}`;

      const res = await llmApi.completion({ prompt });
      setIsThinking(false);
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: res.content, isStreaming: true },
      ]);
    } catch (err: unknown) {
      setIsThinking(false);
      const errMessage = err instanceof Error ? err.message : "未知错误";
      const msg = errMessage === "请先登录"
        ? "请先登录后再使用 AI 对话功能。"
        : `AI 服务错误：${errMessage}`;
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: msg, isStreaming: false },
      ]);
    }
  }, [input, isThinking]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape") setShowCommands(false);
  };

  const applyCommand = (cmd: string) => {
    setInput(cmd + " ");
    setShowCommands(false);
    textareaRef.current?.focus();
  };

  // Apply suggestion chip: set input and focus
  const applySuggestion = (prompt: string) => {
    setInput(prompt);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  return (
    <div className="flex flex-col gap-2" style={{ height: "260px" }}>
      {/* Suggestion chips — shown only when no user messages yet */}
      {messages.length <= 1 && (
        <SuggestionChips prompts={quickPrompts} onSelect={applySuggestion} />
      )}

      {/* Message list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "ai" && (
              <div className="w-6 h-6 flex items-center justify-center rounded-full bg-[#00D4B8]/20 flex-shrink-0 mt-0.5">
                <i className="ri-robot-line text-xs text-[#00D4B8]" />
              </div>
            )}
            <div
              className={`max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-[#00D4B8]/20 text-[#F1F5F9]"
                  : "bg-white/[0.05] text-[#94A3B8]"
              }`}
            >
              {msg.isStreaming ? (
                <StreamingBubble content={msg.content} isStreaming />
              ) : msg.role === "ai" ? (
                <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-li:my-0.5 prose-headings:my-2">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : msg.content}
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex gap-2 justify-start">
            <div className="w-6 h-6 flex items-center justify-center rounded-full bg-[#00D4B8]/20 flex-shrink-0">
              <i className="ri-robot-line text-xs text-[#00D4B8]" />
            </div>
            <div className="px-3 py-2 rounded-xl bg-white/[0.05] flex items-center gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-[#00D4B8]/60"
                  style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Slash command panel (khoj pattern) */}
      {showCommands && (
        <div className="absolute bottom-20 left-0 right-0 z-20 mx-4 rounded-xl border border-white/[0.1] bg-[#0E1428] overflow-hidden">
          {SLASH_COMMANDS.filter(
            (c) => c.cmd.toLowerCase().includes(input.toLowerCase()) || input === "/"
          ).map((c) => (
            <button
              key={c.cmd}
              onClick={() => applyCommand(c.cmd)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.06] transition-colors cursor-pointer text-left"
            >
              <span className="text-xs font-mono font-bold text-[#00D4B8] w-16 flex-shrink-0">{c.cmd}</span>
              <span className="text-xs text-[#94A3B8]">{c.desc}</span>
            </button>
          ))}
        </div>
      )}

      {/* Login hint */}
      {showLoginHint && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20" style={{ animation: "fadeIn 0.2s ease-out" }}>
          <i className="ri-lock-line text-amber-400" />
          <span className="text-xs text-amber-300">AI 对话需要登录后才能使用</span>
          <Link to="/login" className="text-xs px-3 py-1 rounded-lg bg-accent-cyan text-bg-primary font-semibold hover:bg-accent-cyan-dim transition-all ml-auto">
            登录
          </Link>
          <Link to="/register" className="text-xs px-3 py-1 rounded-lg border border-white/[0.1] text-text-secondary hover:text-text-primary transition-all">
            注册
          </Link>
        </div>
      )}

      {/* Input row — khoj style auto-resize */}
      <div className="relative flex items-end gap-2 bg-[#080C1A]/60 border border-white/[0.08] rounded-xl px-3 py-2 focus-within:border-[#00D4B8]/40 transition-colors">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="描述研究兴趣，或输入 / 查看命令..."
          rows={1}
          className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-[#F1F5F9] placeholder-[#475569] font-sans leading-relaxed"
          style={{ minHeight: "24px", maxHeight: "96px" }}
          disabled={isThinking}
        />
        <div className="flex items-center gap-1 flex-shrink-0 pb-0.5">
          {messages.length > 2 && (
            <button
              onClick={() => navigate("/research/new")}
              className="text-[10px] px-2 py-1 rounded-md border border-[#00D4B8]/30 text-[#00D4B8] hover:bg-[#00D4B8]/10 transition-all cursor-pointer whitespace-nowrap"
            >
              开始研究
            </button>
          )}
          <button
            onClick={handleSend}
            disabled={!input.trim() || isThinking}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#00D4B8] text-[#080C1A] hover:bg-[#00A896] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex-shrink-0"
          >
            <i className="ri-arrow-up-line text-sm font-bold" />
          </button>
        </div>
      </div>

      <p className="text-[10px] text-[#475569] text-center">Enter 发送 · Shift+Enter 换行 · 输入 / 查看命令</p>
    </div>
  );
}

export default function HeroSection() {
  const [activeTab, setActiveTab] = useState<TabType>("direction");
  const [paperInput, setPaperInput] = useState("");
  const [selectedDirection, setSelectedDirection] = useState<string | null>(null);
  const [showBottomGlow, setShowBottomGlow] = useState(true);
  const navigate = useNavigate();

  // gpt-researcher: show/hide bottom glow on scroll
  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const cur = window.scrollY;
      setShowBottomGlow(cur <= 60 || cur < lastY);
      lastY = cur;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const tabs: { key: TabType; icon: string; label: string }[] = [
    { key: "direction", icon: "ri-compass-3-line", label: "选择研究方向" },
    { key: "paper", icon: "ri-file-text-line", label: "输入论文" },
    { key: "chat", icon: "ri-chat-ai-line", label: "AI 对话" },
  ];

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-20 pb-16">
      {/* Background */}
      <div className="absolute inset-0 bg-hero-gradient" />
      <div className="absolute inset-0 grid-bg opacity-50" />

      {/* Glow orbs */}
      <div className="absolute top-20 right-20 w-96 h-96 bg-[#00D4B8]/[0.04] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 left-20 w-80 h-80 bg-[#00D4B8]/[0.03] rounded-full blur-3xl pointer-events-none" />

      {/* Animated particles */}
      <div className="absolute top-32 left-1/4 w-2 h-2 rounded-full bg-[#00D4B8]/60 animate-[particle1_8s_ease-in-out_infinite] pointer-events-none" />
      <div className="absolute top-48 right-1/3 w-1.5 h-1.5 rounded-full bg-[#00D4B8]/40 animate-[particle2_10s_ease-in-out_infinite] pointer-events-none" />
      <div className="absolute bottom-48 left-1/3 w-2.5 h-2.5 rounded-full bg-amber-400/30 animate-[particle3_12s_ease-in-out_infinite] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-1 h-1 rounded-full bg-[#00D4B8]/70 animate-[particle1_6s_ease-in-out_infinite_reverse] pointer-events-none" />

      <div className="relative z-10 w-full max-w-5xl mx-auto px-6 text-center">
        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00D4B8]/30 bg-[#00D4B8]/[0.08] mb-8"
          style={{ animation: "fadeIn 0.6s ease-out" }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#00D4B8] animate-pulse" />
          <span className="text-xs font-medium text-[#00D4B8]">AI 驱动 · 全球文献 · 自动实验</span>
        </div>

        {/* Title */}
        <h1
          className="text-5xl md:text-6xl lg:text-7xl font-bold text-[#F1F5F9] mb-6 leading-tight"
          style={{ animation: "slideUp 0.5s ease-out 0.1s both" }}
        >
          从论文到实验，
          <br />
          <span className="text-gradient-cyan">AI 全程加速</span>你的研究
        </h1>

        {/* Subtitle */}
        <p
          className="text-lg md:text-xl text-[#94A3B8] mb-12 max-w-2xl mx-auto leading-relaxed"
          style={{ animation: "slideUp 0.5s ease-out 0.2s both" }}
        >
          输入研究方向，自动检索全球文献、发现研究空白、
          <br className="hidden sm:block" />
          生成并执行实验方案，匹配跨学科合作者
        </p>

        {/* Tab switcher */}
        <div
          className="bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-1 mb-3 inline-flex gap-1"
          style={{ animation: "slideUp 0.5s ease-out 0.3s both" }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                if (tab.key === "chat") {
                  navigate("/research/new");
                  return;
                }
                setActiveTab(tab.key);
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer whitespace-nowrap ${
                activeTab === tab.key
                  ? "bg-[#00D4B8] text-[#080C1A]"
                  : "text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/[0.05]"
              }`}
            >
              <span className="w-4 h-4 flex items-center justify-center">
                <i className={tab.icon} />
              </span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div
          className="bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6 w-full max-w-3xl mx-auto relative"
          style={{ minHeight: "300px", animation: "fadeIn 0.4s ease-out 0.35s both" }}
        >
          {activeTab === "direction" && (
            <div>
              <p className="text-sm text-[#94A3B8] mb-4 text-left">选择预置研究方向，系统自动关联种子论文并开始检索</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {mockResearchDirections.map((dir, i) => (
                  <button
                    key={dir.id}
                    onClick={() => setSelectedDirection(dir.id)}
                    style={{
                      opacity: 1,
                      animation: `fadeIn 0.3s ease-out ${i * 0.04}s both`,
                    }}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                      selectedDirection === dir.id
                        ? "border-[#00D4B8] bg-[#00D4B8]/10 text-[#00D4B8]"
                        : "border-white/[0.08] bg-white/[0.02] text-[#94A3B8] hover:border-[#00D4B8]/40 hover:bg-[#00D4B8]/[0.05] hover:text-[#F1F5F9]"
                    }`}
                  >
                    <span className="w-5 h-5 flex items-center justify-center">
                      <i className={`${dir.icon} text-base`} />
                    </span>
                    <span className="text-xs font-medium leading-tight text-center">{dir.label}</span>
                  </button>
                ))}
              </div>
              {selectedDirection && (
                <div
                  className="mt-4 flex items-center justify-between p-3 rounded-xl bg-[#00D4B8]/[0.06] border border-[#00D4B8]/20"
                  style={{ animation: "slideUp 0.25s ease-out" }}
                >
                  <span className="text-xs text-[#00D4B8]">
                    已选：{mockResearchDirections.find((d) => d.id === selectedDirection)?.label}
                  </span>
                  <button
                    onClick={() => {
                      const dir = mockResearchDirections.find((d) => d.id === selectedDirection);
                      navigate(`/research/new?direction=${encodeURIComponent(dir?.en || dir?.label || "")}`);
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-[#00D4B8] text-[#080C1A] font-semibold hover:bg-[#00A896] transition-all cursor-pointer whitespace-nowrap"
                  >
                    开始深度研究 →
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === "paper" && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-[#94A3B8] text-left">粘贴论文标题、DOI 或 URL，系统以此为种子自动扩展检索</p>
              <textarea
                className="w-full h-36 bg-[#080C1A]/60 border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-[#F1F5F9] placeholder-[#475569] resize-none focus:outline-none focus:border-[#00D4B8]/50 transition-colors font-sans"
                placeholder={"例如：\n标题：Attention Is All You Need\nDOI：10.48550/arXiv.1706.03762\nURL：https://arxiv.org/abs/1706.03762"}
                value={paperInput}
                onChange={(e) => setPaperInput(e.target.value)}
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#475569]">支持来源：</span>
                  {["arXiv", "DOI", "PubMed", "URL"].map((s) => (
                    <span key={s} className="text-xs px-2 py-0.5 rounded-md bg-white/[0.05] text-[#94A3B8] border border-white/[0.06]">
                      {s}
                    </span>
                  ))}
                </div>
                {paperInput.trim() && (
                  <button
                    onClick={() => navigate(`/research/new?paper=${encodeURIComponent(paperInput.trim())}`)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-[#00D4B8] text-[#080C1A] font-semibold hover:bg-[#00A896] transition-all cursor-pointer whitespace-nowrap"
                    style={{ animation: "fadeIn 0.2s ease-out" }}
                  >
                    以此为种子检索 →
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === "chat" && <AIChatTab />}
        </div>

        {/* CTA */}
        <div className="mt-8" style={{ animation: "slideUp 0.5s ease-out 0.5s both" }}>
          <button
            onClick={() => navigate("/research/new")}
            className="inline-flex items-center gap-3 px-10 py-4 rounded-full text-base font-semibold bg-[#00D4B8] text-[#080C1A] hover:bg-[#00A896] transition-all duration-200 cursor-pointer whitespace-nowrap"
            style={{ boxShadow: "0 0 24px rgba(0,212,184,0.3)" }}
          >
            <span className="w-5 h-5 flex items-center justify-center">
              <i className="ri-rocket-line text-base" />
            </span>
            开始研究
            <span className="w-5 h-5 flex items-center justify-center">
              <i className="ri-arrow-right-line text-base" />
            </span>
          </button>
          <p className="text-[#475569] text-xs mt-3">免费使用 · 无需信用卡 · 数据实时更新</p>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap justify-center gap-8 mt-16" style={{ animation: "fadeIn 0.6s ease-out 0.6s both" }}>
          {[
            { value: "2.3亿+", label: "全球收录论文" },
            { value: "47", label: "接入数据源" },
            { value: "12万+", label: "活跃研究者" },
            { value: "98.6%", label: "研究空白准确率" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl font-bold text-gradient-cyan">{stat.value}</div>
              <div className="text-xs text-[#475569] mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom glow bar (gpt-researcher signature effect) ── */}
      <div
        className="fixed bottom-0 left-0 right-0 h-3 z-50 pointer-events-none overflow-hidden transition-opacity duration-1000"
        style={{ opacity: showBottomGlow ? 1 : 0 }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(0,212,184,1) 0%, rgba(0,212,184,0.6) 25%, rgba(0,212,184,0.15) 55%, transparent 75%)",
            boxShadow: "0 0 28px 6px rgba(0,212,184,0.5), 0 0 56px 10px rgba(0,212,184,0.2)",
          }}
        />
        {/* Shimmer overlay */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.15) 35%, transparent 60%)",
            animation: "shimmer 6s ease-in-out infinite alternate",
          }}
        />
      </div>
    </section>
  );
}
