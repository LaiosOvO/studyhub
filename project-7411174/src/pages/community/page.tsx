import { useState, useRef, useEffect, useCallback } from "react";
import Navbar from "../../components/feature/Navbar";
import Footer from "../../components/feature/Footer";
import { communityApi, type MatchResult, type ResearchNeed as ApiResearchNeed } from "../../lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/base/Dialog";
import { Button } from "../../components/base/Button";
import { Badge } from "../../components/base/Badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/base/Tooltip";
import { useToast } from "../../components/base/Toast";

// ── Local UI types (preserved from original mock shapes for rendering) ──────
interface Scholar {
  id: string;
  name: string;
  avatar: string;
  institution: string;
  title: string;
  hIndex: number;
  totalCitations: number;
  paperCount: number;
  researchAreas: string[];
  matchScore?: number;
  matchReason?: string;
  complementarity: { label: string; score: number }[];
  recentPapers: { title: string; year: number; citations: number }[];
}

interface ResearchNeed {
  id: string;
  title: string;
  description: string;
  skills: string[];
  researchArea: string;
  authorId: string;
  authorName: string;
  authorInstitution: string;
  matchScore: number;
  createdAt: string;
}

interface Conversation {
  id: string;
  participantId: string;
  participantName: string;
  participantAvatar: string;
  participantInstitution: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  messages: LocalMessage[];
}

interface LocalMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
  read: boolean;
}

// ── API → UI mappers ────────────────────────────────────────────────────────

function mapMatchToScholar(m: MatchResult): Scholar {
  return {
    id: m.profile_id,
    name: m.name ?? "未知学者",
    avatar: "",
    institution: m.institution ?? "",
    title: "",
    hIndex: 0,
    totalCitations: 0,
    paperCount: 0,
    researchAreas: m.research_directions ?? [],
    matchScore: Math.round(m.score * 100),
    matchReason: "",
    complementarity: [],
    recentPapers: [],
  };
}

function mapApiNeed(n: ApiResearchNeed): ResearchNeed {
  return {
    id: n.id,
    title: n.title,
    description: n.description ?? "",
    skills: n.skills ?? [],
    researchArea: n.direction ?? "",
    authorId: "",
    authorName: "",
    authorInstitution: "",
    matchScore: 0,
    createdAt: n.created_at,
  };
}

function mapApiConversation(c: Record<string, unknown>): Conversation {
  return {
    id: String(c.id ?? ""),
    participantId: String(c.participant_id ?? c.participantId ?? ""),
    participantName: String(c.participant_name ?? c.participantName ?? ""),
    participantAvatar: String(c.participant_avatar ?? c.participantAvatar ?? ""),
    participantInstitution: String(c.participant_institution ?? c.participantInstitution ?? ""),
    lastMessage: String(c.last_message ?? c.lastMessage ?? ""),
    lastMessageTime: String(c.last_message_time ?? c.lastMessageTime ?? ""),
    unreadCount: Number(c.unread_count ?? c.unreadCount ?? 0),
    messages: Array.isArray(c.messages)
      ? (c.messages as Record<string, unknown>[]).map((msg) => ({
          id: String(msg.id ?? ""),
          senderId: String(msg.sender_id ?? msg.senderId ?? ""),
          senderName: String(msg.sender_name ?? msg.senderName ?? ""),
          content: String(msg.content ?? ""),
          timestamp: String(msg.created_at ?? msg.timestamp ?? ""),
          read: Boolean(msg.read ?? false),
        }))
      : [],
  };
}

// ── Generic data-fetching hook ──────────────────────────────────────────────

type FetchState<T> = { data: T | null; loading: boolean; error: string | null };

function useApiData<T>(fetcher: () => Promise<T>): FetchState<T> & { refetch: () => void } {
  const [state, setState] = useState<FetchState<T>>({ data: null, loading: true, error: null });

  const load = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    fetcher()
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "加载失败";
        setState({ data: null, loading: false, error: message });
      });
  }, [fetcher]);

  useEffect(() => { load(); }, [load]);

  return { ...state, refetch: load };
}

// ── Loading / Error shared components ───────────────────────────────────────

function LoadingSpinner({ label = "加载中..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-20 text-[#475569]">
      <i className="ri-loader-4-line animate-spin text-xl mr-2" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <i className="ri-error-warning-line text-3xl text-red-400 mb-3" />
      <p className="text-sm text-[#94A3B8] mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 text-xs font-medium text-[#00D4B8] border border-[#00D4B8]/30 rounded-lg hover:bg-[#00D4B8]/10 transition-colors cursor-pointer"
        >
          重试
        </button>
      )}
    </div>
  );
}

type Tab = "matching" | "needs" | "messages";

// ── SVG Radar Chart (互补性雷达图) ──────────────────────────────────────────
interface RadarChartProps {
  dimensions: { label: string; score: number }[];
  size?: number;
}

function RadarChart({ dimensions, size = 160 }: RadarChartProps) {
  const n = dimensions.length;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.36;
  const grids = [0.25, 0.5, 0.75, 1.0];

  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i: number, r: number) => ({
    x: cx + r * Math.cos(angle(i)),
    y: cy + r * Math.sin(angle(i)),
  });

  const gridPoly = (frac: number) =>
    dimensions.map((_, i) => pt(i, maxR * frac)).map((p) => `${p.x},${p.y}`).join(" ");

  const dataPoints = dimensions.map((d, i) => pt(i, (d.score / 100) * maxR));
  const dataPoly = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
      {/* Grid polygons */}
      {grids.map((frac, gi) => (
        <polygon
          key={gi}
          points={gridPoly(frac)}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="0.8"
        />
      ))}
      {/* Axis lines */}
      {dimensions.map((_, i) => {
        const tip = pt(i, maxR);
        return <line key={i} x1={cx} y1={cy} x2={tip.x} y2={tip.y} stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />;
      })}
      {/* Data polygon — filled + glow */}
      <defs>
        <filter id="radar-glow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <polygon
        points={dataPoly}
        fill="rgba(0,212,184,0.15)"
        stroke="#00D4B8"
        strokeWidth="1.5"
        filter="url(#radar-glow)"
        style={{ transition: "all 0.6s ease" }}
      />
      {/* Data dots */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#00D4B8" opacity={0.9} />
      ))}
      {/* Axis labels */}
      {dimensions.map((d, i) => {
        const tip = pt(i, maxR + 14);
        const textAnchor = tip.x < cx - 4 ? "end" : tip.x > cx + 4 ? "start" : "middle";
        return (
          <text
            key={i}
            x={tip.x}
            y={tip.y + 4}
            textAnchor={textAnchor}
            fontSize={9.5}
            fill="#94A3B8"
            fontFamily="system-ui, sans-serif"
          >
            {d.label}
          </text>
        );
      })}
      {/* Score labels on data points */}
      {dataPoints.map((p, i) => (
        <text
          key={`score-${i}`}
          x={p.x}
          y={p.y - 5}
          textAnchor="middle"
          fontSize={8}
          fill="#00D4B8"
          fontFamily="monospace"
          opacity={0.85}
        >
          {dimensions[i].score}
        </text>
      ))}
    </svg>
  );
}

// ── Circular Match Score Arc ────────────────────────────────────────────────
function MatchScoreArc({ score }: { score: number }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color = score >= 90 ? "#00D4B8" : score >= 80 ? "#10B981" : "#F59E0B";

  return (
    <div className="relative flex items-center justify-center" style={{ width: 68, height: 68 }}>
      <svg width={68} height={68} viewBox="0 0 68 68" style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
        {/* Background track */}
        <circle cx={34} cy={34} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={5} />
        {/* Progress arc */}
        <circle
          cx={34} cy={34} r={r}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circ - filled}`}
          style={{ filter: `drop-shadow(0 0 4px ${color}80)`, transition: "stroke-dasharray 0.8s ease" }}
        />
      </svg>
      <div className="text-center z-10">
        <div className="text-base font-bold font-mono" style={{ color, lineHeight: 1 }}>{score}</div>
        <div className="text-[8px] text-[#475569]">匹配</div>
      </div>
    </div>
  );
}

function MatchingTab() {
  const [selected, setSelected] = useState<Scholar | null>(null);
  const { toast } = useToast();

  const fetchRecommendations = useCallback(
    () => communityApi.getRecommendations().then((results) => results.map(mapMatchToScholar)),
    []
  );
  const { data: scholars, loading, error, refetch } = useApiData(fetchRecommendations);

  if (loading) return <LoadingSpinner label="加载推荐学者..." />;
  if (error) return <ErrorBanner message={error} onRetry={refetch} />;
  if (!scholars || scholars.length === 0) {
    return <div className="text-center py-16 text-[#475569] text-sm">暂无推荐学者</div>;
  }

  return (
    <div className="flex gap-6">
      <div className="flex-1 space-y-4">
        {scholars.map((scholar) => (
          <div
            key={scholar.id}
            onClick={() => setSelected(scholar === selected ? null : scholar)}
            className={`bg-[#0E1428] rounded-xl p-5 border transition-all cursor-pointer ${selected?.id === scholar.id ? "border-[#00D4B8]/30 bg-[#00D4B8]/[0.03]" : "border-white/[0.06] hover:border-white/[0.12]"}`}
          >
            <div className="flex items-start gap-4">
              <div className="relative flex-shrink-0">
                <img src={scholar.avatar} alt={scholar.name} className="w-14 h-14 rounded-full object-cover object-top bg-[#1A2238]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[#F1F5F9]">{scholar.name}</h3>
                    <p className="text-xs text-[#475569] mt-0.5">{scholar.title} · {scholar.institution}</p>
                  </div>
                  {/* Circular match score arc */}
                  <div className="flex-shrink-0">
                    <MatchScoreArc score={scholar.matchScore!} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2 mb-3">
                  {scholar.researchAreas.slice(0, 4).map((area) => (
                    <Badge key={area} variant="default" className="text-[10px]">{area}</Badge>
                  ))}
                </div>
                <p className="text-xs text-[#94A3B8] leading-relaxed border-l-2 border-[#00D4B8]/40 pl-3">
                  <strong className="text-[#00D4B8]">AI 分析：</strong>{scholar.matchReason}
                </p>
              </div>
            </div>

            {selected?.id === scholar.id && (
              <div className="mt-5 pt-5 border-t border-white/[0.06] animate-in fade-in-0 slide-in-from-top-2 duration-200">
                <div className="flex gap-6 items-start">
                  {/* Radar Chart */}
                  <div className="flex flex-col items-center gap-2 flex-shrink-0">
                    <p className="text-[10px] font-medium text-[#475569] uppercase tracking-wider">互补性雷达图</p>
                    <RadarChart dimensions={scholar.complementarity} size={170} />
                  </div>

                  {/* Right column: dimension list + papers */}
                  <div className="flex-1 space-y-4">
                    {/* Dimension bars (secondary reference) */}
                    <div>
                      <h4 className="text-xs font-medium text-[#94A3B8] mb-3">维度得分</h4>
                      <div className="space-y-2">
                        {scholar.complementarity.map((dim) => (
                          <div key={dim.label}>
                            <div className="flex justify-between text-[10px] mb-1">
                              <span className="text-[#475569]">{dim.label}</span>
                              <span className="text-[#00D4B8] font-mono font-semibold">{dim.score}</span>
                            </div>
                            <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-[#00D4B8] to-[#00A896] transition-all duration-700" style={{ width: `${dim.score}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recent Papers */}
                    <div>
                      <h4 className="text-xs font-medium text-[#94A3B8] mb-2">近期论文</h4>
                      <div className="space-y-2">
                        {scholar.recentPapers.map((p) => (
                          <div key={p.title} className="flex items-start gap-2">
                            <i className="ri-article-line text-xs text-[#475569] flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-[#94A3B8] line-clamp-1">{p.title}</p>
                              <p className="text-[10px] text-[#475569] mt-0.5">{p.year} · {p.citations.toLocaleString()} 引用</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          toast({ title: "消息已发送", description: `已向 ${scholar.name} 发送合作邀请`, variant: "success" });
                        }}
                      >
                        <i className="ri-message-3-line" /> 发消息
                      </Button>
                      <Button variant="secondary" size="sm" onClick={(e) => e.stopPropagation()}>
                        <i className="ri-user-add-line" /> 关注
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {/* Summary sidebar */}
      <div className="w-64 flex-shrink-0 space-y-4">
        <div className="bg-[#0E1428] rounded-xl p-5 border border-white/[0.06]">
          <h3 className="text-sm font-semibold text-[#F1F5F9] mb-4">推荐统计</h3>
          <div className="space-y-3">
            {[
              { label: "高度匹配（90+）", value: `${scholars.filter((s) => (s.matchScore ?? 0) >= 90).length} 人`, color: "text-[#00D4B8]" },
              { label: "良好匹配（80-90）", value: `${scholars.filter((s) => (s.matchScore ?? 0) >= 80 && (s.matchScore ?? 0) < 90).length} 人`, color: "text-green-400" },
              { label: "一般匹配（70-80）", value: `${scholars.filter((s) => (s.matchScore ?? 0) >= 70 && (s.matchScore ?? 0) < 80).length} 人`, color: "text-amber-400" },
            ].map((item) => (
              <div key={item.label} className="flex justify-between items-center">
                <span className="text-xs text-[#475569]">{item.label}</span>
                <span className={`text-xs font-semibold ${item.color}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-[#0E1428] rounded-xl p-5 border border-white/[0.06]">
          <h3 className="text-sm font-semibold text-[#F1F5F9] mb-3">匹配基于</h3>
          <div className="space-y-2">
            {["研究向量相似度", "技能互补性分析", "共引论文分析", "机构跨学科度"].map((item) => (
              <div key={item} className="flex items-center gap-2 text-xs text-[#475569]">
                <i className="ri-check-line text-[#00D4B8]" />{item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function NeedsTab() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", skills: "", area: "" });
  const { toast } = useToast();

  const fetchNeeds = useCallback(
    () => communityApi.listNeeds().then((results) => results.map(mapApiNeed)),
    []
  );
  const { data: needs, loading, error, refetch } = useApiData(fetchNeeds);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const skillsList = form.skills.split(",").map((s) => s.trim()).filter(Boolean);
    communityApi.createNeed({
      title: form.title,
      description: form.description,
      direction: form.area,
      skills: skillsList,
    })
      .then(() => {
        setDialogOpen(false);
        setForm({ title: "", description: "", skills: "", area: "" });
        toast({ title: "发布成功", description: "你的研究需求已发布，等待合作者联系", variant: "success" });
        refetch();
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "发布失败";
        toast({ title: "发布失败", description: message, variant: "destructive" });
      });
  };

  if (loading) return <LoadingSpinner label="加载研究需求..." />;
  if (error) return <ErrorBanner message={error} onRetry={refetch} />;

  const needsList = needs ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-[#475569]">共 {needsList.length} 条研究需求</p>
        <Button variant="primary" size="sm" onClick={() => setDialogOpen(true)}>
          <i className="ri-add-line" /> 发布需求
        </Button>
      </div>

      <div className="space-y-4">
        {needsList.map((need) => (
          <div key={need.id} className="bg-[#0E1428] rounded-xl p-5 border border-white/[0.06] hover:border-white/[0.12] transition-all">
            <div className="flex items-start justify-between gap-4 mb-3">
              <h3 className="text-sm font-semibold text-[#F1F5F9]">{need.title}</h3>
              <div className="flex-shrink-0 text-right">
                <div className="text-base font-bold text-[#00D4B8] font-mono">{need.matchScore}</div>
                <div className="text-[10px] text-[#475569]">契合度</div>
              </div>
            </div>
            <p className="text-sm text-[#94A3B8] leading-relaxed mb-3 line-clamp-2">{need.description}</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {need.skills.map((s) => (
                <Badge key={s} variant="cyan" className="text-[10px]">{s}</Badge>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#00D4B8]/20 flex items-center justify-center text-xs font-bold text-[#00D4B8]">{need.authorName?.[0] ?? "?"}</div>
                <div>
                  <p className="text-xs font-medium text-[#F1F5F9]">{need.authorName}</p>
                  <p className="text-[10px] text-[#475569]">{need.authorInstitution}</p>
                </div>
              </div>
              <Button variant="secondary" size="xs">
                <i className="ri-message-3-line" /> 联系 TA
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Radix Dialog — 发布需求 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>发布研究需求</DialogTitle>
            <DialogDescription>告诉潜在合作者你在寻找什么样的协作</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              {[
                { label: "标题 *", key: "title" as const, placeholder: "简洁描述合作需求..." },
                { label: "研究方向", key: "area" as const, placeholder: "如：自然语言处理" },
                { label: "所需技能（逗号分隔）", key: "skills" as const, placeholder: "如：图神经网络, PyTorch" },
              ].map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">{field.label}</label>
                  <input
                    type="text"
                    value={form[field.key]}
                    onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:border-[#00D4B8]/50 transition-colors"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">详细描述</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="详细描述研究背景、合作方式、预期成果..."
                  rows={3}
                  maxLength={500}
                  className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:border-[#00D4B8]/50 transition-colors resize-none"
                />
                <p className="text-[10px] text-[#475569] mt-1">{form.description.length}/500</p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" size="sm" onClick={() => setDialogOpen(false)}>取消</Button>
              <Button type="submit" variant="primary" size="sm" disabled={!form.title.trim()}>发布需求</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MessagesTab() {
  const fetchConversations = useCallback(
    () => communityApi.listConversations().then((results) => results.map(mapApiConversation)),
    []
  );
  const { data: conversations, loading, error, refetch } = useApiData(fetchConversations);

  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Auto-select first conversation when data loads
  useEffect(() => {
    if (conversations && conversations.length > 0 && !activeConv) {
      setActiveConv(conversations[0]);
      setMessages(conversations[0].messages);
    }
  }, [conversations, activeConv]);

  if (loading) return <LoadingSpinner label="加载消息..." />;
  if (error) return <ErrorBanner message={error} onRetry={refetch} />;
  if (!conversations || conversations.length === 0) {
    return <div className="text-center py-16 text-[#475569] text-sm">暂无对话</div>;
  }
  if (!activeConv) return <LoadingSpinner />;

  // khoj-style relative timestamp
  function renderTimestamp(isoTimestamp: string): string {
    const msgTime = new Date(isoTimestamp);
    const now = new Date();
    const diff = now.getTime() - msgTime.getTime();
    if (diff < 60_000) return "刚刚";
    if (diff < 3_600_000) return `${Math.round(diff / 60_000)}分钟前`;
    if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}小时前`;
    if (diff < 7 * 86_400_000) return `${Math.round(diff / 86_400_000)}天前`;
    return msgTime.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
  }

  function formatAbsoluteTime(isoTimestamp: string): string {
    return new Date(isoTimestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }

  const handleSend = async () => {
    if (!input.trim() || !activeConv) return;
    const content = input.trim();
    const optimisticMsg: LocalMessage = {
      id: `m-${Date.now()}`,
      senderId: "me",
      senderName: "我",
      content,
      timestamp: new Date().toISOString(),
      read: false,
    };
    // Optimistic update
    setMessages((prev) => [...prev, optimisticMsg]);
    setInput("");
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      await communityApi.sendMessage({
        receiver_id: activeConv.participantId,
        content,
      });
    } catch (err: unknown) {
      // Rollback optimistic update on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      const message = err instanceof Error ? err.message : "发送失败";
      toast({ title: "发送失败", description: message, variant: "destructive" });
    }
  };

  const handleCopyMsg = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 2000);
    toast({ title: "已复制", variant: "success" });
  };

  const handleConvChange = (conv: Conversation) => {
    setActiveConv(conv);
    setMessages(conv.messages);
    setHoveredMsgId(null);
  };

  // Group consecutive messages from the same sender
  const groupedMessages = messages.reduce<Array<typeof messages>>(
    (groups, msg) => {
      const last = groups[groups.length - 1];
      if (last && last[0].senderId === msg.senderId) {
        last.push(msg);
      } else {
        groups.push([msg]);
      }
      return groups;
    },
    []
  );

  return (
    <div className="flex gap-0 bg-[#0E1428] rounded-xl border border-white/[0.06] overflow-hidden" style={{ height: "640px" }}>
      {/* ── Conversation List ─── */}
      <div className="w-72 flex-shrink-0 border-r border-white/[0.06] flex flex-col">
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#F1F5F9]">消息</h3>
            <button className="w-6 h-6 flex items-center justify-center rounded text-[#475569] hover:text-[#00D4B8] cursor-pointer">
              <i className="ri-edit-line text-xs" />
            </button>
          </div>
          <div className="relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#475569]" />
            <input type="text" placeholder="搜索对话..." className="w-full pl-8 pr-3 py-2 bg-white/[0.04] border border-white/[0.06] rounded-lg text-xs text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:border-[#00D4B8]/40 transition-colors" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((conv) => {
            const isActive = activeConv.id === conv.id;
            return (
              <button
                key={conv.id}
                onClick={() => handleConvChange(conv)}
                className={`w-full text-left px-4 py-3.5 border-b border-white/[0.04] transition-all hover:bg-white/[0.04] cursor-pointer ${isActive ? "bg-[#00D4B8]/[0.06] border-l-2 border-l-[#00D4B8]/50" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <div className="relative flex-shrink-0">
                    <img src={conv.participantAvatar} alt={conv.participantName} className="w-10 h-10 rounded-full object-cover object-top bg-[#1A2238]" />
                    {conv.unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center">{conv.unreadCount}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-xs font-semibold ${isActive ? "text-[#00D4B8]" : "text-[#F1F5F9]"}`}>{conv.participantName}</span>
                      {/* khoj-style relative time */}
                      <span className="text-[10px] text-[#475569]">{renderTimestamp(conv.lastMessageTime)}</span>
                    </div>
                    <p className={`text-[11px] truncate ${conv.unreadCount > 0 ? "text-[#94A3B8] font-medium" : "text-[#475569]"}`}>{conv.lastMessage}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Chat Area ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between bg-[#080C1A]/30">
          <div className="flex items-center gap-3">
            <img src={activeConv.participantAvatar} alt={activeConv.participantName} className="w-8 h-8 rounded-full object-cover object-top" />
            <div>
              <p className="text-sm font-semibold text-[#F1F5F9]">{activeConv.participantName}</p>
              <p className="text-[10px] text-[#475569] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                {activeConv.participantInstitution}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm"><i className="ri-phone-line text-sm" /></Button>
              </TooltipTrigger>
              <TooltipContent>语音通话</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm"><i className="ri-vidicon-line text-sm" /></Button>
              </TooltipTrigger>
              <TooltipContent>视频通话</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm"><i className="ri-more-line text-sm" /></Button>
              </TooltipTrigger>
              <TooltipContent>更多选项</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Messages — khoj-style bubble rendering */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {groupedMessages.map((group, gi) => {
            const isMe = group[0].senderId === "me";
            return (
              <div key={gi} className={`flex gap-2.5 ${isMe ? "justify-end" : "justify-start"}`}>
                {/* Avatar for other party — only on first bubble in group */}
                {!isMe && (
                  <div className="flex-shrink-0 mt-1">
                    <img
                      src={activeConv.participantAvatar}
                      alt={activeConv.participantName}
                      className="w-7 h-7 rounded-full object-cover object-top"
                    />
                  </div>
                )}

                <div className={`flex flex-col gap-1 max-w-[72%] ${isMe ? "items-end" : "items-start"}`}>
                  {/* Sender name (only for others, only on first in group) */}
                  {!isMe && (
                    <span className="text-[10px] font-medium text-[#475569] ml-1">{group[0].senderName}</span>
                  )}

                  {group.map((msg, mi) => {
                    const isLast = mi === group.length - 1;
                    const isHovered = hoveredMsgId === msg.id;
                    return (
                      <div
                        key={msg.id}
                        className="relative group/msg"
                        onMouseEnter={() => setHoveredMsgId(msg.id)}
                        onMouseLeave={() => setHoveredMsgId(null)}
                      >
                        {/* Bubble */}
                        <div
                          className={`px-4 py-2.5 text-sm leading-relaxed transition-all ${
                            isMe
                              ? "bg-[#00D4B8]/20 text-[#F1F5F9] border border-[#00D4B8]/20 rounded-2xl rounded-tr-sm"
                              : "bg-white/[0.06] text-[#94A3B8] border border-white/[0.06] rounded-2xl rounded-tl-sm"
                          } ${isHovered ? (isMe ? "border-[#00D4B8]/40" : "border-white/[0.12]") : ""}`}
                        >
                          {msg.content}
                        </div>

                        {/* Hover actions (copy) — khoj pattern */}
                        {isHovered && (
                          <div className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-1 ${isMe ? "right-full mr-2" : "left-full ml-2"}`}>
                            <button
                              onClick={() => handleCopyMsg(msg.id, msg.content)}
                              className="w-6 h-6 flex items-center justify-center text-[#475569] hover:text-[#00D4B8] hover:border-[#00D4B8]/30 transition-all cursor-pointer"
                              title="复制"
                            >
                              {copiedMsgId === msg.id
                                ? <i className="ri-check-line text-[10px] text-green-400" />
                                : <i className="ri-file-copy-line text-[10px]" />}
                            </button>
                          </div>
                        )}

                        {/* khoj-style: timestamp + read receipt on last bubble */}
                        {isLast && (
                          <div className={`flex items-center gap-1 mt-1 ${isMe ? "justify-end" : "justify-start"}`}>
                            {/* relative time */}
                            <span
                              className="text-[10px] text-[#334155]"
                              title={formatAbsoluteTime(msg.timestamp)}
                            >
                              {renderTimestamp(msg.timestamp)}
                            </span>
                            {/* Read receipt for my messages */}
                            {isMe && (
                              <span className="text-[10px]">
                                {msg.read
                                  ? <i className="ri-check-double-line text-[#00D4B8]" title="已读" />
                                  : <i className="ri-check-line text-[#475569]" title="已送达" />}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* My avatar placeholder */}
                {isMe && (
                  <div className="w-7 h-7 rounded-full bg-[#00D4B8]/20 flex items-center justify-center text-xs font-bold text-[#00D4B8] flex-shrink-0 mt-1">
                    我
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="p-4 border-t border-white/[0.06] flex items-end gap-3">
          <div className="flex-1 flex items-center gap-2 px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl focus-within:border-[#00D4B8]/50 transition-colors">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="输入消息...（Enter 发送）"
              className="flex-1 bg-transparent text-sm text-[#F1F5F9] placeholder-[#475569] focus:outline-none"
            />
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="w-6 h-6 flex items-center justify-center text-[#475569] hover:text-[#94A3B8] cursor-pointer">
                    <i className="ri-attachment-2 text-sm" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>附件</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="w-6 h-6 flex items-center justify-center text-[#475569] hover:text-[#94A3B8] cursor-pointer">
                    <i className="ri-emotion-line text-sm" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>表情</TooltipContent>
              </Tooltip>
            </div>
          </div>
          <Button
            variant="primary"
            size="icon"
            onClick={handleSend}
            className={input.trim() ? "" : "opacity-40"}
          >
            <i className="ri-send-plane-fill text-sm" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CommunityPage() {
  const [activeTab, setActiveTab] = useState<Tab>("matching");

  const tabs: { key: Tab; icon: string; label: string; badge?: number }[] = [
    { key: "matching", icon: "ri-user-heart-line", label: "匹配推荐" },
    { key: "needs", icon: "ri-broadcast-line", label: "研究需求" },
    { key: "messages", icon: "ri-message-3-line", label: "消息" },
  ];

  return (
    <div className="min-h-screen bg-[#080C1A]">
      <Navbar />
      <div className="max-w-[1400px] mx-auto px-6 pt-24 pb-16">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#F1F5F9] mb-1">学者社区</h1>
          <p className="text-[#94A3B8] text-sm">发现跨学科合作者，共建未来研究</p>
        </div>
        <div className="flex items-center gap-1 mb-6 bg-white/[0.04] rounded-xl p-1 border border-white/[0.06] w-fit">
          {tabs.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.key ? "bg-[#00D4B8] text-[#080C1A]" : "text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/[0.05]"
              }`}>
              <span className="w-4 h-4 flex items-center justify-center"><i className={tab.icon} /></span>
              {tab.label}
              {tab.badge && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${activeTab === tab.key ? "bg-[#080C1A]/20" : "bg-red-500 text-white"}`}>{tab.badge}</span>}
            </button>
          ))}
        </div>
        <div>
          {activeTab === "matching" && <MatchingTab />}
          {activeTab === "needs" && <NeedsTab />}
          {activeTab === "messages" && <MessagesTab />}
        </div>
      </div>
      <Footer />
    </div>
  );
}
