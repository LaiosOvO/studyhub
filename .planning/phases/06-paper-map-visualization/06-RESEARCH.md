# Phase 6: Paper Map Visualization - Research

**Researched:** 2026-03-16
**Domain:** Interactive graph/timeline visualization (React, WebGL)
**Confidence:** HIGH

## Summary

Phase 6 transforms the citation graph and deep research data (built in Phases 4-5) into three interactive visual modes: a citation graph (React Flow + D3 force), a topic/cluster map (Deck.gl), and a chronological timeline (vis-timeline). The backend APIs already exist -- `/api/citations/graph/{paper_id}` returns Neo4j neighborhood data (nodes + edges with CITES/RELATED_TO types), and `/api/deep-research/tasks/{id}` returns task metadata including paper analyses with methods, clusters, and quality scores.

The frontend stack (Next.js 15, React 19, Tailwind CSS 4, Zustand 5) is already established from Phase 1. The primary challenge is integrating three different visualization libraries into a cohesive view-switching experience while maintaining performance with graphs of 100-500 nodes (typical deep research output). React Flow handles the interactive citation graph well at this scale with proper memoization. Deck.gl with OrthographicView handles the 2D topic map without requiring a geographic basemap. vis-timeline is mature but its React wrappers are poorly maintained -- a thin ref-based wrapper is safer than depending on community packages.

**Primary recommendation:** Use @xyflow/react (React Flow 12) as the primary graph view with d3-force for layout, deck.gl with OrthographicView + ScatterplotLayer for the topic map, and vis-timeline with a custom React wrapper (no third-party wrapper) for the timeline view.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PMAP-01 | Citation graph with interactive node/edge rendering (React Flow + D3 force layout) | @xyflow/react 12.10 + d3-force; force layout example in official docs |
| PMAP-02 | Node size = citation count, color = research cluster/method family | React Flow custom nodes with dynamic sizing; cluster colors from ANAL-05 relationship classification |
| PMAP-03 | Click node to see paper details (abstract, quality score, methods, key findings) | React Flow Panel component for sidebar; data from `/api/citations/paper/{id}/quality` and task.config.paper_analyses |
| PMAP-04 | Zoom, pan, drag nodes in graph view | Built into React Flow (fitView, zoomOnScroll, panOnDrag, nodesDraggable) |
| PMAP-05 | Filter graph by time range, method type, quality threshold | Zustand filter store; client-side filtering of nodes/edges arrays |
| PMAP-06 | Topic/discipline map showing research clusters as regions (Deck.gl) | deck.gl 9.2 OrthographicView + ScatterplotLayer; cluster positions from embedding coordinates |
| PMAP-07 | Timeline showing key papers chronologically (vis-timeline) | vis-timeline 8.5 with custom React ref wrapper |
| PMAP-08 | Switch between citation graph, topic map, and timeline views | Tab component with lazy-loaded view panels; shared Zustand state |
| PMAP-09 | Export graph data for other tools | Client-side JSON/CSV export; optional PNG via html-to-image |
| PMAP-10 | Save paper collections/reading lists from the map | New ReadingList model in PostgreSQL; CRUD API endpoints |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @xyflow/react | ^12.10 | Citation graph rendering (nodes, edges, interaction) | De facto React graph library; built-in zoom/pan/drag, custom nodes, Panel component |
| d3-force | ^3.0 | Force-directed layout for graph node positioning | Standard physics-based layout; works with React Flow via useEffect simulation |
| deck.gl | ^9.2 | Topic map (2D cluster scatter) | GPU-accelerated WebGL; OrthographicView for non-geo 2D; handles thousands of points |
| @deck.gl/react | ^9.2 | React bindings for deck.gl | Official React wrapper |
| vis-timeline | ^8.5 | Chronological paper timeline | Mature timeline library; supports zoom, pan, groups, ranges |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| d3-scale | ^4.0 | Map citation counts to node sizes and color scales | Node size scaling, quality-to-color mapping |
| d3-scale-chromatic | ^3.0 | Color palettes for clusters | Cluster coloring (schemeTableau10, interpolateViridis) |
| html-to-image | ^1.11 | Export graph as PNG | PMAP-09 export feature |
| @xyflow/react (Panel) | built-in | Detail sidebar overlay on the graph | PMAP-03 paper detail panel |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @xyflow/react | react-force-graph | react-force-graph is canvas-based (better for 1000+ nodes) but lacks built-in UI controls, panels, custom node rendering |
| deck.gl | ECharts scatter | ECharts is simpler but less performant at scale and harder to customize for this specific cluster-region UX |
| vis-timeline | react-chrono | react-chrono is React-native but less flexible for zoom/pan/interactive scholarly timelines |
| Custom vis-timeline wrapper | react-vis-timeline npm | Community wrappers are poorly maintained (last updated 2022), React 19 compatibility unknown |

**Installation:**
```bash
cd apps/web
npm install @xyflow/react d3-force d3-scale d3-scale-chromatic deck.gl @deck.gl/core @deck.gl/layers @deck.gl/react @loaders.gl/core vis-timeline vis-data html-to-image
npm install -D @types/d3-force @types/d3-scale @types/d3-scale-chromatic
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web/src/
├── app/[locale]/
│   └── (auth)/
│       └── research/
│           └── [taskId]/
│               └── map/
│                   └── page.tsx          # Map page (loads task, renders MapView)
├── components/
│   └── paper-map/
│       ├── MapView.tsx                   # View switcher (graph/topic/timeline)
│       ├── graph/
│       │   ├── CitationGraph.tsx         # React Flow wrapper with force layout
│       │   ├── PaperNode.tsx             # Custom node (sized by citations, colored by cluster)
│       │   ├── CitationEdge.tsx          # Custom edge (styled by type: CITES vs RELATED_TO)
│       │   └── useForceLayout.ts         # D3 force simulation hook
│       ├── topic-map/
│       │   ├── TopicMap.tsx              # Deck.gl OrthographicView + ScatterplotLayer
│       │   └── ClusterLabel.tsx          # HTML overlay for cluster names
│       ├── timeline/
│       │   ├── TimelineView.tsx          # vis-timeline wrapper
│       │   └── useVisTimeline.ts         # Custom hook for vis-timeline lifecycle
│       ├── shared/
│       │   ├── PaperDetailPanel.tsx      # Sidebar showing paper details on click
│       │   ├── FilterBar.tsx             # Time range, method type, quality threshold
│       │   ├── ExportMenu.tsx            # JSON, CSV, PNG export
│       │   └── ReadingListDrawer.tsx     # Add/remove papers to reading lists
│       └── hooks/
│           ├── useGraphData.ts           # Fetch + transform graph data from API
│           ├── useFilteredData.ts        # Apply filters to graph/timeline data
│           └── useReadingLists.ts        # CRUD for reading lists
├── stores/
│   └── paper-map-store.ts               # Zustand: selected paper, filters, active view, reading list
└── lib/
    ├── api.ts                            # (existing) apiFetch utility
    └── graph-transforms.ts              # Transform API response to React Flow / Deck.gl / vis-timeline formats
```

### Pattern 1: View Switcher with Shared State
**What:** All three views share a single Zustand store for selected paper, filters, and reading list. Switching views preserves selection and filter state.
**When to use:** Always -- this is the core interaction pattern.
**Example:**
```typescript
// stores/paper-map-store.ts
import { create } from 'zustand';

interface PaperMapState {
  readonly activeView: 'graph' | 'topic' | 'timeline';
  readonly selectedPaperId: string | null;
  readonly filters: {
    readonly yearRange: [number, number] | null;
    readonly methodTypes: readonly string[];
    readonly qualityThreshold: number;
  };
  readonly readingListIds: readonly string[];
  readonly setActiveView: (view: PaperMapState['activeView']) => void;
  readonly selectPaper: (id: string | null) => void;
  readonly setFilters: (filters: Partial<PaperMapState['filters']>) => void;
  readonly toggleReadingList: (paperId: string) => void;
}
```

### Pattern 2: D3 Force Layout with React Flow
**What:** Run d3-force simulation in a useEffect, update React Flow node positions via setNodes on each tick.
**When to use:** Citation graph view (Plan 06-01).
**Example:**
```typescript
// Source: https://reactflow.dev/examples/layout/force-layout
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';

function useForceLayout(initialNodes, initialEdges) {
  const [nodes, setNodes] = useState(initialNodes);

  useEffect(() => {
    const simulation = forceSimulation(initialNodes)
      .force('charge', forceManyBody().strength(-300))
      .force('link', forceLink(initialEdges).id(d => d.id).distance(100))
      .force('center', forceCenter(0, 0))
      .force('collide', forceCollide(50))
      .on('tick', () => {
        setNodes(prev => prev.map((node, i) => ({
          ...node,
          position: { x: simulation.nodes()[i].x, y: simulation.nodes()[i].y },
        })));
      });

    return () => { simulation.stop(); };
  }, [initialNodes, initialEdges]);

  return nodes;
}
```

### Pattern 3: Deck.gl OrthographicView for Non-Geo 2D
**What:** Use OrthographicView instead of MapView to render 2D scatterplot without a basemap.
**When to use:** Topic map view (Plan 06-02).
**Example:**
```typescript
// Source: https://deck.gl/docs/api-reference/core/orthographic-view
import DeckGL from '@deck.gl/react';
import { OrthographicView } from '@deck.gl/core';
import { ScatterplotLayer, TextLayer } from '@deck.gl/layers';

function TopicMap({ papers, clusters }) {
  const layers = [
    new ScatterplotLayer({
      id: 'papers',
      data: papers,
      getPosition: d => [d.x, d.y],         // Pre-computed from embeddings (e.g., t-SNE/UMAP on backend)
      getRadius: d => Math.sqrt(d.citationCount) * 2,
      getFillColor: d => clusterColors[d.clusterId],
      pickable: true,
      onClick: info => selectPaper(info.object.id),
    }),
    new TextLayer({
      id: 'cluster-labels',
      data: clusters,
      getPosition: d => [d.centroidX, d.centroidY],
      getText: d => d.label,
      getSize: 16,
    }),
  ];

  return (
    <DeckGL
      views={new OrthographicView({})}
      initialViewState={{ target: [0, 0], zoom: 0 }}
      layers={layers}
      controller={true}
    />
  );
}
```

### Pattern 4: vis-timeline Custom React Wrapper
**What:** Wrap vis-timeline in a React component using useRef + useEffect. No community wrapper needed.
**When to use:** Timeline view (Plan 06-02).
**Example:**
```typescript
import { useRef, useEffect } from 'react';
import { Timeline } from 'vis-timeline/standalone';
import { DataSet } from 'vis-data/standalone';

function useVisTimeline(containerRef, items, options) {
  const timelineRef = useRef<Timeline | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const dataset = new DataSet(items);
    const timeline = new Timeline(containerRef.current, dataset, options);
    timelineRef.current = timeline;

    return () => { timeline.destroy(); };
  }, []);  // Create once

  // Update items immutably
  useEffect(() => {
    if (timelineRef.current) {
      const dataset = new DataSet(items);
      timelineRef.current.setItems(dataset);
    }
  }, [items]);

  return timelineRef;
}
```

### Anti-Patterns to Avoid
- **Re-creating React Flow nodeTypes on every render:** Define nodeTypes object OUTSIDE the component or wrap with useMemo. Causes full re-mount of all nodes otherwise.
- **Running d3-force inside React render:** Force simulation is iterative and must run in useEffect with cleanup (simulation.stop()).
- **Importing full vis-timeline bundle:** Use `vis-timeline/standalone` and `vis-data/standalone` to avoid moment.js dependency (saves ~300KB).
- **Mutating React Flow node positions:** Always create new node objects with spread operator when updating positions from d3-force.
- **Fetching graph data on every view switch:** Fetch once when entering the map page, store in Zustand, filter client-side.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Graph zoom/pan/drag | Custom canvas with event handlers | React Flow built-in controls | Edge cases: pinch zoom, trackpad, touch, minimap |
| Force-directed layout | Custom physics engine | d3-force | Convergence, collision detection, link strength tuning |
| GPU-accelerated scatter | Canvas 2D manual rendering | deck.gl ScatterplotLayer | WebGL batching, picking, LOD, 60fps at 10K+ points |
| Timeline zoom/scale | Custom date axis + scroll | vis-timeline | Auto date granularity (ms to years), group stacking |
| Image export from DOM | Canvas screenshot hacks | html-to-image | Handles SVG, foreign objects, retina, async fonts |
| Color scales for data | Manual RGB interpolation | d3-scale + d3-scale-chromatic | Perceptually uniform, colorblind-safe palettes |

**Key insight:** Each visualization mode has mature, specialized libraries. The value-add is in the data transformation layer (API response -> visualization format) and the shared interaction model (filters, selection, reading lists), not in rendering primitives.

## Common Pitfalls

### Pitfall 1: React Flow nodeTypes Causes Full Re-render
**What goes wrong:** Passing `nodeTypes={{ paper: PaperNode }}` inline causes React Flow to unmount and remount every node on every parent render.
**Why it happens:** React sees a new object reference each render.
**How to avoid:** Define `const nodeTypes = { paper: PaperNode }` outside the component, or `useMemo(() => ({ paper: PaperNode }), [])`.
**Warning signs:** Flickering nodes, lost drag state, slow interactions.

### Pitfall 2: D3 Force Simulation Memory Leak
**What goes wrong:** Simulation continues running after component unmounts, consuming CPU.
**Why it happens:** No cleanup in useEffect.
**How to avoid:** Return `() => simulation.stop()` from useEffect. Also call `simulation.stop()` when alpha reaches target (layout settled).
**Warning signs:** Growing CPU usage when navigating away from graph view.

### Pitfall 3: vis-timeline moment.js Bundle Bloat
**What goes wrong:** Importing `vis-timeline` pulls in moment.js (~300KB minified).
**Why it happens:** Default vis-timeline entry point depends on moment.
**How to avoid:** Import from `vis-timeline/standalone` which uses native Date.
**Warning signs:** Bundle size spike after adding vis-timeline.

### Pitfall 4: Deck.gl SSR Crash in Next.js
**What goes wrong:** Deck.gl uses WebGL which is unavailable during server-side rendering.
**Why it happens:** Next.js tries to render on server.
**How to avoid:** Use `dynamic(() => import('./TopicMap'), { ssr: false })` for the Deck.gl component.
**Warning signs:** `window is not defined` or `document is not defined` errors on page load.

### Pitfall 5: React Flow Measured Dimensions (v12 Breaking Change)
**What goes wrong:** Custom layout reads `node.width`/`node.height` but gets undefined.
**Why it happens:** React Flow v12 moved dimensions to `node.measured.width` / `node.measured.height`.
**How to avoid:** Always read from `node.measured` for layout calculations. Wait for `onNodesChange` before running force layout.
**Warning signs:** Nodes stacking at origin, NaN positions.

### Pitfall 6: Too Many Re-renders During Force Simulation
**What goes wrong:** Updating 200+ nodes on every tick (60fps) causes jank.
**Why it happens:** Each tick triggers React reconciliation for all nodes.
**How to avoid:** Batch updates: only call setNodes every N ticks (e.g., every 3rd tick) or use requestAnimationFrame. Alternatively, run simulation to completion first, then set final positions.
**Warning signs:** Dropped frames, laggy interaction during initial layout.

## Code Examples

### Fetching and Transforming Graph Data
```typescript
// lib/graph-transforms.ts
import type { Node, Edge } from '@xyflow/react';

interface ApiGraphNode {
  readonly paper_id: string;
  readonly title: string;
  readonly citation_count?: number;
  readonly quality_score?: number;
  readonly year?: number;
  readonly cluster_id?: string;
}

interface ApiGraphResponse {
  readonly nodes: readonly ApiGraphNode[];
  readonly edges: readonly [string, string, string][];  // [from, to, type]
}

export function toReactFlowGraph(api: ApiGraphResponse): {
  readonly nodes: Node[];
  readonly edges: Edge[];
} {
  const nodes: Node[] = api.nodes.map(n => ({
    id: n.paper_id,
    type: 'paper',
    position: { x: 0, y: 0 },  // d3-force will compute
    data: {
      title: n.title,
      citationCount: n.citation_count ?? 0,
      qualityScore: n.quality_score ?? 0,
      year: n.year,
      clusterId: n.cluster_id,
    },
  }));

  const edges: Edge[] = api.edges.map(([from, to, type]) => ({
    id: `${from}-${to}`,
    source: from,
    target: to,
    type: type === 'CITES' ? 'default' : 'straight',
    style: { stroke: type === 'CITES' ? '#6b7280' : '#d97706', strokeDasharray: type === 'RELATED_TO' ? '5,5' : undefined },
    animated: type === 'RELATED_TO',
  }));

  return { nodes, edges };
}
```

### Custom Paper Node Component
```typescript
// components/paper-map/graph/PaperNode.tsx
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

interface PaperNodeData {
  readonly title: string;
  readonly citationCount: number;
  readonly qualityScore: number;
  readonly clusterId: string;
}

const CLUSTER_COLORS: Record<string, string> = {
  '0': '#4e79a7', '1': '#f28e2b', '2': '#e15759',
  '3': '#76b7b2', '4': '#59a14f', '5': '#edc948',
};

function PaperNodeComponent({ data }: NodeProps) {
  const d = data as PaperNodeData;
  const size = Math.max(30, Math.min(80, Math.sqrt(d.citationCount) * 5));
  const color = CLUSTER_COLORS[d.clusterId] ?? '#aab7c4';

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />
      <div
        className="rounded-full flex items-center justify-center text-white text-xs font-medium cursor-pointer shadow-md hover:shadow-lg transition-shadow"
        style={{ width: size, height: size, backgroundColor: color }}
        title={d.title}
      >
        {d.citationCount}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />
    </>
  );
}

export const PaperNode = memo(PaperNodeComponent);
```

### Reading List API (New Backend Endpoint)
```python
# backend/app/routers/reading_lists.py
@router.post("/reading-lists", response_model=ApiResponse[ReadingListResponse])
async def create_reading_list(
    body: ReadingListCreate,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[ReadingListResponse]:
    """Create a new reading list for the authenticated user."""
    reading_list = ReadingList(
        id=uuid.uuid4().hex,
        user_id=user.id,
        name=body.name,
        description=body.description,
        paper_ids=body.paper_ids or [],
    )
    session.add(reading_list)
    await session.commit()
    await session.refresh(reading_list)
    return ApiResponse(success=True, data=ReadingListResponse.model_validate(reading_list))
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `reactflow` package | `@xyflow/react` | 2024 (v12) | New import paths; `node.measured` for dimensions |
| vis-timeline + moment.js | vis-timeline/standalone | 2023 | ~300KB bundle savings |
| deck.gl MapView only | deck.gl OrthographicView | deck.gl 8.x+ | Non-geo 2D scatterplot without basemap dependency |
| Manual WebSocket | Native EventSource / SWR | 2024+ | Simpler for read-only data streams |

**Deprecated/outdated:**
- `reactflow` npm package: Renamed to `@xyflow/react`. Do not install `reactflow`.
- `react-vis-timeline` npm wrapper: Last updated 2022, React 19 compatibility unverified. Write a thin custom wrapper instead.
- `node.width` / `node.height` in React Flow: Moved to `node.measured.width` / `node.measured.height` in v12.

## Open Questions

1. **Topic map cluster positions (embedding coordinates)**
   - What we know: Deck.gl needs pre-computed [x, y] positions for each paper in the topic map. These come from dimensionality reduction (t-SNE or UMAP) on paper embeddings.
   - What's unclear: Whether the backend already stores paper embeddings or cluster assignments from Phase 5 AI analysis. The `paper_analyses` in task.config contain methods and relationships but may not include embedding vectors.
   - Recommendation: Plan 06-02 should include a backend activity that computes 2D coordinates via UMAP on title+abstract embeddings (using sentence-transformers), stored as `x`, `y` in the paper analysis config. This can be a lightweight Temporal activity.

2. **Reading list persistence model**
   - What we know: PMAP-10 requires saving paper collections. No ReadingList model exists yet.
   - What's unclear: Whether reading lists should be stored as a simple JSON array column (like paper_analyses) or a proper relational model with a join table.
   - Recommendation: Use a proper ReadingList model with a JSON `paper_ids` column (list of S2 IDs). Simple, no migration complexity, adequate for v1.

3. **Graph size limits**
   - What we know: React Flow handles ~500 nodes well with memoization. Deep Research tasks produce 100-500 papers typically.
   - What's unclear: Edge cases where users expand aggressively and exceed 500 nodes.
   - Recommendation: Add a frontend limit of 500 visible nodes. Implement progressive disclosure: show top-quality nodes first, let user "reveal more" to expand. This sidesteps React Flow's scaling ceiling.

## Sources

### Primary (HIGH confidence)
- [@xyflow/react npm](https://www.npmjs.com/package/@xyflow/react) - v12.10.1, React Flow 12
- [React Flow Force Layout Example](https://reactflow.dev/examples/layout/force-layout) - d3-force integration pattern
- [React Flow Custom Nodes](https://reactflow.dev/learn/customization/custom-nodes) - custom node types
- [React Flow Performance](https://reactflow.dev/learn/advanced-use/performance) - memoization requirements
- [React Flow Panel Component](https://reactflow.dev/api-reference/components/panel) - overlay UI
- [deck.gl OrthographicView](https://deck.gl/docs/api-reference/core/orthographic-view) - non-geo 2D view
- [deck.gl ScatterplotLayer](https://deck.gl/docs/api-reference/layers/scatterplot-layer) - circle rendering
- [deck.gl React](https://deck.gl/docs/get-started/using-with-react) - React integration
- [vis-timeline docs](https://visjs.github.io/vis-timeline/docs/timeline/) - timeline configuration
- [vis-timeline GitHub](https://github.com/visjs/vis-timeline) - v8.5.0

### Secondary (MEDIUM confidence)
- [React Flow v12 migration](https://reactflow.dev/learn/troubleshooting/migrate-to-v12) - node.measured breaking change
- [React Flow performance discussions](https://github.com/xyflow/xyflow/discussions/4975) - optimization for large graphs
- [deck.gl npm](https://www.npmjs.com/package/deck.gl) - v9.2.11

### Tertiary (LOW confidence)
- [react-vis-timeline npm](https://www.npmjs.com/package/react-vis-timeline) - community wrapper status (not recommended for use)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries verified on npm with current versions, official docs reviewed
- Architecture: HIGH - patterns from React Flow official examples, deck.gl docs, existing project structure
- Pitfalls: HIGH - sourced from React Flow v12 migration guide, community discussions, and deck.gl SSR documentation
- Topic map coordinates: MEDIUM - UMAP/t-SNE approach is standard but backend implementation needs confirmation

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable libraries, 30-day window)
