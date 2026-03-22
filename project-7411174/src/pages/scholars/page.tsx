import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../../components/feature/Navbar";
import Footer from "../../components/feature/Footer";
import { scholarsApi, papersApi, type ScholarResponse, type PaperResult } from "../../lib/api";
import { useToast } from "../../components/base/Toast";
import { useAuth } from "../../contexts/AuthContext";
import EmptyState from "../../components/base/EmptyState";
import { SkeletonList } from "../../components/base/Skeleton";

/** Local Scholar type for UI compatibility */
interface Scholar {
  id: string;
  name: string;
  nameEn: string;
  avatar: string;
  institution: string;
  title: string;
  birthYear: number | null;
  hIndex: number;
  totalCitations: number;
  paperCount: number;
  researchAreas: string[];
  honors: string[];
  education: Record<string, string> | null;
  note: string;
  linkedPaperIds: string[];
}

function mapResponseToScholar(res: ScholarResponse): Scholar {
  const titleStr = Array.isArray(res.title)
    ? res.title[0] ?? ""
    : res.title ?? res.rank ?? "";
  const linkedPapers = res.linked_paper_ids ?? [];
  return {
    id: res.id,
    name: res.name,
    nameEn: res.name_en ?? "",
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(res.name)}&background=0d1117&color=22d3ee&size=100`,
    institution: res.institution ?? "",
    title: titleStr,
    birthYear: res.birth_year ?? null,
    hIndex: res.h_index ?? 0,
    totalCitations: res.total_citations ?? res.citation_count ?? 0,
    paperCount: linkedPapers.length,
    researchAreas: res.research_fields ?? res.research_directions ?? res.expertise ?? [],
    honors: res.honors ?? [],
    education: res.education ?? null,
    note: res.note ?? "",
    linkedPaperIds: linkedPapers,
  };
}

function ScholarCard({ scholar, onSelect }: { scholar: Scholar; onSelect: (s: Scholar) => void }) {
  return (
    <div onClick={() => onSelect(scholar)} className="glass rounded-xl p-5 border border-white/[0.06] hover:border-accent-cyan/20 transition-all cursor-pointer group">
      <div className="flex items-start gap-4">
        <img src={scholar.avatar} alt={scholar.name} className="w-14 h-14 rounded-full object-cover object-top bg-bg-elevated flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <h3 className="text-sm font-semibold text-text-primary group-hover:text-accent-cyan transition-colors">{scholar.name}</h3>
            {scholar.nameEn && <span className="text-[10px] text-text-muted">{scholar.nameEn}</span>}
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            {scholar.title}{scholar.title && scholar.institution ? " · " : ""}{scholar.institution}
            {scholar.birthYear ? ` · ${new Date().getFullYear() - scholar.birthYear}岁` : ""}
          </p>
          <div className="flex gap-4 mt-2 text-xs">
            <span className="text-text-muted">H指数 <strong className="text-text-primary font-mono">{scholar.hIndex}</strong></span>
            <span className="text-text-muted">引用 <strong className="text-text-primary font-mono">{scholar.totalCitations > 1000 ? `${(scholar.totalCitations / 1000).toFixed(1)}k` : scholar.totalCitations}</strong></span>
            {scholar.paperCount > 0 && (
              <span className="text-text-muted">论文 <strong className="text-text-primary font-mono">{scholar.paperCount}</strong></span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {scholar.researchAreas.slice(0, 3).map((area) => (
              <span key={area} className="text-[10px] px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-text-muted">{area}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface DrawerProps {
  scholar: Scholar;
  onClose: () => void;
}

function ScholarDetailDrawer({ scholar, onClose }: DrawerProps) {
  const [papers, setPapers] = useState<PaperResult[]>([]);
  const [loadingPapers, setLoadingPapers] = useState(false);
  const [following, setFollowing] = useState(false);
  const { toast } = useToast();
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();

  // Load follow status
  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    scholarsApi.isFollowing(scholar.id).then((res) => {
      if (!cancelled) setFollowing(res.following);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [scholar.id, isLoggedIn]);

  useEffect(() => {
    if (scholar.linkedPaperIds.length === 0) return;
    let cancelled = false;
    setLoadingPapers(true);

    // Fetch first 10 linked papers
    Promise.all(
      scholar.linkedPaperIds.slice(0, 10).map((pid) =>
        papersApi.getDetail(pid).catch(() => null)
      )
    ).then((results) => {
      if (!cancelled) {
        setPapers(results.filter((r): r is PaperResult => r !== null));
        setLoadingPapers(false);
      }
    });

    return () => { cancelled = true; };
  }, [scholar.linkedPaperIds]);

  const educationLabels: Record<string, string> = {
    bachelor: "本科",
    master: "硕士",
    phd: "博士",
    postdoc: "博士后",
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50 backdrop-blur-sm cursor-pointer" onClick={onClose} />
      <div className="w-[480px] bg-bg-card border-l border-white/[0.08] flex flex-col overflow-hidden animate-slide-right">
        {/* Header */}
        <div className="p-6 border-b border-white/[0.06] flex items-start justify-between">
          <div className="flex items-center gap-4">
            <img src={scholar.avatar} alt={scholar.name} className="w-16 h-16 rounded-full object-cover object-top bg-bg-elevated" />
            <div>
              <h2 className="text-lg font-bold text-text-primary">{scholar.name}</h2>
              {scholar.nameEn && <p className="text-xs text-text-muted">{scholar.nameEn}</p>}
              <p className="text-sm text-text-muted">{scholar.title}</p>
              <p className="text-xs text-text-muted">{scholar.institution}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-white/[0.05] cursor-pointer">
            <i className="ri-close-line" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "H 指数", value: scholar.hIndex, icon: "ri-bar-chart-grouped-line" },
              { label: "总引用数", value: scholar.totalCitations > 1000 ? `${(scholar.totalCitations / 1000).toFixed(1)}k` : String(scholar.totalCitations), icon: "ri-git-branch-line" },
              { label: "关联论文", value: scholar.paperCount, icon: "ri-article-line" },
            ].map((stat) => (
              <div key={stat.label} className="glass rounded-xl p-3 border border-white/[0.06] text-center">
                <span className="w-5 h-5 flex items-center justify-center mx-auto mb-1.5 text-accent-cyan"><i className={`${stat.icon} text-sm`} /></span>
                <div className="text-lg font-bold text-gradient-cyan font-mono">{stat.value}</div>
                <div className="text-[10px] text-text-muted">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Bio / Note */}
          {scholar.note && (
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">简介</h4>
              <p className="text-xs text-text-secondary leading-relaxed">{scholar.note}</p>
            </div>
          )}

          {/* Education */}
          {scholar.education && Object.keys(scholar.education).length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">教育经历</h4>
              <div className="space-y-2">
                {Object.entries(scholar.education).map(([degree, school]) => (
                  <div key={degree} className="flex items-center gap-3 text-xs">
                    <span className="w-5 h-5 flex items-center justify-center text-accent-cyan flex-shrink-0">
                      <i className="ri-graduation-cap-line text-sm" />
                    </span>
                    <span className="text-text-muted w-10 flex-shrink-0">{educationLabels[degree] ?? degree}</span>
                    <span className="text-text-primary">{school}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Honors */}
          {scholar.honors.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">荣誉称号</h4>
              <div className="flex flex-wrap gap-2">
                {scholar.honors.map((honor) => (
                  <span key={honor} className="text-xs px-3 py-1.5 rounded-full bg-amber-500/[0.08] border border-amber-500/20 text-amber-400">{honor}</span>
                ))}
              </div>
            </div>
          )}

          {/* Research Areas */}
          {scholar.researchAreas.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">研究方向</h4>
              <div className="flex flex-wrap gap-2">
                {scholar.researchAreas.map((area) => (
                  <span key={area} className="text-xs px-3 py-1.5 rounded-full bg-accent-cyan/[0.08] border border-accent-cyan/20 text-accent-cyan">{area}</span>
                ))}
              </div>
            </div>
          )}

          {/* Linked Papers */}
          {(papers.length > 0 || loadingPapers) && (
            <div>
              <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
                关联论文 {scholar.paperCount > 0 && <span className="text-text-muted font-normal">({scholar.paperCount})</span>}
              </h4>
              {loadingPapers ? (
                <div className="flex items-center gap-2 text-xs text-text-muted py-4">
                  <i className="ri-loader-4-line animate-spin" /> 加载论文中...
                </div>
              ) : (
                <div className="space-y-3">
                  {papers.map((p) => (
                    <Link
                      key={p.id ?? p.title}
                      to={p.id ? `/papers/${p.id}` : "#"}
                      onClick={onClose}
                      className="block glass rounded-lg p-3 border border-white/[0.04] hover:border-accent-cyan/20 transition-all group/paper"
                    >
                      <p className="text-xs font-medium text-text-primary mb-1 leading-relaxed group-hover/paper:text-accent-cyan transition-colors">{p.title}</p>
                      <p className="text-[10px] text-text-muted">
                        {p.year ? `${p.year} · ` : ""}
                        <span className="font-mono">{p.citation_count.toLocaleString()}</span> 引用
                        {p.venue ? ` · ${p.venue}` : ""}
                      </p>
                    </Link>
                  ))}
                  {scholar.paperCount > 10 && (
                    <p className="text-[10px] text-text-muted text-center">仅展示前 10 篇</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-white/[0.06] flex gap-3">
          <button
            onClick={() => {
              if (!isLoggedIn) {
                toast({ title: "请先登录", variant: "warning" });
                navigate("/login");
                return;
              }
              navigate("/community");
              toast({ title: "请在社区页面发送消息", variant: "default" });
            }}
            className="flex-1 py-2.5 rounded-xl bg-accent-cyan text-bg-primary text-sm font-semibold hover:bg-accent-cyan-dim cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
          >
            <i className="ri-message-3-line" /> 发消息
          </button>
          <button
            onClick={async () => {
              if (!isLoggedIn) {
                toast({ title: "请先登录", variant: "warning" });
                navigate("/login");
                return;
              }
              try {
                if (following) {
                  await scholarsApi.unfollow(scholar.id);
                  setFollowing(false);
                  toast({ title: "已取消关注", variant: "success" });
                } else {
                  await scholarsApi.follow(scholar.id);
                  setFollowing(true);
                  toast({ title: `已关注 ${scholar.name}`, variant: "success" });
                }
              } catch {
                toast({ title: "操作失败", variant: "warning" });
              }
            }}
            className={`flex-1 py-2.5 rounded-xl border text-sm cursor-pointer whitespace-nowrap transition-all ${
              following
                ? "border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan"
                : "border-white/[0.1] text-text-secondary hover:border-white/[0.2] hover:text-text-primary"
            }`}
          >
            {following ? "已关注" : "关注"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Top research fields across all scholars — curated for visibility */
const TOP_FIELDS = [
  "人工智能", "机器学习", "深度学习", "计算机视觉", "自然语言处理",
  "心电", "ECG智能诊断", "医学AI", "知识图谱", "推荐系统",
  "数据挖掘", "联邦学习", "机器人", "物联网", "信息安全",
  "图神经网络", "语音识别", "高性能计算", "分布式系统", "云计算",
  "软件工程", "多模态学习",
];

type ViewTab = "all" | "following";

export default function ScholarsPage() {
  const [scholars, setScholars] = useState<Scholar[]>([]);
  const [totalScholars, setTotalScholars] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedArea, setSelectedArea] = useState("全部");
  const [detailScholar, setDetailScholar] = useState<Scholar | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const [viewTab, setViewTab] = useState<ViewTab>(
    searchParams.get("tab") === "following" ? "following" : "all"
  );
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const PAGE_SIZE = 100;

  useEffect(() => {
    let cancelled = false;

    async function fetchScholars() {
      try {
        setIsLoading(true);
        setError(null);

        if (viewTab === "following") {
          if (!isLoggedIn) {
            setScholars([]);
            setTotalScholars(0);
            setIsLoading(false);
            return;
          }
          const result = await scholarsApi.listFollowing({ page, limit: PAGE_SIZE });
          if (!cancelled) {
            setScholars(result.scholars.map(mapResponseToScholar));
            setTotalScholars(result.total);
          }
        } else {
          const params: Parameters<typeof scholarsApi.list>[0] = { page, limit: PAGE_SIZE };
          if (selectedArea !== "全部") {
            params.research_field = selectedArea;
          }
          if (search) {
            params.name = search;
          }
          const result = await scholarsApi.list(params);
          if (!cancelled) {
            setScholars(result.scholars.map(mapResponseToScholar));
            setTotalScholars(result.total);
          }
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "加载学者数据失败";
          setError(message);
          setScholars([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchScholars();
    return () => { cancelled = true; };
  }, [page, selectedArea, search, viewTab, isLoggedIn]);

  // Debounced search
  const [searchInput, setSearchInput] = useState("");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchInput = useCallback((val: string) => {
    setSearchInput(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setSearch(val);
      setPage(1);
    }, 400);
  }, []);

  const handleAreaSelect = useCallback((area: string) => {
    setSelectedArea(area);
    setPage(1);
  }, []);

  const filterAreas = ["全部", ...TOP_FIELDS];

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />
      <main id="main-content" className="max-w-[1400px] mx-auto px-6 pt-24 pb-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-text-primary mb-1">
              {viewTab === "following" ? "我的关注" : "学者库"}
            </h1>
            <p className="text-text-secondary text-sm">
              {viewTab === "following" ? "你关注的研究学者" : "浏览研究学者，发现潜在合作者"}
              {!isLoading && totalScholars > 0 && (
                <span className="ml-2 text-text-muted">共 {totalScholars} 位学者</span>
              )}
            </p>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex gap-2 mb-6">
          {([
            { key: "all" as const, label: "学者库", icon: "ri-group-line" },
            { key: "following" as const, label: "我的关注", icon: "ri-user-follow-line" },
          ]).map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => { setViewTab(key); setPage(1); }}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all cursor-pointer flex items-center gap-2 ${
                viewTab === key
                  ? "bg-accent-cyan/10 border-accent-cyan/40 text-accent-cyan"
                  : "border-white/[0.08] text-text-muted hover:border-white/[0.15] hover:text-text-secondary"
              }`}
            >
              <i className={`${icon} text-sm`} />
              {label}
            </button>
          ))}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
            <i className="ri-error-warning-line" />
            <span>{error}</span>
          </div>
        )}

        {/* Search & Filter */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="relative flex-1 max-w-sm">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-text-muted">
              {isLoading
                ? <i className="ri-loader-4-line text-sm animate-spin text-accent-cyan" />
                : <i className="ri-search-line text-sm" />}
            </span>
            <input type="text" value={searchInput} onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="搜索学者、机构..."
              className="w-full pl-9 pr-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-cyan/50 transition-colors" />
          </div>
          <div className="flex flex-wrap gap-2">
            {filterAreas.map((area) => (
              <button key={area} onClick={() => handleAreaSelect(area)}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all cursor-pointer whitespace-nowrap ${
                  selectedArea === area ? "bg-accent-cyan/10 border-accent-cyan/40 text-accent-cyan" : "border-white/[0.08] text-text-muted hover:border-white/[0.15]"
                }`}>{area}</button>
            ))}
          </div>
        </div>

        {/* Scholar Grid or Skeleton */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SkeletonList count={4} type="scholar" />
          </div>
        ) : scholars.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scholars.map((scholar) => (
              <ScholarCard key={scholar.id} scholar={scholar} onSelect={setDetailScholar} />
            ))}
          </div>
        ) : search || selectedArea !== "全部" ? (
          <div className="glass rounded-2xl border border-dashed border-white/[0.1]">
            <EmptyState
              icon="ri-user-search-line"
              title="没有找到匹配的学者"
              description={`没有找到与「${searchInput || selectedArea}」相关的学者，试试其他关键词`}
              actionLabel="去发现学者"
              onAction={() => navigate("/community")}
              actionIcon="ri-user-heart-line"
              secondaryLabel="清除筛选"
              onSecondary={() => { setSearchInput(""); setSearch(""); setSelectedArea("全部"); }}
            />
          </div>
        ) : (
          <div className="glass rounded-2xl border border-dashed border-white/[0.1]">
            <EmptyState
              icon="ri-user-line"
              title="暂无学者数据"
              description="学者数据正在导入中，请稍后刷新查看"
            />
          </div>
        )}

        {/* Pagination */}
        {!isLoading && totalScholars > PAGE_SIZE && (
          <div className="flex items-center justify-center gap-3 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-4 py-2 rounded-lg text-sm border border-white/[0.08] text-text-muted hover:text-text-primary hover:border-white/[0.15] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
            >
              上一页
            </button>
            <span className="text-xs text-text-muted">
              第 {page} / {Math.ceil(totalScholars / PAGE_SIZE)} 页
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= Math.ceil(totalScholars / PAGE_SIZE)}
              className="px-4 py-2 rounded-lg text-sm border border-white/[0.08] text-text-muted hover:text-text-primary hover:border-white/[0.15] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
            >
              下一页
            </button>
          </div>
        )}
      </main>
      <Footer />
      {detailScholar && <ScholarDetailDrawer scholar={detailScholar} onClose={() => setDetailScholar(null)} />}
    </div>
  );
}
