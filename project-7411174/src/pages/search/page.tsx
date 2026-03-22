import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/feature/Navbar";
import Footer from "../../components/feature/Footer";
import FilterSidebar, { type FilterValues } from "./components/FilterSidebar";
import PaperCard from "./components/PaperCard";
import { papersApi, readingListsApi, type PaperResult } from "../../lib/api";
import type { Paper } from "../../mocks/papers";
import EmptyState from "../../components/base/EmptyState";
import { SkeletonList, SkeletonSortBar } from "../../components/base/Skeleton";
import { useToast } from "../../components/base/Toast";

type SearchType = "keyword" | "title" | "author" | "doi";
type SortType = "relevance" | "citations" | "year";

const searchTypeLabels: Record<SearchType, string> = {
  keyword: "关键词",
  title: "标题",
  author: "作者",
  doi: "DOI",
};

/** Convert API PaperResult to frontend Paper type */
function toPaper(p: PaperResult, idx: number): Paper {
  return {
    id: p.id || p.doi || p.arxiv_id || `result-${idx}`,
    title: p.title,
    authors: p.authors,
    year: p.year ?? 0,
    venue: p.venue ?? "",
    citations: p.citation_count,
    abstract: p.abstract ?? "",
    doi: p.doi,
    arxivId: p.arxiv_id,
    source: (p.sources?.[0] as Paper["source"]) ?? "openalex",
    isOpenAccess: p.is_open_access,
    tags: [],
    qualityScore: 0,
  };
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<SearchType>("keyword");
  const [sortType, setSortType] = useState<SortType>("relevance");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [searchError, setSearchError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const filtersRef = useRef<FilterValues | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const PAGE_SIZE = 25;

  const sortLabels: Record<SortType, string> = {
    relevance: "相关性",
    citations: "引用数",
    year: "最新",
  };

  const doSearch = async (q: string, page = 1) => {
    if (!q.trim()) return;
    setIsLoading(true);
    setHasSearched(true);
    setSearchError("");
    try {
      const filters = filtersRef.current;
      const activeSources = filters
        ? Object.entries(filters.sources)
            .filter(([, enabled]) => enabled)
            .map(([key]) => key)
        : undefined;

      const res = await papersApi.search({
        query: q,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        sort_by: sortType === "relevance" ? undefined : sortType,
        year_from: filters && filters.yearRange[0] > 2000 ? filters.yearRange[0] : undefined,
        year_to: filters && filters.yearRange[1] < 2026 ? filters.yearRange[1] : undefined,
        sources: activeSources && activeSources.length > 0 ? activeSources : undefined,
      });
      setPapers(res.papers.map(toPaper));
      setTotalResults(res.total);
      setCurrentPage(page);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "搜索失败";
      setSearchError(msg);
      setPapers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query, 1);
  };

  const handleHotSearch = (term: string) => {
    setQuery(term);
    doSearch(term, 1);
  };

  const handleReadingList = async (paperId: string): Promise<void> => {
    try {
      let lists = await readingListsApi.list().catch(() => [] as { id: string }[]);
      if (!Array.isArray(lists)) lists = [];
      let listId: string;
      if (lists.length > 0) {
        listId = lists[0].id;
      } else {
        const created = await readingListsApi.create({ name: "默认阅读列表" });
        listId = created.id;
      }
      await readingListsApi.addPaper(listId, paperId);
      toast({ title: "已加入阅读列表", description: "论文已成功添加到阅读列表" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "添加失败，请稍后重试";
      toast({ title: "添加失败", description: msg, variant: "destructive" });
      throw err;
    }
  };

  const handleApplyFilters = (filters: FilterValues) => {
    filtersRef.current = filters;
    if (query.trim()) {
      doSearch(query, 1);
    }
  };

  const sortedPapers = [...papers].sort((a, b) => {
    if (sortType === "citations") return b.citations - a.citations;
    if (sortType === "year") return b.year - a.year;
    return 0; // relevance = API order
  });

  const totalPages = Math.max(1, Math.ceil(totalResults / PAGE_SIZE));
  const hotSearches = ["Transformer", "大语言模型", "扩散模型", "联邦学习", "图神经网络", "RLHF"];

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />

      {/* Sticky Search Bar */}
      <div className="sticky top-[68px] z-40 glass border-b border-white/[0.06]">
        <div className="max-w-[1400px] mx-auto px-6 py-3">
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            {/* Search Type Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg glass border border-white/[0.1] text-sm text-text-secondary hover:text-text-primary hover:border-white/[0.2] transition-all cursor-pointer whitespace-nowrap"
              >
                {searchTypeLabels[searchType]}
                <span className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-arrow-down-s-line text-xs" />
                </span>
              </button>
              {dropdownOpen && (
                <div className="absolute top-full left-0 mt-1 glass rounded-lg border border-white/[0.1] overflow-hidden z-50 min-w-[100px]">
                  {(Object.keys(searchTypeLabels) as SearchType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => { setSearchType(type); setDropdownOpen(false); }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-white/[0.05] transition-colors cursor-pointer whitespace-nowrap ${
                        searchType === type ? "text-accent-cyan" : "text-text-secondary"
                      }`}
                    >
                      {searchTypeLabels[type]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search Input */}
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-text-muted">
                {isLoading
                  ? <i className="ri-loader-4-line text-sm animate-spin text-accent-cyan" />
                  : <i className="ri-search-line text-sm" />}
              </span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索论文、作者或关键词..."
                className="w-full pl-9 pr-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-cyan/40 transition-colors"
              />
            </div>

            {/* Search Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-accent-cyan text-bg-primary text-sm font-semibold hover:bg-accent-cyan-dim transition-all cursor-pointer whitespace-nowrap disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <i className="ri-loader-4-line text-sm animate-spin" />
                  搜索中
                </>
              ) : (
                <>
                  <span className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-search-line text-sm" />
                  </span>
                  搜索
                </>
              )}
            </button>
          </form>

          {/* Hot searches */}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[11px] text-text-muted flex items-center gap-1">
              <i className="ri-fire-line text-orange-400 text-xs" />
              热搜：
            </span>
            {hotSearches.map((term) => (
              <button
                key={term}
                onClick={() => handleHotSearch(term)}
                className="text-[11px] px-2 py-0.5 rounded text-text-muted hover:text-accent-cyan hover:bg-accent-cyan/[0.08] transition-all cursor-pointer whitespace-nowrap"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-6 mt-[10vh]">
        <div className="flex gap-6">
          {/* Filter Sidebar */}
          <FilterSidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            onApplyFilters={handleApplyFilters}
          />

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {searchError && (
              <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <i className="ri-error-warning-line mr-2" />
                {searchError}
              </div>
            )}

            {isLoading ? (
              <>
                <div className="mb-4"><SkeletonSortBar /></div>
                <SkeletonList count={5} type="paper" />
              </>
            ) : hasSearched && sortedPapers.length === 0 ? (
              <div className="glass rounded-2xl border border-dashed border-white/[0.1]">
                <EmptyState
                  icon="ri-search-eye-line"
                  title={`没有找到「${query}」相关论文`}
                  description="试试换个关键词，或调整左侧筛选条件"
                  actionLabel="清除筛选"
                  onAction={() => { setSidebarCollapsed(false); }}
                  actionIcon="ri-filter-off-line"
                  secondaryLabel="浏览全部论文"
                  onSecondary={() => setHasSearched(false)}
                />
              </div>
            ) : hasSearched ? (
              <>
                {/* Sort Bar */}
                <div className="flex items-center justify-between mb-4 glass rounded-xl px-4 py-3 border border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text-secondary">
                      「<strong className="text-accent-cyan">{query}</strong>」找到{" "}
                      <strong className="text-text-primary font-mono">{totalResults}</strong> 篇
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted">排序：</span>
                    <div className="relative">
                      <button
                        onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass border border-white/[0.08] text-xs text-text-secondary hover:text-text-primary hover:border-white/[0.15] transition-all cursor-pointer whitespace-nowrap"
                      >
                        {sortLabels[sortType]}
                        <span className="w-3 h-3 flex items-center justify-center">
                          <i className="ri-arrow-down-s-line text-xs" />
                        </span>
                      </button>
                      {sortDropdownOpen && (
                        <div className="absolute top-full right-0 mt-1 glass rounded-lg border border-white/[0.1] overflow-hidden z-50 min-w-[100px]">
                          {(Object.keys(sortLabels) as SortType[]).map((s) => (
                            <button
                              key={s}
                              onClick={() => { setSortType(s); setSortDropdownOpen(false); doSearch(query, 1); }}
                              className={`w-full text-left px-4 py-2 text-xs hover:bg-white/[0.05] transition-colors cursor-pointer whitespace-nowrap ${
                                sortType === s ? "text-accent-cyan" : "text-text-secondary"
                              }`}
                            >
                              {sortLabels[s]}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Paper List */}
                <div className="space-y-3">
                  {sortedPapers.map((paper) => (
                    <PaperCard
                      key={paper.id}
                      paper={paper}
                      onReadingList={handleReadingList}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-8">
                    <button
                      onClick={() => doSearch(query, Math.max(1, currentPage - 1))}
                      disabled={currentPage <= 1}
                      className="w-9 h-9 flex items-center justify-center rounded-lg glass border border-white/[0.08] text-text-muted hover:text-text-primary hover:border-white/[0.15] transition-all cursor-pointer disabled:opacity-30"
                    >
                      <i className="ri-arrow-left-s-line text-sm" />
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => doSearch(query, page)}
                        className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm transition-all cursor-pointer ${
                          page === currentPage
                            ? "bg-accent-cyan text-bg-primary font-semibold"
                            : "glass border border-white/[0.08] text-text-secondary hover:text-text-primary hover:border-white/[0.15]"
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => doSearch(query, Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage >= totalPages}
                      className="w-9 h-9 flex items-center justify-center rounded-lg glass border border-white/[0.08] text-text-muted hover:text-text-primary hover:border-white/[0.15] transition-all cursor-pointer disabled:opacity-30"
                    >
                      <i className="ri-arrow-right-s-line text-sm" />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="glass rounded-2xl border border-dashed border-white/[0.1]">
                <EmptyState
                  icon="ri-search-line"
                  title="搜索论文"
                  description="输入关键词或点击热搜标签开始搜索"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
