---
phase: 06-paper-map-visualization
verified: 2026-03-16T12:00:00Z
status: gaps_found
score: 4/5 must-haves verified
gaps:
  - truth: "All API paths correctly match backend route prefixes"
    status: failed
    reason: "useGraphData and TopicMapInner call /deep-research/tasks/... but backend registers deep_research_router at /api/v1/deep-research/... -- requests will 404"
    artifacts:
      - path: "apps/web/src/components/paper-map/hooks/useGraphData.ts"
        issue: "Line 57 calls apiFetch('/deep-research/tasks/${taskId}') but backend endpoint is at /api/v1/deep-research/tasks/${taskId}"
      - path: "apps/web/src/components/paper-map/topic-map/TopicMapInner.tsx"
        issue: "Line 52 calls apiFetch('/deep-research/tasks/${taskId}/embeddings') but backend endpoint is at /api/v1/deep-research/tasks/${taskId}/embeddings"
    missing:
      - "Fix API path in useGraphData.ts line 57: change '/deep-research/tasks/${taskId}' to '/api/v1/deep-research/tasks/${taskId}'"
      - "Fix API path in TopicMapInner.tsx line 52: change '/deep-research/tasks/${taskId}/embeddings' to '/api/v1/deep-research/tasks/${taskId}/embeddings'"
  - truth: "Plan 06-01 summary is missing"
    status: partial
    reason: "06-01-SUMMARY.md does not exist in the phase directory -- Plan 01 execution was not summarized"
    artifacts:
      - path: ".planning/phases/06-paper-map-visualization/06-01-SUMMARY.md"
        issue: "File does not exist"
    missing:
      - "Create 06-01-SUMMARY.md documenting what Plan 01 delivered"
human_verification:
  - test: "Open /[locale]/research/[taskId]/map and verify the citation graph renders with force-laid-out nodes"
    expected: "Nodes appear as colored circles with citation counts, edges connect them, zoom/pan/drag works"
    why_human: "Requires running app with real backend data to verify visual rendering and interaction"
  - test: "Click a node and verify the paper detail sidebar opens with quality breakdown"
    expected: "Sidebar slides in from right showing title, year, citations, quality bars, abstract"
    why_human: "Runtime interaction verification"
  - test: "Switch between Citation Graph, Topic Map, and Timeline tabs"
    expected: "Each view renders correctly, selected paper persists across tab switches"
    why_human: "Requires Deck.gl and vis-timeline rendering in browser"
  - test: "Apply filters (year range, quality slider, method pills) and verify all views update"
    expected: "Nodes/points/items are filtered out in real time"
    why_human: "Interactive filter behavior"
  - test: "Export JSON, CSV, and PNG from the export menu"
    expected: "Three files download with correct content"
    why_human: "File download behavior"
  - test: "Create a reading list, add papers, remove papers, delete list"
    expected: "CRUD operations persist across page refresh"
    why_human: "Requires running backend with database"
---

# Phase 6: Paper Map Visualization Verification Report

**Phase Goal:** Users can visually explore the research landscape through interactive citation graphs, topic maps, and timelines
**Verified:** 2026-03-16
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can view a citation graph with nodes sized by citation count and colored by cluster, with zoom/pan/drag | VERIFIED | CitationGraph.tsx uses ReactFlow with fitView, minZoom=0.1, maxZoom=3, nodesDraggable. PaperNode.tsx sizes nodes via sqrt(citationCount)*5, colors via d3-scale-chromatic schemeTableau10. useForceLayout.ts applies D3 force simulation with proper cleanup. |
| 2 | User can click any node to see paper details (abstract, quality score, methods, key findings) | VERIFIED | CitationGraph.tsx onNodeClick calls selectPaper. PaperDetailPanel.tsx reads selectedPaperId from store, displays title/year/citations/quality/methods/abstract, fetches quality breakdown from /citations/paper/{id}/quality. |
| 3 | User can filter the graph by time range, method type, or quality threshold | VERIFIED | FilterBar.tsx provides year range inputs, quality slider (0-1 step 0.1), method type pill buttons. All controls write to Zustand store via setFilters. useFilteredData.ts reads filters and produces new filtered arrays. FilterBar is wired into MapView above the tabs. |
| 4 | User can switch between citation graph, topic map, and timeline views | PARTIALLY VERIFIED | MapView.tsx has tab switcher driving activeView state. TopicMap uses Deck.gl ScatterplotLayer with cluster colors and TextLayer labels. TimelineView uses vis-timeline with useVisTimeline hook. Both SSR-safe via dynamic imports. However, useGraphData and TopicMapInner have incorrect API paths (missing /api/v1 prefix) -- the deep research task fetch and embeddings fetch will 404 at runtime. |
| 5 | User can export graph data and save paper collections/reading lists | VERIFIED | ExportMenu.tsx provides JSON (full graph data), CSV (paper metadata), PNG (html-to-image toPng) exports. ReadingListDrawer.tsx provides CRUD UI. Backend has full ReadingList model, schemas, 7 endpoints with ownership checks, migration. useReadingLists hook wires CRUD. Router registered in main.py at /api/reading-lists. |

**Score:** 4/5 truths verified (1 partially due to API path mismatch)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/components/paper-map/graph/CitationGraph.tsx` | React Flow wrapper with force layout | VERIFIED (81 lines) | Uses ReactFlow, imports PaperNode, useForceLayout, connects to Zustand store |
| `apps/web/src/components/paper-map/graph/PaperNode.tsx` | Custom node sized by citations, colored by cluster | VERIFIED (54 lines) | Circular div, dynamic size/color, memoized, hidden handles |
| `apps/web/src/stores/paper-map-store.ts` | Zustand store for paper map state | VERIFIED (52 lines) | Exports usePaperMapStore with activeView, selectedPaperId, filters, readingListPaperIds, immutable toggleReadingListPaper |
| `apps/web/src/lib/graph-transforms.ts` | API response to visualization transforms | VERIFIED (163 lines) | toReactFlowGraph, toDeckGlPoints, toTimelineItems -- all pure functions |
| `apps/web/src/components/paper-map/shared/PaperDetailPanel.tsx` | Paper detail sidebar on node click | VERIFIED (180 lines) | Reads selectedPaperId, fetches quality, shows title/year/citations/quality bars/methods/abstract |
| `apps/web/src/components/paper-map/topic-map/TopicMapInner.tsx` | Deck.gl scatter plot of paper clusters | VERIFIED (173 lines) | ScatterplotLayer + TextLayer, fetches embeddings, computes centroids |
| `apps/web/src/components/paper-map/timeline/TimelineViewInner.tsx` | vis-timeline chronological view | VERIFIED (35 lines) | Uses useVisTimeline hook, transforms nodes via toTimelineItems |
| `apps/web/src/components/paper-map/shared/FilterBar.tsx` | Year range, method type, quality threshold filters | VERIFIED (162 lines) | Three filter controls, reads/writes Zustand store |
| `apps/web/src/components/paper-map/shared/ExportMenu.tsx` | JSON/CSV/PNG export | VERIFIED (172 lines) | Dropdown with three export options, proper CSV escaping, toPng for screenshots |
| `apps/web/src/components/paper-map/shared/ReadingListDrawer.tsx` | Reading list management sidebar | VERIFIED (253 lines) | Create/delete lists, add/remove papers, expandable paper list |
| `apps/web/src/components/paper-map/MapView.tsx` | View switcher container | VERIFIED (167 lines) | Tab bar, FilterBar, ExportMenu, ReadingListDrawer, conditional view rendering |
| `backend/app/services/deep_research/embedding_service.py` | UMAP 2D coordinate computation | VERIFIED (150 lines) | TF-IDF + UMAP (PCA fallback) + KMeans clustering with auto-labeling |
| `backend/app/routers/reading_lists.py` | CRUD endpoints for reading lists | VERIFIED (222 lines) | 7 endpoints with ownership checks, immutable paper_ids updates |
| `backend/app/models/reading_list.py` | ReadingList SQLAlchemy model | VERIFIED (42 lines) | user_id indexed, name, description, paper_ids JSON, timestamps |
| `apps/web/src/app/[locale]/(auth)/research/[taskId]/map/page.tsx` | Map page route | VERIFIED (29 lines) | Server component extracting taskId, renders MapView |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| CitationGraph.tsx | /api/citations/graph/{paper_id} | useGraphData hook | PARTIAL | useGraphData fetches `/citations/graph/${seedPaperIds[0]}?depth=2` (correct path for citations router) but first fetches task from `/deep-research/tasks/${taskId}` (incorrect -- should be `/api/v1/deep-research/tasks/${taskId}`) |
| CitationGraph.tsx | paper-map-store.ts | selectPaper on node click | WIRED | onNodeClick calls selectPaper(node.id) |
| PaperDetailPanel.tsx | /api/citations/paper/{id}/quality | fetch quality on selection | WIRED | apiFetch(`/citations/paper/${selectedPaperId}/quality`) matches backend route |
| MapView.tsx | paper-map-store.ts | activeView drives view rendering | WIRED | Conditional rendering: activeView === 'graph'/'topic'/'timeline' |
| TopicMapInner.tsx | /api/deep-research/tasks/{id}/embeddings | fetch 2D positions | NOT_WIRED | Calls `/deep-research/tasks/${taskId}/embeddings` but backend is at `/api/v1/deep-research/tasks/${taskId}/embeddings` |
| TimelineViewInner.tsx | graph-transforms.ts | toTimelineItems | WIRED | Transforms nodes via toTimelineItems in useMemo |
| FilterBar.tsx | paper-map-store.ts | setFilters | WIRED | Calls setFilters on change for all three filter controls |
| ReadingListDrawer.tsx | /api/reading-lists | useReadingLists hook | WIRED | Hook calls `/api/reading-lists` matching backend prefix `/api` + router `/reading-lists` |
| ExportMenu.tsx | html-to-image | toPng for PNG export | WIRED | Imports toPng, calls on graphContainerRef |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-----------|-------------|--------|----------|
| PMAP-01 | 06-01 | Interactive citation graph with React Flow + D3 force | SATISFIED | CitationGraph.tsx + useForceLayout.ts |
| PMAP-02 | 06-01 | Node size = citation count, color = cluster | SATISFIED | PaperNode.tsx: sqrt(citationCount)*5 sizing, schemeTableau10 coloring |
| PMAP-03 | 06-01 | Click node for paper details | SATISFIED | PaperDetailPanel.tsx with quality breakdown |
| PMAP-04 | 06-01 | Zoom, pan, drag | SATISFIED | ReactFlow with fitView, minZoom, maxZoom, nodesDraggable |
| PMAP-05 | 06-03 | Filter by time/method/quality | SATISFIED | FilterBar.tsx + useFilteredData.ts |
| PMAP-06 | 06-02 | Topic/discipline map with Deck.gl | PARTIALLY SATISFIED | TopicMapInner.tsx implemented but API path wrong -- will 404 at runtime |
| PMAP-07 | 06-02 | Timeline with vis-timeline | SATISFIED | TimelineViewInner.tsx + useVisTimeline.ts |
| PMAP-08 | 06-02 | Switch between 3 views | SATISFIED | MapView.tsx tab switcher with conditional rendering |
| PMAP-09 | 06-03 | Export graph data | SATISFIED | ExportMenu.tsx: JSON, CSV, PNG |
| PMAP-10 | 06-03 | Save reading lists | SATISFIED | ReadingListDrawer.tsx + backend CRUD + useReadingLists hook |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| useGraphData.ts | 57 | Wrong API path: `/deep-research/tasks/` missing `/api/v1` prefix | BLOCKER | Graph data fetch will 404 -- no data shown |
| TopicMapInner.tsx | 52 | Wrong API path: `/deep-research/tasks/` missing `/api/v1` prefix | BLOCKER | Embeddings fetch will 404 -- topic map empty |
| ReadingListDrawer.tsx | 39 | console.error only for create failure | WARNING | User gets no visible feedback on failure |
| ReadingListDrawer.tsx | 49,59,73 | console.error only for CRUD failures | WARNING | Silent failures for add/remove/delete |
| page.tsx | 19-27 | MapPageContent uses useTranslations without 'use client' | INFO | May work with next-intl server-side support, but could cause issues depending on version |

### Human Verification Required

### 1. Citation Graph Visual Rendering
**Test:** Navigate to /[locale]/research/[taskId]/map with a completed deep research task
**Expected:** Force-laid-out nodes appear as colored circles with citation counts, edges connect related papers, zoom/pan/drag work
**Why human:** Requires running app with real backend data and Neo4j graph

### 2. Paper Detail Sidebar
**Test:** Click any node in the citation graph
**Expected:** Right sidebar shows paper title, year, citations, quality score with breakdown bars, methods tags, abstract snippet. Close button works.
**Why human:** Interactive DOM behavior

### 3. View Switching
**Test:** Switch between Citation Graph, Topic Map, and Timeline tabs
**Expected:** Each view renders its visualization; selected paper and filters persist across switches
**Why human:** Deck.gl WebGL rendering and vis-timeline DOM manipulation

### 4. Filter Controls
**Test:** Set year range 2020-2024, quality threshold 50%, select a method type
**Expected:** All three views show only matching papers; clearing filters restores full set
**Why human:** Cross-view filter propagation

### 5. Export Functions
**Test:** Click Export menu, try JSON, CSV, and PNG downloads
**Expected:** JSON has nodes+edges with correct data; CSV has headers and quoted fields; PNG captures current view
**Why human:** File download and content verification

### 6. Reading List Persistence
**Test:** Create a list, add papers, refresh page, verify list persists. Remove paper, delete list.
**Expected:** All CRUD operations work, data persists in PostgreSQL
**Why human:** Requires running backend with database

## Gaps Summary

One blocking gap was found: **incorrect API paths for deep research endpoints**. The `useGraphData` hook and `TopicMapInner` component call `/deep-research/tasks/...` but the backend registers the deep_research router at `/api/v1/deep-research/...`. This means the citation graph's initial data fetch (to get the task's seed paper IDs) and the topic map's embedding fetch will both return 404 at runtime. The fix is straightforward: prepend `/api/v1` to both paths.

A secondary gap: the `06-01-SUMMARY.md` file is missing from the phase directory, which is a process gap but does not block functionality.

All other artifacts are substantive, properly wired, and meet the plan specifications. The Zustand store, data hooks, filter pipeline, export menu, reading list CRUD, and all three visualization views are implemented with good code quality, immutable patterns, proper cleanup, and bilingual i18n support.

---

_Verified: 2026-03-16_
_Verifier: Claude (gsd-verifier)_
