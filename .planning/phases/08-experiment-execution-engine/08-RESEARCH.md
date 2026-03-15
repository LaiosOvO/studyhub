# Phase 8: Experiment Execution Engine - Research

**Researched:** 2026-03-16
**Domain:** Desktop agent (Tauri), autonomous experiment loop, Docker sandboxing, GPU monitoring
**Confidence:** MEDIUM

## Summary

Phase 8 introduces a fundamentally new dimension to StudyHub: a **Tauri v2 desktop application** that connects to the web platform and runs autonomous experiment loops on the user's local GPU. This is the most architecturally complex phase so far because it spans three runtime environments (desktop app, Docker container, web backend) and introduces a new codebase (Rust + TypeScript for Tauri).

The experiment loop follows the pattern established by Karpathy's **autoresearch** (March 2026): LLM analyzes current results, proposes code modifications, the system runs training in a sandboxed container, evaluates metrics, and keeps or discards changes via git commits. AI-Scientist provides the complementary pattern of using **aider** (LLM code editor) to drive multi-run experiment sequences with baseline comparison.

**Primary recommendation:** Build the Tauri desktop agent as a thin orchestration layer that delegates experiment execution to Docker containers with GPU passthrough, communicates with the web backend via WebSocket for status sync, and uses LiteLLM (already in the stack) for the LLM-driven code modification loop.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXPR-01 | Desktop agent (Tauri) manages experiment execution on user's local GPU | Tauri v2 with Rust backend commands, shell plugin for Docker/git subprocess management |
| EXPR-02 | System sets up isolated experiment environment (git branch, dependencies, data download) | Git operations via subprocess, Docker image build with pip install, dataset download activity |
| EXPR-03 | System reproduces baseline first, confirming metrics match reported values | Autoresearch pattern: run baseline first, record val_bpb equivalent before any modifications |
| EXPR-04 | Autonomous experiment loop: LLM analyzes, generates improvement, modifies code, trains, evaluates, keeps/discards | Autoresearch loop + AI-Scientist perform_experiments pattern via LiteLLM |
| EXPR-05 | Each iteration tracked with git commit, metrics recorded in results.tsv | Autoresearch git-based tracking pattern with TSV logging |
| EXPR-06 | User can set stopping conditions (max rounds, consecutive rounds without improvement, time budget) | Config struct with stopping criteria, checked at each loop iteration |
| EXPR-07 | User can manually guide the experiment loop (suggest specific changes to try) | WebSocket message from frontend injected as next prompt override |
| EXPR-08 | Experiment code execution is sandboxed in Docker containers with restricted filesystem/network | docker-py with device_requests for GPU, restricted network mode, bind-mounted workspace |
| EXPR-09 | GPU utilization, memory, and temperature displayed in real-time | pynvml (nvidia-ml-py) polling inside container, metrics streamed via stdout to Tauri |
| EXPR-10 | User can pause, resume, and skip experiment iterations | State machine in Tauri Rust backend with pause/resume/skip commands from frontend |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tauri v2 | 2.x (stable since Oct 2024) | Desktop app framework | Rust-based, small binary, native OS integration, capability-based permissions |
| @tauri-apps/api | 2.x | Frontend JS bindings for Tauri | Official package for invoke/events IPC |
| @tauri-apps/plugin-shell | 2.x | Sidecar and subprocess management | Official plugin for executing Docker/git commands |
| @tauri-apps/plugin-websocket | 2.x | WebSocket to web backend | Official plugin for bidirectional sync with StudyHub server |
| docker-py | 7.x | Docker container management from Python | Standard Python Docker SDK; GPU via device_requests |
| nvidia-ml-py | 12.x | GPU monitoring (pynvml) | Official NVIDIA Python bindings for NVML; underlies nvidia-smi |
| LiteLLM | (existing) | LLM calls for code modification agent | Already in stack from Phase 1; unified Claude/GPT interface |
| gitpython | 3.x | Git operations from Python | Standard for programmatic git branch/commit/reset |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tauri-plugin-store | 2.x | Persistent key-value storage in Tauri | Store experiment configs, auth tokens locally |
| serde / serde_json | 1.x | Rust serialization | All IPC data structures in Tauri backend |
| tokio | 1.x | Async runtime for Rust | Tauri backend async commands |
| thiserror | 2.x | Rust error types | Command error handling following Tauri v2 pattern |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Tauri | Electron | 10x larger binary, more memory; Tauri mandated by project spec |
| docker-py | Direct Docker CLI via subprocess | docker-py gives structured output; CLI simpler but harder to parse |
| gitpython | subprocess git calls | gitpython has richer API; subprocess is lighter with fewer edge cases |
| pynvml | nvidia-smi parsing | pynvml is the API nvidia-smi uses; more reliable and structured |
| Aider (AI-Scientist approach) | Custom LLM code editor | Aider adds heavy dependency; custom editor with LiteLLM is lighter and more controllable |

**Installation:**

Tauri desktop app (separate package):
```bash
# Tauri CLI
cargo install tauri-cli
# Create project with React frontend
npm create tauri-app@latest -- --template react-ts
# Add plugins
cargo add tauri-plugin-shell tauri-plugin-websocket tauri-plugin-store
npm add @tauri-apps/plugin-shell @tauri-apps/plugin-websocket @tauri-apps/plugin-store
```

Python experiment runner (runs inside Docker or as process):
```bash
uv add docker gitpython nvidia-ml-py
```

## Architecture Patterns

### Recommended Project Structure

```
apps/
├── web/                     # Existing Next.js frontend
└── desktop/                 # NEW: Tauri desktop agent
    ├── src/                 # React frontend (experiment UI)
    │   ├── components/      # GPU monitor, iteration log, controls
    │   ├── hooks/           # useExperiment, useGpuMetrics
    │   └── lib/             # Tauri invoke wrappers
    ├── src-tauri/           # Rust backend
    │   ├── src/
    │   │   ├── lib.rs       # Tauri commands registration
    │   │   ├── commands/    # experiment, docker, git, gpu commands
    │   │   ├── state.rs     # ExperimentState machine
    │   │   └── sync.rs      # WebSocket sync with web backend
    │   ├── Cargo.toml
    │   └── tauri.conf.json
    └── package.json

backend/app/
├── services/
│   └── experiment/          # NEW: Experiment execution service
│       ├── __init__.py
│       ├── runner.py        # Docker container lifecycle
│       ├── loop_agent.py    # LLM-driven experiment loop
│       ├── git_manager.py   # Branch/commit/reset operations
│       ├── gpu_monitor.py   # pynvml metrics collection
│       ├── metrics.py       # Results parsing and recording
│       └── prompts.py       # LLM prompts for code modification
├── schemas/
│   └── experiment.py        # Experiment run schemas
├── models/
│   └── experiment_run.py    # ExperimentRun SQLAlchemy model
└── routers/
    └── experiments.py       # Experiment REST + WebSocket endpoints
```

### Pattern 1: Autoresearch Experiment Loop

**What:** An infinite loop where an LLM modifies code, runs training, evaluates metrics, and keeps/discards changes via git.
**When to use:** Core of EXPR-04 (autonomous experiment loop).

```python
# Adapted from autoresearch program.md + AI-Scientist perform_experiments.py
async def run_experiment_loop(
    config: ExperimentConfig,
    workspace: Path,
    on_iteration: Callable,  # callback for status updates
) -> ExperimentResult:
    """Autonomous experiment loop.

    Reference: autoresearch/program.md loop, AI-Scientist/perform_experiments.py
    """
    git = GitManager(workspace)
    runner = DockerRunner(workspace, config.gpu_device)

    # Step 1: Establish baseline (EXPR-03)
    baseline = await runner.run_training(workspace / "train.py")
    if baseline.crashed:
        return ExperimentResult(status="baseline_failed")
    git.commit(f"baseline: {baseline.metric_value}")
    results = [baseline]

    # Step 2: Loop (EXPR-04)
    round_num = 0
    consecutive_no_improve = 0
    best_metric = baseline.metric_value

    while not should_stop(config, round_num, consecutive_no_improve):
        # Check pause/resume/skip (EXPR-10)
        action = await check_control_signal()
        if action == "pause":
            await wait_for_resume()
        elif action == "skip":
            continue

        # LLM proposes modification
        prompt = build_analysis_prompt(results, config.user_guidance)
        modification = await llm_propose_change(prompt)

        # Apply modification to code
        apply_code_change(workspace, modification)
        git.commit(f"experiment {round_num}: {modification.description}")

        # Run training in Docker (EXPR-08)
        run_result = await runner.run_training(workspace / "train.py")

        if run_result.crashed:
            git.reset_to_previous()
            results.append(run_result._replace(status="crash"))
        elif run_result.metric_value < best_metric:
            best_metric = run_result.metric_value
            consecutive_no_improve = 0
            results.append(run_result._replace(status="keep"))
        else:
            git.reset_to_previous()
            consecutive_no_improve += 1
            results.append(run_result._replace(status="discard"))

        await on_iteration(round_num, results[-1])
        round_num += 1

    return ExperimentResult(rounds=results, best_metric=best_metric)
```

### Pattern 2: Tauri Command IPC

**What:** Rust commands invoked from React frontend for experiment control.
**When to use:** All desktop agent interactions (EXPR-01, EXPR-10).

```rust
// Source: https://v2.tauri.app/develop/calling-rust/
use serde::{Deserialize, Serialize};
use tauri::State;
use std::sync::Mutex;

#[derive(Clone, Serialize)]
pub struct ExperimentStatus {
    pub round: u32,
    pub best_metric: f64,
    pub current_status: String, // "running", "paused", "completed"
    pub gpu_utilization: f32,
    pub gpu_memory_mb: u64,
    pub gpu_temp_c: u32,
}

pub struct ExperimentState(pub Mutex<Option<ExperimentStatus>>);

#[tauri::command]
async fn start_experiment(
    config: ExperimentConfig,
    state: State<'_, ExperimentState>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    // Launch experiment in background task
    // Emit progress events to frontend
    Ok("experiment_started".to_string())
}

#[tauri::command]
async fn pause_experiment(
    state: State<'_, ExperimentState>,
) -> Result<(), String> {
    // Set pause flag in state machine
    Ok(())
}
```

### Pattern 3: Docker Container with GPU Passthrough

**What:** Programmatic Docker container creation with NVIDIA GPU access.
**When to use:** EXPR-08 (sandboxed execution).

```python
# Source: docker-py docs + NVIDIA Container Toolkit
import docker
from docker.types import DeviceRequest

def create_experiment_container(
    workspace_path: str,
    gpu_device: int = 0,
    image: str = "studyhub/experiment-runner:latest",
) -> docker.models.containers.Container:
    client = docker.from_env()
    return client.containers.run(
        image=image,
        command="python train.py",
        volumes={
            workspace_path: {"bind": "/workspace", "mode": "rw"},
        },
        device_requests=[
            DeviceRequest(
                device_ids=[str(gpu_device)],
                capabilities=[["gpu", "compute", "utility"]],
            )
        ],
        network_mode="none",  # No network access for sandboxing
        mem_limit="32g",
        shm_size="8g",  # Required for PyTorch DataLoader
        working_dir="/workspace",
        detach=True,
        stdout=True,
        stderr=True,
    )
```

### Pattern 4: Tauri-to-Web Sync via WebSocket

**What:** Desktop agent syncs experiment status to web backend in real-time.
**When to use:** EXPR-09 (GPU metrics display), connecting to Phase 9 dashboard.

```typescript
// Frontend (Tauri React app)
import WebSocket from '@tauri-apps/plugin-websocket';

async function syncToWebBackend(token: string) {
  const ws = await WebSocket.connect(
    `wss://api.studyhub.local/ws/experiment-sync?token=${token}`
  );

  // Listen for local experiment updates via Tauri events
  // Forward them to web backend
  await listen('experiment-progress', (event) => {
    ws.send(JSON.stringify(event.payload));
  });
}
```

### Anti-Patterns to Avoid

- **Running training directly in Tauri process:** Always use Docker containers. Training code can be malicious or resource-hungry; sandboxing is essential.
- **Polling for GPU metrics:** Use event-driven streaming from container stdout, not polling nvidia-smi as a subprocess.
- **Storing experiment state only in memory:** All experiment state must survive Tauri app restart. Use sqlite (via tauri-plugin-store) and git history as ground truth.
- **Monolithic Tauri backend:** Split commands into modules (experiment, docker, git, gpu) -- Rust files get complex fast.
- **Synchronous Docker operations:** Always use async/background threads for container lifecycle -- blocking the Tauri main thread freezes the UI.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Git operations | Custom git CLI parser | gitpython | Branch/commit/reset/diff have many edge cases |
| GPU monitoring | nvidia-smi output parser | pynvml (nvidia-ml-py) | pynvml IS the API behind nvidia-smi; structured data |
| Docker management | Shell subprocess docker commands | docker-py with DeviceRequest | Structured API, proper error handling, GPU passthrough |
| LLM code editing | Custom diff/patch system | LLM generates full file or targeted edits + apply | AI-Scientist uses aider; we use LiteLLM with targeted edit prompts |
| Desktop app framework | Electron or custom webview | Tauri v2 | Project spec mandates Tauri; smaller, faster, more secure |
| Process management in Tauri | Custom IPC protocol | Tauri shell plugin + events | Official plugin handles subprocess lifecycle correctly |

**Key insight:** The experiment loop itself is conceptually simple (autoresearch is ~100 lines of loop logic). The complexity is in the plumbing: Docker GPU passthrough, process lifecycle management, state synchronization across desktop and web, and graceful error recovery. Use established libraries for every plumbing concern.

## Common Pitfalls

### Pitfall 1: Docker GPU Setup Fragility
**What goes wrong:** NVIDIA Container Toolkit not installed, docker-py DeviceRequest silently ignored, wrong CUDA version in base image.
**Why it happens:** GPU Docker setup has host-level dependencies (nvidia-ctk, driver version) that the app cannot control.
**How to avoid:** Build a pre-flight check that validates: (1) Docker daemon running, (2) nvidia-smi accessible, (3) nvidia-ctk installed, (4) test container with GPU runs successfully. Surface clear error messages for each failure mode.
**Warning signs:** Container starts but training runs on CPU; "CUDA not available" errors in container logs.

### Pitfall 2: Git State Corruption in Experiment Loop
**What goes wrong:** Concurrent modifications, uncommitted changes, merge conflicts when resetting.
**Why it happens:** The loop modifies files, commits, and sometimes resets. If the process crashes mid-operation, git state can be inconsistent.
**How to avoid:** Always ensure clean working tree before each iteration. Use `git stash` as safety net. Log every git operation. Consider using git worktrees for isolation from the user's main repo.
**Warning signs:** "detached HEAD" state, uncommitted changes after a crash recovery.

### Pitfall 3: Tauri IPC Serialization Limits
**What goes wrong:** Large data (training logs, model weights, full git diffs) sent via Tauri commands causes slowdowns or crashes.
**Why it happens:** Tauri IPC serializes to JSON; events evaluate JavaScript directly. Neither is designed for large payloads.
**How to avoid:** Stream large data via files (not IPC). Use Tauri events for small status updates only. For GPU metrics, send summary stats (utilization %, memory MB, temperature) not raw NVML data.
**Warning signs:** UI freezes when experiment produces verbose output; memory usage climbing in Tauri process.

### Pitfall 4: Container Zombie Processes
**What goes wrong:** Docker containers not properly stopped/removed after experiment completes or user pauses.
**Why it happens:** If Tauri app crashes or user force-quits, container cleanup code never runs.
**How to avoid:** Use Docker container labels for tracking. On app startup, scan for orphaned StudyHub containers and offer cleanup. Set container auto-remove flag. Use timeouts.
**Warning signs:** `docker ps` shows old experiment containers still running, GPU memory occupied by dead experiments.

### Pitfall 5: LLM Code Modification Hallucinations
**What goes wrong:** LLM generates syntactically broken code, references nonexistent imports, or makes changes that crash immediately.
**Why it happens:** LLM doesn't have perfect understanding of the codebase; generates plausible but incorrect modifications.
**How to avoid:** Follow AI-Scientist pattern: if code crashes, feed error back to LLM for up to MAX_ITERS fix attempts. Use syntax validation before committing. Keep the training script self-contained (autoresearch pattern: single file).
**Warning signs:** Many consecutive "crash" status entries in results.tsv; the same error repeating across fix attempts.

### Pitfall 6: Shared Memory (shm) Size for PyTorch
**What goes wrong:** PyTorch DataLoader workers crash with "bus error" inside Docker container.
**Why it happens:** Docker default shm_size is 64MB; PyTorch multiprocessing needs much more.
**How to avoid:** Always set `shm_size="8g"` (or appropriate fraction of RAM) when creating containers.
**Warning signs:** "Bus error" or "Killed" messages in container logs during data loading.

## Code Examples

### GPU Metrics Collection with pynvml

```python
# Source: https://pypi.org/project/nvidia-ml-py/ + pynvml examples
import pynvml

def get_gpu_metrics(device_index: int = 0) -> dict:
    """Collect GPU metrics for real-time display (EXPR-09)."""
    pynvml.nvmlInit()
    handle = pynvml.nvmlDeviceGetHandleByIndex(device_index)

    utilization = pynvml.nvmlDeviceGetUtilizationRates(handle)
    memory = pynvml.nvmlDeviceGetMemoryInfo(handle)
    temperature = pynvml.nvmlDeviceGetTemperature(
        handle, pynvml.NVML_TEMPERATURE_GPU
    )
    power = pynvml.nvmlDeviceGetPowerUsage(handle)  # milliwatts
    name = pynvml.nvmlDeviceGetName(handle)

    pynvml.nvmlShutdown()

    return {
        "name": name,
        "gpu_utilization_pct": utilization.gpu,
        "memory_used_mb": memory.used // (1024 * 1024),
        "memory_total_mb": memory.total // (1024 * 1024),
        "temperature_c": temperature,
        "power_watts": power / 1000.0,
    }
```

### Experiment Results Parsing (Autoresearch Pattern)

```python
# Reference: autoresearch/program.md output format
import re

def parse_training_output(log_text: str) -> dict | None:
    """Parse structured output from training script."""
    results = {}
    for line in log_text.splitlines():
        match = re.match(r"^(\w+):\s+(.+)$", line.strip())
        if match:
            key, value = match.group(1), match.group(2)
            try:
                results[key] = float(value)
            except ValueError:
                results[key] = value
    if "val_bpb" not in results and not results:
        return None  # crash -- no output
    return results
```

### Tauri Event Streaming for GPU Metrics

```rust
// Emit GPU metrics to React frontend every second
use tauri::Emitter;
use std::time::Duration;

#[tauri::command]
async fn start_gpu_monitoring(
    app: tauri::AppHandle,
    device_id: u32,
) -> Result<(), String> {
    tauri::async_runtime::spawn(async move {
        loop {
            // Call Python GPU monitor via subprocess or shared state
            let metrics = collect_gpu_metrics(device_id).await;
            let _ = app.emit("gpu-metrics", &metrics);
            tokio::time::sleep(Duration::from_secs(1)).await;
        }
    });
    Ok(())
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual experiment tracking | Git-based auto-tracking (autoresearch) | March 2026 | Each iteration = 1 commit; results.tsv as log |
| Aider for code editing | Direct LLM API + targeted prompts | 2025-2026 | Lighter dependency; more control over edit format |
| nvidia-docker wrapper | NVIDIA Container Toolkit + device_requests | 2023+ | nvidia-docker deprecated; use nvidia-ctk directly |
| Tauri v1 (allowlist) | Tauri v2 (capabilities + plugins) | Oct 2024 | Modular plugins, better security model |
| pynvml (gpuopenanalytics) | nvidia-ml-py (official) | 2025+ | pynvml wrapper deprecated; nvidia-ml-py is the official package |

**Deprecated/outdated:**
- **nvidia-docker**: Replaced by NVIDIA Container Toolkit
- **pynvml (gpuopenanalytics/pynvml)**: Deprecated; use nvidia-ml-py directly
- **Tauri v1 allowlist system**: Replaced by capabilities-based permissions in v2

## Open Questions

1. **Tauri app distribution strategy**
   - What we know: Tauri v2 produces platform-specific binaries. Users need Docker + NVIDIA drivers pre-installed.
   - What's unclear: How to handle the onboarding flow (install Docker, install NVIDIA toolkit, configure GPU access) from within the Tauri app.
   - Recommendation: Build a setup wizard in the Tauri app that checks prerequisites and provides links/instructions. Do NOT try to auto-install system-level dependencies.

2. **LLM code modification approach**
   - What we know: AI-Scientist uses aider (heavy dependency). Autoresearch uses Claude Code directly.
   - What's unclear: Whether to use whole-file replacement or diff-based editing for the experiment scripts.
   - Recommendation: Start with whole-file replacement for single-file experiments (autoresearch pattern). Add diff-based editing later for multi-file projects. Use LiteLLM to keep LLM provider flexible.

3. **Shared Tauri frontend vs embedded web**
   - What we know: The existing web app is Next.js. Tauri uses a webview that can load any web content.
   - What's unclear: Whether to build a separate React app for desktop or embed/iframe the existing Next.js app.
   - Recommendation: Build a **separate lightweight React app** for the Tauri frontend focused on experiment control. Share component library with Next.js app if feasible, but keep them independent -- desktop UI has very different needs (GPU dashboard, terminal output, local file management).

4. **Multi-GPU experiment support**
   - What we know: docker-py DeviceRequest supports device_ids for specific GPUs. pynvml can enumerate all GPUs.
   - What's unclear: Whether to support running multiple experiments in parallel on different GPUs in v1.
   - Recommendation: v1 supports single-GPU only. Multi-GPU is explicitly listed as v2 requirement (EXPR-V2-03). Enumerate GPUs and let user select one.

5. **Workspace isolation strategy**
   - What we know: Experiments need isolated git branches and dependencies.
   - What's unclear: Whether to clone the repo into a temp directory or use git worktrees.
   - Recommendation: Clone into a dedicated workspace directory (`~/.studyhub/experiments/<plan_id>/`). Cleaner isolation than worktrees, avoids git lock contention.

## Sources

### Primary (HIGH confidence)
- [Tauri v2 official docs](https://v2.tauri.app/) - IPC, commands, sidecar, shell plugin, WebSocket plugin
- [Tauri v2 calling Rust](https://v2.tauri.app/develop/calling-rust/) - Command patterns, state management, error handling
- [Tauri v2 sidecar docs](https://v2.tauri.app/develop/sidecar/) - External binary embedding and permissions
- [Docker GPU support docs](https://docs.docker.com/compose/how-tos/gpu-support/) - Docker Compose GPU configuration
- [nvidia-ml-py PyPI](https://pypi.org/project/nvidia-ml-py/) - Official NVIDIA Python bindings, v12.x Jan 2026

### Secondary (MEDIUM confidence)
- [autoresearch repo](https://github.com/karpathy/autoresearch) - Experiment loop pattern (March 2026, verified via source files)
- [AI-Scientist repo](https://github.com/SakanaAI/AI-Scientist) - perform_experiments.py pattern (verified via source files)
- [docker-py GPU issue #2395](https://github.com/docker/docker-py/issues/2395) - DeviceRequest workaround for GPU containers
- [NVIDIA Container Toolkit docs](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/docker-specialized.html) - Runtime configuration

### Tertiary (LOW confidence)
- Community reports on Tauri v2 + React production templates - not verified with official benchmarks
- nvdocker PyPI package as alternative to docker-py - not verified for active maintenance

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM - Tauri v2 is well-documented but this project has not used it before; Docker GPU via docker-py has known quirks
- Architecture: MEDIUM - Autoresearch and AI-Scientist patterns are well-understood from source; integration across Tauri + Docker + Web is novel
- Pitfalls: HIGH - Well-documented across Docker GPU, git state management, and LLM code editing domains

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (Tauri ecosystem moves fast; Docker GPU stack is stable)
