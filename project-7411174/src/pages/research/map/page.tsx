import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../../../components/feature/Navbar";
import CitationGraph from "./components/CitationGraph";
import CitationGraph3D from "./components/CitationGraph3D";
import DetailPanel from "./components/DetailPanel";
import MapToolbar, { type ViewType } from "./components/MapToolbar";
import TopicMap from "./components/TopicMap";
import TimelineView from "./components/TimelineView";
import { mockGraphPapers, mockGraphEdges, type GraphPaper, type GraphEdge } from "../../../mocks/graph";
import { papersApi } from "../../../lib/api";
import { fetchCitationNetwork, type CitationNetwork } from "../../../lib/citation-fetcher";

/** Check if taskId looks like a real paper UUID (not "demo" or "new") */
function isPaperUUID(taskId: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId);
}

/** Cluster colors for dynamically generated citation graph */
const DYNAMIC_CLUSTERS = [
  { id: 0, name: "当前论文", color: "#00D4B8" },
  { id: 1, name: "参考文献", color: "#3B82F6" },
  { id: 2, name: "被引论文", color: "#F59E0B" },
];

/** Convert CitationNetwork into GraphPaper[] and GraphEdge[] for the 3D view */
function buildGraphFromNetwork(network: CitationNetwork): { papers: GraphPaper[]; edges: GraphEdge[] } {
  const papers: GraphPaper[] = [];
  const edges: GraphEdge[] = [];
  const c = network.center;

  // Center node — cluster 0
  papers.push({
    id: c.id,
    title: c.title,
    shortTitle: c.title.length > 40 ? c.title.slice(0, 37) + "..." : c.title,
    authors: c.authors,
    year: c.year || 2024,
    citations: c.citationCount,
    cluster: 0,
    abstract: c.abstract || "",
    methods: [],
    venue: c.venue,
    qualityScore: 0.9,
    x: 0,
    y: 0,
  });

  // References — cluster 1, arranged in a ring
  const refCount = network.references.length;
  network.references.forEach((ref, i) => {
    const angle = (i / Math.max(refCount, 1)) * Math.PI * 2;
    const radius = 300 + (i % 3) * 80;
    papers.push({
      id: ref.id,
      title: ref.title,
      shortTitle: ref.title.length > 30 ? ref.title.slice(0, 27) + "..." : ref.title,
      authors: ref.authors,
      year: ref.year || 2020,
      citations: ref.citationCount,
      cluster: 1,
      abstract: ref.abstract || "",
      methods: [],
      venue: ref.venue,
      qualityScore: 0.5,
      x: Math.cos(angle) * radius - 200,
      y: Math.sin(angle) * radius,
    });
    edges.push({ source: c.id, target: ref.id });
  });

  // Cited-by — cluster 2, arranged on opposite side
  const citeCount = network.citedBy.length;
  network.citedBy.forEach((cite, i) => {
    const angle = (i / Math.max(citeCount, 1)) * Math.PI * 2;
    const radius = 300 + (i % 3) * 80;
    papers.push({
      id: cite.id,
      title: cite.title,
      shortTitle: cite.title.length > 30 ? cite.title.slice(0, 27) + "..." : cite.title,
      authors: cite.authors,
      year: cite.year || 2023,
      citations: cite.citationCount,
      cluster: 2,
      abstract: cite.abstract || "",
      methods: [],
      venue: cite.venue,
      qualityScore: 0.5,
      x: Math.cos(angle) * radius + 200,
      y: Math.sin(angle) * radius,
    });
    edges.push({ source: cite.id, target: c.id });
  });

  return { papers, edges };
}

export default function MapPage() {
  const { taskId = "demo" } = useParams<{ taskId: string }>();
  const navigate = useNavigate();

  const [view, setView] = useState<ViewType>("graph3d");
  const [selectedPaper, setSelectedPaper] = useState<GraphPaper | null>(null);
  const [yearRange, setYearRange] = useState<[number, number]>([2000, 2026]);
  const [minCitations, setMinCitations] = useState(0);
  const [activeCluster, setActiveCluster] = useState<number | null>(null);

  // Dynamic data state
  const [dynamicPapers, setDynamicPapers] = useState<GraphPaper[] | null>(null);
  const [dynamicEdges, setDynamicEdges] = useState<GraphEdge[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState<string>("");

  const isRealPaper = isPaperUUID(taskId);

  // Fetch real citation data using citation-fetcher (OpenAlex → S2 fallback)
  useEffect(() => {
    if (!isRealPaper) {
      setDynamicPapers(null);
      setDynamicEdges(null);
      return;
    }

    let cancelled = false;
    async function load() {
      try {
        setIsLoading(true);
        setLoadError(null);
        setProgressMsg("正在获取论文信息...");

        // Get paper from our backend to find OpenAlex ID / DOI
        const paper = await papersApi.getDetail(taskId);
        if (cancelled) return;

        // Use citation-fetcher (browser-side OpenAlex → S2 fallback)
        const network = await fetchCitationNetwork({
          openalexId: paper.openalex_id ?? undefined,
          doi: paper.doi ?? undefined,
          maxReferences: 50,
          maxCitedBy: 30,
          onProgress: (_stage, detail) => {
            if (!cancelled) setProgressMsg(detail);
          },
        });

        if (cancelled) return;

        if (!network || (network.references.length === 0 && network.citedBy.length === 0)) {
          setLoadError("未找到该论文的引用关系数据");
          return;
        }

        const { papers, edges } = buildGraphFromNetwork(network);
        setDynamicPapers(papers);
        setDynamicEdges(edges);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "加载引用数据失败");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setProgressMsg("");
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [taskId, isRealPaper]);

  // Use real data if available, otherwise mock
  const activePapers = dynamicPapers ?? mockGraphPapers;
  const activeEdges = dynamicEdges ?? mockGraphEdges;

  const filteredCount = activePapers.filter(
    (p) =>
      p.year >= yearRange[0] &&
      p.year <= yearRange[1] &&
      p.citations >= minCitations &&
      (activeCluster === null || p.cluster === activeCluster)
  ).length;

  const handleStartExperiment = () => {
    navigate("/plans");
  };

  return (
    <div className="w-screen h-screen bg-bg-primary flex flex-col overflow-hidden">
      <Navbar />

      <div className="flex-1 relative mt-[68px] overflow-hidden">
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-bg-primary/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <i className="ri-loader-4-line animate-spin text-3xl text-accent-cyan" />
              <p className="text-sm text-text-secondary">{progressMsg || "正在加载引用网络..."}</p>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {loadError && !isLoading && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-bg-primary/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 max-w-sm text-center">
              <i className="ri-error-warning-line text-3xl text-red-400" />
              <p className="text-sm text-red-400">{loadError}</p>
              <button onClick={() => navigate(-1)} className="text-sm text-accent-cyan hover:underline cursor-pointer">返回上一页</button>
            </div>
          </div>
        )}

        <MapToolbar
          view={view}
          onViewChange={setView}
          paperCount={filteredCount}
          yearRange={yearRange}
          onYearRangeChange={setYearRange}
          minCitations={minCitations}
          onMinCitationsChange={setMinCitations}
          activeCluster={activeCluster}
          onClusterChange={setActiveCluster}
          taskId={taskId}
        />

        <div
          className="w-full h-full"
          style={{ paddingRight: selectedPaper ? "320px" : "0", transition: "padding 0.3s ease" }}
        >
          {view === "graph" && (
            <CitationGraph
              papers={activePapers}
              edges={activeEdges}
              onSelectPaper={setSelectedPaper}
              yearRange={yearRange}
              minCitations={minCitations}
              activeCluster={activeCluster}
            />
          )}
          {view === "graph3d" && (
            <CitationGraph3D
              papers={activePapers}
              edges={activeEdges}
              clusterConfigs={isRealPaper ? DYNAMIC_CLUSTERS : undefined}
              onSelectPaper={setSelectedPaper}
              yearRange={yearRange}
              minCitations={minCitations}
              activeCluster={activeCluster}
            />
          )}
          {view === "topic" && (
            <TopicMap
              onSelectPaper={setSelectedPaper}
              yearRange={yearRange}
              minCitations={minCitations}
              activeCluster={activeCluster}
            />
          )}
          {view === "timeline" && (
            <TimelineView
              onSelectPaper={setSelectedPaper}
              yearRange={yearRange}
              minCitations={minCitations}
              activeCluster={activeCluster}
            />
          )}
        </div>

        <DetailPanel
          paper={selectedPaper}
          onClose={() => setSelectedPaper(null)}
          onStartExperiment={handleStartExperiment}
        />
      </div>
    </div>
  );
}
