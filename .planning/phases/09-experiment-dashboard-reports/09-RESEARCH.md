# Phase 9: Experiment Dashboard & Reports - Research

**Researched:** 2026-03-16
**Domain:** Real-time experiment monitoring, training curve visualization, queue management, auto-generated reports (Markdown + PDF)
**Confidence:** MEDIUM-HIGH

## Summary

Phase 9 bridges the desktop experiment engine (Phase 8) with the web frontend, giving users a real-time dashboard to monitor experiment progress and auto-generated publishable reports when experiments complete. The phase has two distinct sub-domains: (1) a **real-time dashboard** with training curves, iteration comparison, and queue management on the Next.js web app, and (2) a **report generation pipeline** on the Python backend that produces structured Markdown+PDF experiment reports with auto-generated figures.

The existing codebase already provides most of the backend infrastructure: `ExperimentRun` model with `rounds` JSON column storing per-iteration metrics, a `sync_experiment_status` REST endpoint for desktop-to-web state push, a WebSocket endpoint polling experiment status every 2 seconds, and a Jinja2-based report generation pattern from Phase 5. The primary new work is: (a) building React dashboard components with charting, (b) adding a Valkey pub/sub layer for true real-time push (replacing the 2s polling WebSocket), (c) implementing experiment queue ordering in the backend, and (d) building the report generator with matplotlib chart generation and WeasyPrint PDF conversion.

**Primary recommendation:** Use Recharts for dashboard charts (already React-native, simplest integration with existing Next.js stack), Valkey pub/sub to push sync updates to WebSocket subscribers in real-time, and the Jinja2 + matplotlib + WeasyPrint pipeline for report generation (extending the existing Phase 5 report_generator pattern).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-01 | User can view experiment progress (current round, best metrics, improvement over baseline) | ExperimentRun model already stores all needed fields; build React dashboard page reading from existing GET /experiments/{run_id} endpoint |
| DASH-02 | System displays training curves and metric evolution across iterations | rounds JSON column has per-iteration metric_value; render with Recharts LineChart on frontend |
| DASH-03 | User can compare results across experiment iterations in a table | rounds data already in ExperimentRunResponse.rounds; build sortable React table component |
| DASH-04 | Experiment queue management (add, reorder, cancel queued experiments) | Add queue_position column to ExperimentRun; new reorder endpoint with positional updates |
| DASH-05 | Desktop experiment status syncs to web dashboard in real-time | Existing sync endpoint + Valkey pub/sub channel per run_id; WebSocket subscribes to channel for instant push |
| REPT-01 | System auto-generates structured experiment report after completion | Trigger report generation in sync endpoint when status transitions to "completed" |
| REPT-02 | Report includes: abstract, methodology, results table, training curves, ablation analysis, conclusion | Jinja2 Markdown template with sections; LLM generates abstract and conclusion from experiment data |
| REPT-03 | Report available in Markdown and PDF format | Jinja2 renders Markdown; WeasyPrint converts HTML (from markdown) to PDF |
| REPT-04 | Figures and charts auto-generated from experiment data | matplotlib generates training curve PNG, metric comparison bar chart, ablation heatmap; embedded in report |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Recharts | 2.x | Training curves, metric charts on web dashboard | React-native, component-based, 3.6M+ weekly downloads, simplest integration with Next.js |
| matplotlib | 3.x | Server-side chart generation for PDF reports | De facto Python visualization standard; headless Agg backend for server rendering |
| WeasyPrint | 62.x+ | Markdown-to-PDF conversion via HTML intermediary | Handles CSS styling, embedded images, academic formatting; actively maintained |
| markdown (Python) | 3.x | Markdown-to-HTML conversion for WeasyPrint input | Standard Python markdown parser; tables and code extensions built-in |
| Jinja2 | 3.x (existing) | Report template rendering | Already in stack from Phase 5 literature review generation |
| Valkey pub/sub | (existing) | Real-time sync event broadcasting | Already in stack; pub/sub channels for per-experiment status push |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zustand | 5.x (existing) | Dashboard state management | Experiment dashboard store (selected run, filter state, queue order) |
| next-intl | 4.x (existing) | Bilingual dashboard labels | Chinese/English dashboard UI strings |
| Pillow | 10.x | Image manipulation for report figures if needed | Resizing/compositing chart images before embedding |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts | Nivo | More beautiful defaults but heavier bundle; Recharts simpler API for line/bar charts needed here |
| Recharts | Visx | Maximum control but steep learning curve; overkill for standard training curves |
| WeasyPrint | fpdf2 | Lighter but poor CSS support; WeasyPrint handles complex academic layouts better |
| WeasyPrint | Pandoc+LaTeX | More powerful typesetting but huge dependency (texlive); WeasyPrint is Python-native |
| matplotlib | Plotly (Python) | Interactive HTML charts but we need static PNGs for PDF embedding; matplotlib is simpler |
| Valkey pub/sub | SSE (Server-Sent Events) | Simpler protocol but WebSocket already established in codebase; pub/sub adds instant push to existing WS |

**Installation:**

Backend (Python):
```bash
uv add weasyprint markdown matplotlib Pillow
```

Frontend (Next.js):
```bash
npm add recharts
npm add -D @types/recharts  # if available
```

## Architecture Patterns

### Recommended Project Structure

```
apps/web/src/
├── app/[locale]/(auth)/experiments/
│   ├── page.tsx                    # Experiment list + queue management
│   └── [runId]/
│       ├── page.tsx                # Single experiment dashboard
│       └── report/page.tsx         # Report viewer (Markdown rendered)
├── components/experiments/
│   ├── ExperimentDashboard.tsx     # Main dashboard layout
│   ├── ProgressSummary.tsx         # Round, metrics, improvement cards
│   ├── TrainingCurveChart.tsx      # Recharts line chart for metrics
│   ├── IterationTable.tsx          # Sortable iteration comparison table
│   ├── QueueManager.tsx            # Drag-reorder experiment queue
│   └── ReportViewer.tsx            # Markdown report display
├── stores/
│   └── experiment-store.ts         # Zustand store for dashboard state
└── lib/api/
    └── experiments.ts              # API client for experiment endpoints

backend/app/
├── services/experiment/
│   ├── report_generator.py         # NEW: Experiment report via Jinja2
│   ├── chart_generator.py          # NEW: matplotlib chart PNG generation
│   └── (existing files)
├── templates/
│   └── experiment_report.md.j2     # NEW: Jinja2 report template
└── routers/
    └── experiments.py              # Extended with queue + report endpoints
```

### Pattern 1: Valkey Pub/Sub for Real-Time Sync (DASH-05)

**What:** When desktop agent sends sync payload, backend publishes to a Valkey channel. WebSocket subscribers receive updates instantly instead of polling.
**When to use:** DASH-05 (real-time desktop-to-web sync).

```python
# Backend: publish on sync
async def sync_experiment_status(run_id, payload, valkey_client):
    # ... update DB (existing) ...
    # Publish to Valkey channel for WebSocket subscribers
    channel = f"experiment:{run_id}"
    await valkey_client.publish(channel, payload.model_dump_json())

# Backend: WebSocket subscribes to Valkey channel
async def experiment_ws(websocket, run_id, valkey_client):
    await websocket.accept()
    pubsub = valkey_client.pubsub()
    await pubsub.subscribe(f"experiment:{run_id}")

    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                await websocket.send_text(message["data"])
    finally:
        await pubsub.unsubscribe(f"experiment:{run_id}")
```

### Pattern 2: Recharts Training Curve Component

**What:** React component rendering metric evolution from experiment rounds data.
**When to use:** DASH-02 (training curves and metric evolution).

```tsx
// Source: Recharts docs - LineChart
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface TrainingCurveProps {
  rounds: Array<{
    round: number;
    metric_value: number | null;
    status: string;
  }>;
  metricName: string;
}

function TrainingCurveChart({ rounds, metricName }: TrainingCurveProps) {
  // Filter out crash rounds (no metric) and transform data
  const data = rounds
    .filter(r => r.metric_value !== null)
    .map(r => ({
      round: r.round,
      value: r.metric_value,
      status: r.status,
    }));

  return (
    <LineChart width={600} height={300} data={data}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="round" label={{ value: 'Round', position: 'bottom' }} />
      <YAxis label={{ value: metricName, angle: -90, position: 'left' }} />
      <Tooltip />
      <Legend />
      <Line type="monotone" dataKey="value" stroke="#8884d8" dot={{ fill: '#8884d8' }} />
    </LineChart>
  );
}
```

### Pattern 3: Server-Side Chart Generation for Reports (REPT-04)

**What:** matplotlib generates static PNG charts from experiment data for embedding in PDF reports.
**When to use:** REPT-04 (auto-generated figures and charts).

```python
# Reference: AI-Scientist figure generation pattern
import matplotlib
matplotlib.use("Agg")  # Headless backend
import matplotlib.pyplot as plt
from pathlib import Path

def generate_training_curve_png(
    rounds: list[dict],
    metric_name: str,
    output_path: Path,
) -> Path:
    """Generate training curve PNG from experiment rounds.

    Pure function: reads rounds data, writes PNG file.
    Returns path to generated image.
    """
    valid_rounds = [r for r in rounds if r.get("metric_value") is not None]
    x = [r["round"] for r in valid_rounds]
    y = [r["metric_value"] for r in valid_rounds]
    colors = ["green" if r["status"] == "keep" else "red" for r in valid_rounds]

    fig, ax = plt.subplots(figsize=(8, 4))
    ax.plot(x, y, marker="o", linewidth=1.5, color="#4A90D9")
    ax.scatter(x, y, c=colors, s=40, zorder=5)
    ax.set_xlabel("Round")
    ax.set_ylabel(metric_name)
    ax.set_title(f"Training Curve: {metric_name}")
    ax.grid(True, alpha=0.3)

    fig.tight_layout()
    fig.savefig(str(output_path), dpi=150, bbox_inches="tight")
    plt.close(fig)

    return output_path
```

### Pattern 4: Report Generation Pipeline (REPT-01 to REPT-03)

**What:** End-to-end pipeline: collect experiment data -> generate charts -> render Jinja2 template -> convert to PDF.
**When to use:** REPT-01 through REPT-04 combined.

```python
async def generate_experiment_report(
    run: ExperimentRun,
    plan: ExperimentPlan,
    language: str = "zh",
) -> tuple[str, bytes]:
    """Generate Markdown + PDF report for a completed experiment.

    Returns (markdown_string, pdf_bytes).
    Reference: Phase 5 report_generator pattern + AI-Scientist perform_writeup.
    """
    import tempfile
    from pathlib import Path

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        # Step 1: Generate chart PNGs
        curve_path = generate_training_curve_png(run.rounds, run.best_metric_name, tmp / "curve.png")
        comparison_path = generate_comparison_chart_png(run.rounds, tmp / "comparison.png")

        # Step 2: LLM generates abstract + conclusion from results
        abstract = await llm_generate_abstract(run, plan)
        conclusion = await llm_generate_conclusion(run, plan)

        # Step 3: Render Jinja2 Markdown template
        markdown = render_report_template(run, plan, abstract, conclusion, curve_path, comparison_path)

        # Step 4: Convert Markdown -> HTML -> PDF
        pdf_bytes = markdown_to_pdf(markdown, image_dir=tmp)

    return markdown, pdf_bytes
```

### Anti-Patterns to Avoid

- **Polling WebSocket for real-time sync:** The existing 2s polling WebSocket is acceptable for single-viewer use, but with DASH-05 requiring real-time sync, use Valkey pub/sub to push updates. Polling wastes server resources and adds latency.
- **Client-side chart generation for PDF reports:** Never use browser-based chart libraries (Recharts, etc.) for PDF report charts. Use matplotlib server-side for deterministic, high-quality PNG output.
- **Storing reports as files without DB reference:** Always store report metadata (generation time, format, SeaweedFS path) in the ExperimentRun config or a dedicated column. Reports must be retrievable via API.
- **Synchronous report generation in API handler:** Report generation (LLM calls + chart rendering + PDF conversion) is slow. Trigger it as a background task or Temporal activity, not inline in the sync endpoint.
- **Mutating experiment queue order in place:** Queue reordering must create new position values, not shift existing records. Use fractional positioning or gap-based integers for efficient reordering.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Training curve charts (web) | Custom SVG/Canvas drawing | Recharts LineChart | Handles axes, tooltips, legends, responsiveness out of the box |
| Training curve charts (PDF) | Custom PIL image generation | matplotlib | Handles scientific chart formatting, proper axis scaling, legend placement |
| Markdown to PDF | String concatenation + custom PDF writer | WeasyPrint (via markdown -> HTML) | CSS styling, page breaks, image embedding, font handling all solved |
| Real-time pub/sub | Custom in-memory broadcast | Valkey pub/sub | Already in stack; handles multiple WebSocket servers, survives restarts |
| Drag-and-drop queue reorder | Custom drag event handling | @dnd-kit/core (or similar) | Accessible, touch-friendly, React-native drag-and-drop |
| Sortable data table | Custom sort/filter implementation | HTML table + CSS (Tailwind) or @tanstack/react-table | Sorting, pagination, column resize are surprisingly complex edge cases |

**Key insight:** This phase is primarily a **presentation layer** -- the hard data infrastructure (experiment runs, metrics, sync protocol) already exists from Phase 8. The risk is underestimating the frontend polish work (responsive charts, drag-and-drop queue, PDF formatting) and the async pipeline orchestration for report generation.

## Common Pitfalls

### Pitfall 1: WeasyPrint System Dependencies
**What goes wrong:** WeasyPrint fails to install or render due to missing system libraries (cairo, pango, gdk-pixbuf).
**Why it happens:** WeasyPrint depends on C libraries not bundled with pip. Docker environments may lack them.
**How to avoid:** Add system deps to Dockerfile: `apt-get install -y libcairo2 libpango-1.0-0 libgdk-pixbuf2.0-0 libffi-dev`. Test PDF generation in Docker early.
**Warning signs:** `OSError: cannot load library 'libcairo.so.2'` or blank PDF output.

### Pitfall 2: matplotlib Memory Leaks in Long-Running Server
**What goes wrong:** matplotlib figures accumulate in memory if not properly closed, causing server OOM.
**Why it happens:** `plt.figure()` creates objects that persist until explicitly closed with `plt.close(fig)`.
**How to avoid:** Always use `try/finally` with `plt.close(fig)`. Use the Agg backend (non-interactive). Consider generating charts in a subprocess for isolation.
**Warning signs:** Gradually increasing memory usage on the backend server after multiple report generations.

### Pitfall 3: WebSocket Connection Limits
**What goes wrong:** Too many concurrent WebSocket connections exhaust server file descriptors or memory.
**Why it happens:** Each experiment dashboard viewer opens a WebSocket; if experiments run for hours, connections stay open.
**How to avoid:** Set connection timeouts. Implement heartbeat/keepalive. Fall back to polling if connection count exceeds threshold. Use Valkey pub/sub so a single subscriber can broadcast to multiple WebSocket clients.
**Warning signs:** Connection refused errors, increasing "too many open files" log entries.

### Pitfall 4: Chart Image Paths in PDF
**What goes wrong:** Images referenced in Markdown don't appear in the generated PDF.
**Why it happens:** WeasyPrint resolves image paths relative to the HTML base URL. Temporary file paths don't work after cleanup.
**How to avoid:** Use base64-encoded inline images in the HTML, or ensure the temp directory persists until PDF generation completes. Alternatively, use `file://` URLs with absolute paths.
**Warning signs:** PDF renders but with broken image placeholders.

### Pitfall 5: Queue Reorder Race Conditions
**What goes wrong:** Two users (or rapid clicks) reorder the queue simultaneously, resulting in duplicate or lost positions.
**Why it happens:** Read-modify-write cycle on queue positions without locking.
**How to avoid:** Use a single atomic UPDATE query with position swapping. Or use fractional positioning (e.g., position = (before + after) / 2) so reordering is a single-row update.
**Warning signs:** Experiments appearing in wrong order, duplicate position values.

### Pitfall 6: Recharts Bundle Size
**What goes wrong:** Importing Recharts increases the Next.js bundle significantly (~200KB gzipped).
**Why it happens:** Recharts pulls in d3 modules and SVG rendering code.
**How to avoid:** Use dynamic imports (`next/dynamic`) with `ssr: false` for chart components. Only load Recharts on dashboard pages, not the entire app.
**Warning signs:** Lighthouse performance score drops; initial page load slows down.

## Code Examples

### Valkey Pub/Sub Integration in Sync Endpoint

```python
# Extend existing sync endpoint to publish via Valkey
from valkey.asyncio import Valkey

async def sync_experiment_status(
    run_id: str,
    body: ExperimentSyncPayload,
    session: AsyncSession,
    valkey: Valkey,
) -> ExperimentRunResponse:
    # ... existing DB update logic ...

    # Publish real-time update to Valkey channel
    channel = f"experiment:{run_id}"
    progress_data = {
        "run_id": run.id,
        "status": run.status,
        "current_round": run.current_round,
        "best_metric_value": run.best_metric_value,
        "baseline_metric_value": run.baseline_metric_value,
        "rounds": run.rounds,
        "gpu_metrics": body.gpu_metrics.model_dump() if body.gpu_metrics else None,
    }
    await valkey.publish(channel, json.dumps(progress_data))

    return ExperimentRunResponse.model_validate(run)
```

### Experiment Queue Reorder with Fractional Positioning

```python
# Add queue_position to ExperimentRun model
# queue_position: float, default=0.0, indexed

async def reorder_experiment_queue(
    user_id: str,
    run_id: str,
    after_run_id: str | None,
    before_run_id: str | None,
    session: AsyncSession,
) -> None:
    """Move run_id between after_run_id and before_run_id.

    Uses fractional positioning for O(1) reorder.
    """
    after_pos = 0.0
    before_pos = float("inf")

    if after_run_id:
        after_run = await _get_run(session, after_run_id, user_id)
        after_pos = after_run.queue_position

    if before_run_id:
        before_run = await _get_run(session, before_run_id, user_id)
        before_pos = before_run.queue_position

    new_pos = (after_pos + before_pos) / 2.0

    run = await _get_run(session, run_id, user_id)
    # Immutable update pattern
    run.queue_position = new_pos
    run.updated_at = datetime.now(timezone.utc)
    await session.commit()
```

### WeasyPrint PDF Generation

```python
import markdown
from weasyprint import HTML

def markdown_to_pdf(md_content: str, image_dir: Path | None = None) -> bytes:
    """Convert Markdown string to PDF bytes via WeasyPrint.

    Handles embedded images via base_url pointing to image directory.
    """
    # Convert Markdown to HTML
    html_body = markdown.markdown(
        md_content,
        extensions=["tables", "fenced_code", "toc"],
    )

    # Wrap in full HTML document with CSS styling
    full_html = f"""<!DOCTYPE html>
    <html>
    <head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: 'Noto Sans SC', 'Noto Sans', sans-serif; margin: 2cm; line-height: 1.6; }}
        h1 {{ font-size: 24pt; margin-bottom: 12pt; }}
        h2 {{ font-size: 18pt; margin-top: 18pt; }}
        table {{ border-collapse: collapse; width: 100%; margin: 12pt 0; }}
        th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
        th {{ background-color: #f5f5f5; }}
        img {{ max-width: 100%; height: auto; }}
        code {{ background-color: #f5f5f5; padding: 2px 4px; }}
        pre {{ background-color: #f5f5f5; padding: 12px; overflow-x: auto; }}
    </style>
    </head>
    <body>{html_body}</body>
    </html>"""

    base_url = str(image_dir) if image_dir else None
    return HTML(string=full_html, base_url=base_url).write_pdf()
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling WebSocket (2s interval) | Valkey pub/sub + WebSocket push | Recommended for Phase 9 | Instant updates, lower server load |
| Manual experiment reports | LLM-assisted auto-generation | 2025-2026 (AI-Scientist pattern) | Structured reports with auto-generated prose |
| LaTeX PDF generation | WeasyPrint (HTML/CSS to PDF) | 2024+ | No TeX dependency; CSS-based styling; better for web-integrated systems |
| Chart.js for React apps | Recharts or Visx | 2023+ | Recharts is React-native; Chart.js requires wrapper |
| Static experiment logs | Real-time streaming dashboards | 2024+ (W&B, MLflow pattern) | Users expect live training curve updates |

**Deprecated/outdated:**
- **pdfkit (wkhtmltopdf)**: Requires headless Chromium/wkhtmltopdf binary; WeasyPrint is pure-Python C-library approach, lighter
- **reportlab for Markdown**: Low-level PDF API; WeasyPrint handles layout automatically
- **Chart.js with react-chartjs-2**: Recharts provides better React integration without wrapper overhead

## Open Questions

1. **Drag-and-drop library for queue management**
   - What we know: @dnd-kit/core is the modern React DnD solution. react-beautiful-dnd is in maintenance mode.
   - What's unclear: Whether @dnd-kit supports React 19 (the project uses React 19.1).
   - Recommendation: Use @dnd-kit/core if React 19 compatible. Fallback: implement simple up/down buttons for reordering (simpler, more accessible). Research @dnd-kit React 19 support during planning.

2. **Report generation trigger mechanism**
   - What we know: Reports should auto-generate when experiments complete. The sync endpoint knows when status becomes "completed".
   - What's unclear: Whether to use Temporal workflow (heavier, reliable) or a simple background task (lighter, less resilient).
   - Recommendation: Use a simple `asyncio.create_task` background job triggered from the sync endpoint. Report generation is idempotent and can be retried manually. Temporal overhead not justified for a single async operation.

3. **Chinese font support in WeasyPrint PDFs**
   - What we know: WeasyPrint uses system fonts. Chinese characters need Noto Sans SC or similar CJK font installed.
   - What's unclear: Whether the Docker container has CJK fonts pre-installed.
   - Recommendation: Add `fonts-noto-cjk` to the Dockerfile's `apt-get install` line. Test with Chinese content early.

4. **SeaweedFS storage for generated reports**
   - What we know: SeaweedFS (S3-compatible) already stores PDFs from Phase 1. Reports should be stored there.
   - What's unclear: Whether to store both Markdown and PDF, or generate PDF on-demand from stored Markdown.
   - Recommendation: Store both Markdown (for editing/re-rendering) and PDF (for download) in SeaweedFS. Store the S3 keys in ExperimentRun.config under `report_markdown_key` and `report_pdf_key`.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `ExperimentRun` model, `experiments.py` router, `experiment/metrics.py`, `report_generator.py` (Phase 5) -- verified by reading source files
- [Recharts docs](https://recharts.org/) -- React charting library, verified feature set
- [WeasyPrint docs](https://doc.courtbouillon.org/weasyprint/) -- HTML/CSS to PDF conversion
- [matplotlib Agg backend](https://matplotlib.org/stable/users/explain/figure/backends.html) -- headless chart generation

### Secondary (MEDIUM confidence)
- [Querio: React Chart Libraries 2026](https://querio.ai/articles/top-react-chart-libraries-data-visualization) -- Recharts comparison
- [md2pdf PyPI](https://pypi.org/project/md2pdf/) -- Markdown + WeasyPrint pipeline pattern
- AI-Scientist `perform_writeup.py` -- report generation pattern with figures (verified via source file)
- autoresearch `program.md` -- experiment results format (verified via source file)

### Tertiary (LOW confidence)
- @dnd-kit React 19 compatibility -- not verified with official source; needs validation during implementation
- WeasyPrint Docker system dependency list -- based on common patterns, should be verified with test build

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Recharts, matplotlib, WeasyPrint are well-established; existing codebase patterns directly extensible
- Architecture: MEDIUM-HIGH - Dashboard is straightforward; Valkey pub/sub pattern well-understood; report pipeline has clear reference in Phase 5
- Pitfalls: HIGH - WeasyPrint deps, matplotlib memory, WebSocket limits are well-documented issues

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (all libraries are stable; Recharts and WeasyPrint ecosystems move slowly)
