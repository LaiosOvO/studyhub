import { useState } from "react";
import { Slider } from "../../../components/base/Slider";
import { Switch } from "../../../components/base/Switch";
import { Badge } from "../../../components/base/Badge";
import { Button } from "../../../components/base/Button";

// ... existing code ...

export interface FilterValues {
  yearRange: number[];
  citationMin: number;
  openAccessOnly: boolean;
  language: string;
  sources: Record<string, boolean>;
}

interface FilterSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onApplyFilters?: (filters: FilterValues) => void;
}

export default function FilterSidebar({ collapsed, onToggle, onApplyFilters }: FilterSidebarProps) {
  const [yearRange, setYearRange] = useState([2015, 2026]);
  const [citationMin, setCitationMin] = useState(0);
  const [openAccessOnly, setOpenAccessOnly] = useState(false);
  const [language, setLanguage] = useState("all");
  const [sources, setSources] = useState({
    openalex: true,
    semantic_scholar: true,
    pubmed: false,
    arxiv: true,
    cnki: false,
    wanfang: false,
  });

  const sourceLabels: { key: keyof typeof sources; label: string; count: string }[] = [
    { key: "openalex", label: "OpenAlex", count: "240M+" },
    { key: "semantic_scholar", label: "Semantic Scholar", count: "200M+" },
    { key: "pubmed", label: "PubMed", count: "35M+" },
    { key: "arxiv", label: "arXiv", count: "2.3M+" },
    { key: "cnki", label: "CNKI", count: "80M+" },
    { key: "wanfang", label: "万方数据", count: "30M+" },
  ];

  const toggleSource = (key: keyof typeof sources) => {
    setSources((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getFilterValues = (): FilterValues => ({
    yearRange,
    citationMin,
    openAccessOnly,
    language,
    sources,
  });

  const handleApply = () => {
    onApplyFilters?.(getFilterValues());
  };

  const handleReset = () => {
    const defaults = {
      yearRange: [2015, 2026],
      citationMin: 0,
      openAccessOnly: false,
      language: "all",
      sources: { openalex: true, semantic_scholar: true, pubmed: false, arxiv: true, cnki: false, wanfang: false },
    };
    setYearRange(defaults.yearRange);
    setCitationMin(defaults.citationMin);
    setOpenAccessOnly(defaults.openAccessOnly);
    setLanguage(defaults.language);
    setSources(defaults.sources);
    onApplyFilters?.(defaults);
  };

  const activeFiltersCount = [
    yearRange[0] > 2015 || yearRange[1] < 2026,
    citationMin > 0,
    openAccessOnly,
    language !== "all",
    !sources.openalex || !sources.semantic_scholar || !sources.arxiv,
  ].filter(Boolean).length;

  if (collapsed) {
    return (
      <aside className="flex-shrink-0">
        <button
          onClick={onToggle}
          className="relative w-10 h-10 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.08] text-[#94A3B8] hover:text-[#00D4B8] hover:border-[#00D4B8]/30 transition-all cursor-pointer"
          title="展开筛选"
        >
          <i className="ri-filter-3-line text-sm" />
          {activeFiltersCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#00D4B8] text-[9px] font-bold text-[#080C1A] flex items-center justify-center">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-64 flex-shrink-0 bg-[#0E1428] rounded-xl border border-white/[0.06] p-4 h-fit sticky top-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 flex items-center justify-center">
            <i className="ri-filter-3-line text-sm text-[#00D4B8]" />
          </span>
          <span className="text-sm font-semibold text-[#F1F5F9]">筛选器</span>
          {activeFiltersCount > 0 && (
            <Badge variant="cyan" className="text-[10px] px-1.5 py-0">{activeFiltersCount}</Badge>
          )}
        </div>
        <button
          onClick={onToggle}
          className="w-6 h-6 flex items-center justify-center rounded text-[#475569] hover:text-[#F1F5F9] transition-colors cursor-pointer"
        >
          <i className="ri-arrow-left-s-line text-sm" />
        </button>
      </div>

      {/* Year Range — Radix Slider */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-medium text-[#94A3B8]">发表年份</label>
          <span className="text-xs font-mono text-[#00D4B8]">{yearRange[0]} – {yearRange[1]}</span>
        </div>
        <Slider
          min={2000}
          max={2026}
          step={1}
          value={yearRange}
          onValueChange={setYearRange}
        />
        <div className="flex justify-between text-[10px] text-[#475569] mt-2">
          <span>2000</span>
          <span>2026</span>
        </div>
      </div>

      {/* Citation Min — Radix Slider */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-medium text-[#94A3B8]">最低引用数</label>
          <span className="text-xs font-mono text-[#00D4B8]">
            {citationMin === 0 ? "不限" : citationMin.toLocaleString()}
          </span>
        </div>
        <Slider
          min={0}
          max={10000}
          step={100}
          value={[citationMin]}
          onValueChange={([v]) => setCitationMin(v)}
        />
        <div className="flex justify-between text-[10px] text-[#475569] mt-2">
          <span>不限</span>
          <span>10,000+</span>
        </div>
      </div>

      {/* Sources */}
      <div className="mb-6">
        <label className="text-xs font-medium text-[#94A3B8] mb-3 block">数据来源</label>
        <div className="space-y-2">
          {sourceLabels.map(({ key, label, count }) => (
            <label
              key={key}
              className="flex items-center gap-2.5 cursor-pointer group"
              onClick={() => toggleSource(key)}
            >
              <div
                className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                  sources[key]
                    ? "border-[#00D4B8] bg-[#00D4B8]"
                    : "border-white/[0.2] bg-transparent group-hover:border-[#00D4B8]/50"
                }`}
              >
                {sources[key] && <i className="ri-check-line text-[10px] text-[#080C1A]" />}
              </div>
              <span className="text-xs text-[#94A3B8] group-hover:text-[#F1F5F9] transition-colors flex-1 truncate">
                {label}
              </span>
              <span className="text-[10px] text-[#475569] font-mono">{count}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Language */}
      <div className="mb-6">
        <label className="text-xs font-medium text-[#94A3B8] mb-3 block">语言</label>
        <div className="flex gap-1.5">
          {[
            { key: "all", label: "全部" },
            { key: "en", label: "英文" },
            { key: "zh", label: "中文" },
          ].map((lang) => (
            <button
              key={lang.key}
              onClick={() => setLanguage(lang.key)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                language === lang.key
                  ? "bg-[#00D4B8] text-[#080C1A]"
                  : "bg-white/[0.04] text-[#94A3B8] hover:bg-white/[0.08]"
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      {/* Open Access — Radix Switch */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-[#94A3B8] cursor-pointer" htmlFor="oa-switch">
            仅 Open Access
          </label>
          <Switch
            id="oa-switch"
            checked={openAccessOnly}
            onCheckedChange={setOpenAccessOnly}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={handleReset} className="flex-1 text-xs">
          重置
        </Button>
        <Button variant="primary" size="sm" onClick={handleApply} className="flex-1 text-xs">
          应用筛选
        </Button>
      </div>
    </aside>
  );
}
