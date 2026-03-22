import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../../components/feature/Navbar";
import Footer from "../../components/feature/Footer";
import { papersApi, type PaperResult, type CitedPaper, type PaperCitationsResponse } from "../../lib/api";

type TabType = "overview" | "references" | "cited_by";

export default function PaperDetailPage() {
  const { paperId } = useParams<{ paperId: string }>();
  const [paper, setPaper] = useState<PaperResult | null>(null);
  const [citations, setCitations] = useState<PaperCitationsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [citationsLoading, setCitationsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abstractExpanded, setAbstractExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const navigate = useNavigate();

  useEffect(() => {
    if (!paperId) return;
    let cancelled = false;

    async function fetchPaper() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await papersApi.getDetail(paperId!);
        if (!cancelled) setPaper(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "加载论文失败");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    async function fetchCitations() {
      try {
        setCitationsLoading(true);
        const data = await papersApi.getCitations(paperId!);
        if (!cancelled) setCitations(data);
      } catch {
        // Citations are optional
      } finally {
        if (!cancelled) setCitationsLoading(false);
      }
    }

    fetchPaper();
    fetchCitations();
    return () => { cancelled = true; };
  }, [paperId]);

  // Use OpenAlex abstract if DB abstract is missing
  const abstractText = paper?.abstract || citations?.abstract || null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <Navbar />
        <div className="max-w-[1400px] mx-auto px-6 pt-28 pb-16">
          <div className="glass rounded-2xl p-8 border border-white/[0.06] animate-pulse">
            <div className="h-6 bg-white/[0.06] rounded w-3/4 mb-4" />
            <div className="h-4 bg-white/[0.06] rounded w-1/2 mb-3" />
            <div className="h-4 bg-white/[0.06] rounded w-1/3" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !paper) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <Navbar />
        <div className="max-w-[1400px] mx-auto px-6 pt-28 pb-16">
          <div className="glass rounded-2xl p-8 border border-red-500/20 text-center">
            <i className="ri-error-warning-line text-3xl text-red-400 mb-3" />
            <p className="text-red-400 text-sm">{error || "论文不存在"}</p>
            <button onClick={() => navigate(-1)} className="mt-4 text-sm text-accent-cyan hover:underline cursor-pointer">返回上一页</button>
          </div>
        </div>
      </div>
    );
  }

  const authors = paper.authors ?? [];
  const refs = citations?.references ?? [];
  const citedBy = citations?.cited_by ?? [];

  const tabs: { key: TabType; label: string; count?: number }[] = [
    { key: "overview", label: "概览" },
    { key: "references", label: "参考文献", count: refs.length },
    { key: "cited_by", label: "被引用", count: citedBy.length },
  ];

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />

      {/* Breadcrumb */}
      <div className="max-w-[1400px] mx-auto px-6 pt-24 pb-2">
        <nav className="flex items-center gap-2 text-xs text-text-muted">
          <button onClick={() => navigate("/")} className="hover:text-accent-cyan transition-colors cursor-pointer">首页</button>
          <span>/</span>
          <button onClick={() => navigate("/search")} className="hover:text-accent-cyan transition-colors cursor-pointer">论文搜索</button>
          <span>/</span>
          <span className="text-text-secondary truncate max-w-xs">{paper.title}</span>
        </nav>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="flex gap-8">
          {/* Main Content */}
          <main id="main-content" className="flex-1 min-w-0">
            {/* Paper Header */}
            <div className="glass rounded-2xl p-8 border border-white/[0.06] mb-6">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {paper.is_open_access && (
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium text-green-400 bg-green-400/10 border border-green-400/20">Open Access</span>
                )}
                {paper.sources.map((src) => (
                  <span key={src} className="text-xs px-2.5 py-1 rounded-full font-medium text-orange-400 bg-orange-400/10 border border-orange-400/20">{src}</span>
                ))}
                {paper.language && (
                  <span className="text-xs px-2.5 py-1 rounded-full text-text-muted bg-white/[0.04] border border-white/[0.06]">
                    {paper.language === "en" ? "英文" : paper.language === "zh" ? "中文" : paper.language}
                  </span>
                )}
              </div>

              <h1 className="text-2xl md:text-3xl font-bold text-text-primary leading-tight mb-4">{paper.title}</h1>

              <div className="flex flex-wrap gap-2 mb-4">
                {authors.map((author) => (
                  <span key={author} className="text-sm text-accent-cyan">{author}</span>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-text-secondary">
                {paper.venue && (
                  <><span className="flex items-center gap-1.5"><i className="ri-book-open-line text-xs" />{paper.venue}</span><span>·</span></>
                )}
                {paper.year && (
                  <><span className="flex items-center gap-1.5"><i className="ri-calendar-line text-xs" />{paper.year}</span><span>·</span></>
                )}
                <span className="flex items-center gap-1.5">
                  <i className="ri-git-branch-line text-xs" />
                  <strong className="text-text-primary font-mono">{paper.citation_count.toLocaleString()}</strong> 次引用
                </span>
                {paper.doi && (
                  <><span>·</span><a href={`https://doi.org/${paper.doi}`} target="_blank" rel="nofollow noopener noreferrer" className="flex items-center gap-1 text-accent-cyan hover:underline"><i className="ri-external-link-line text-xs" />DOI</a></>
                )}
                {paper.pdf_url && (
                  <><span>·</span><a href={paper.pdf_url} target="_blank" rel="nofollow noopener noreferrer" className="flex items-center gap-1 text-green-400 hover:underline"><i className="ri-file-pdf-2-line text-xs" />PDF</a></>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 mb-6 glass rounded-xl p-1 border border-white/[0.06] w-fit">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === tab.key ? "bg-accent-cyan text-bg-primary" : "text-text-secondary hover:text-text-primary hover:bg-white/[0.05]"
                  }`}
                >
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${activeTab === tab.key ? "bg-bg-primary/20" : "bg-white/[0.08]"}`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Abstract */}
                {abstractText ? (
                  <div className="glass rounded-xl p-6 border border-white/[0.06]">
                    <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
                      <i className="ri-file-text-line text-accent-cyan" /> 摘要
                    </h2>
                    <p className={`text-base text-text-secondary leading-relaxed ${!abstractExpanded ? "line-clamp-5" : ""}`}>
                      {abstractText}
                    </p>
                    {!abstractExpanded && abstractText.length > 300 && (
                      <button onClick={() => setAbstractExpanded(true)} className="mt-2 text-sm text-accent-cyan hover:underline cursor-pointer">展开全文</button>
                    )}
                  </div>
                ) : (
                  <div className="glass rounded-xl p-6 border border-white/[0.06] text-center">
                    <i className="ri-file-text-line text-2xl text-text-muted mb-2" />
                    <p className="text-sm text-text-muted">{citationsLoading ? "正在加载摘要..." : "暂无摘要信息"}</p>
                  </div>
                )}

                {/* Citation Network Preview */}
                {(refs.length > 0 || citedBy.length > 0) && (
                  <div className="glass rounded-xl p-6 border border-white/[0.06]">
                    <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
                      <i className="ri-mind-map text-accent-cyan" /> 引用网络
                    </h2>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <button
                        onClick={() => setActiveTab("references")}
                        className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-accent-cyan/20 transition-all cursor-pointer text-left"
                      >
                        <div className="text-2xl font-bold text-gradient-cyan font-mono mb-1">{refs.length}</div>
                        <div className="text-xs text-text-muted">参考文献</div>
                      </button>
                      <button
                        onClick={() => setActiveTab("cited_by")}
                        className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-accent-cyan/20 transition-all cursor-pointer text-left"
                      >
                        <div className="text-2xl font-bold text-gradient-cyan font-mono mb-1">{citedBy.length}</div>
                        <div className="text-xs text-text-muted">被引用</div>
                      </button>
                    </div>
                    <button
                      onClick={() => navigate(`/research/${paperId}`)}
                      className="w-full py-3 rounded-xl border border-accent-cyan/20 bg-accent-cyan/[0.05] text-accent-cyan text-sm font-medium hover:bg-accent-cyan/[0.1] transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <i className="ri-mind-map" /> 查看完整引用图谱
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* References Tab */}
            {activeTab === "references" && (
              <div className="space-y-3">
                {citationsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-text-muted py-8 justify-center">
                    <i className="ri-loader-4-line animate-spin" /> 加载参考文献...
                  </div>
                ) : refs.length > 0 ? (
                  <>
                    <p className="text-sm text-text-muted mb-4">该论文引用了 {refs.length} 篇文献</p>
                    {refs.map((ref, i) => (
                      <PaperListItem key={ref.openalex_id} paper={ref} index={i + 1} />
                    ))}
                  </>
                ) : (
                  <div className="text-center py-8 text-text-muted text-sm">暂无参考文献数据</div>
                )}
              </div>
            )}

            {/* Cited By Tab */}
            {activeTab === "cited_by" && (
              <div className="space-y-3">
                {citationsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-text-muted py-8 justify-center">
                    <i className="ri-loader-4-line animate-spin" /> 加载引用数据...
                  </div>
                ) : citedBy.length > 0 ? (
                  <>
                    <p className="text-sm text-text-muted mb-4">以下 {citedBy.length} 篇论文引用了本文（按影响力排序）</p>
                    {citedBy.map((cite, i) => (
                      <PaperListItem key={cite.openalex_id} paper={cite} index={i + 1} highlight />
                    ))}
                  </>
                ) : (
                  <div className="text-center py-8 text-text-muted text-sm">暂无被引用数据</div>
                )}
              </div>
            )}
          </main>

          {/* Sidebar */}
          <aside className="w-72 flex-shrink-0 space-y-4">
            <div className="glass rounded-xl p-5 border border-white/[0.06]">
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-4">论文指标</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">引用量</span>
                  <span className="text-sm font-bold text-text-primary font-mono">{paper.citation_count.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">作者数</span>
                  <span className="text-sm font-bold text-text-primary font-mono">{authors.length}</span>
                </div>
                {paper.year && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-muted">发表年份</span>
                    <span className="text-sm font-bold text-text-primary font-mono">{paper.year}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">参考文献</span>
                  <span className="text-sm font-bold text-text-primary font-mono">{citationsLoading ? "..." : refs.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">被引次数</span>
                  <span className="text-sm font-bold text-text-primary font-mono">{citationsLoading ? "..." : citedBy.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">开放获取</span>
                  <span className={`text-xs font-medium ${paper.is_open_access ? "text-green-400" : "text-text-muted"}`}>
                    {paper.is_open_access ? "是" : "否"}
                  </span>
                </div>
              </div>
            </div>

            <div className="glass rounded-xl p-5 border border-white/[0.06] space-y-2">
              {paper.doi && (
                <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="nofollow noopener noreferrer"
                  className="w-full py-2.5 rounded-xl bg-accent-cyan text-bg-primary text-sm font-semibold hover:bg-accent-cyan-dim cursor-pointer whitespace-nowrap flex items-center justify-center gap-2">
                  <i className="ri-external-link-line" /> 查看原文
                </a>
              )}
              {paper.pdf_url && (
                <a href={paper.pdf_url} target="_blank" rel="nofollow noopener noreferrer"
                  className="w-full py-2.5 rounded-xl border border-white/[0.1] text-text-secondary text-sm hover:border-white/[0.2] hover:text-text-primary cursor-pointer whitespace-nowrap flex items-center justify-center gap-2">
                  <i className="ri-file-pdf-2-line" /> 下载 PDF
                </a>
              )}
              <button onClick={() => navigate(`/research/${paperId}`)}
                className="w-full py-2.5 rounded-xl border border-accent-cyan/20 text-accent-cyan text-sm hover:bg-accent-cyan/[0.05] cursor-pointer whitespace-nowrap flex items-center justify-center gap-2">
                <i className="ri-mind-map" /> 引用图谱
              </button>
              <button onClick={() => navigate(-1)}
                className="w-full py-2.5 rounded-xl border border-white/[0.1] text-text-secondary text-sm hover:border-white/[0.2] hover:text-text-primary cursor-pointer whitespace-nowrap flex items-center justify-center gap-2">
                <i className="ri-arrow-left-line" /> 返回
              </button>
            </div>
          </aside>
        </div>
      </div>

      <Footer />
    </div>
  );
}

/** Reusable paper list item for references/cited-by */
function PaperListItem({ paper, index, highlight }: { paper: CitedPaper; index: number; highlight?: boolean }) {
  return (
    <div className={`glass rounded-xl p-4 border ${highlight ? "border-white/[0.06] hover:border-accent-cyan/20" : "border-white/[0.06] hover:border-white/[0.1]"} transition-all flex items-center gap-4`}>
      <span className="text-sm font-mono text-text-muted w-6 flex-shrink-0">{index}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary line-clamp-2 leading-relaxed">{paper.title}</p>
        <p className="text-xs text-text-muted mt-1">
          {paper.authors.slice(0, 3).join(", ")}{paper.authors.length > 3 ? " ..." : ""}
          {paper.year ? ` · ${paper.year}` : ""}
          {paper.venue ? ` · ${paper.venue}` : ""}
          {" · "}
          <span className={`font-mono ${highlight ? "text-accent-cyan" : ""}`}>{paper.citation_count.toLocaleString()} 引用</span>
        </p>
      </div>
    </div>
  );
}
