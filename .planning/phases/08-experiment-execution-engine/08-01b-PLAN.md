---
phase: 08-experiment-execution-engine
plan: 01b
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/desktop/package.json
  - apps/desktop/src-tauri/Cargo.toml
  - apps/desktop/src-tauri/tauri.conf.json
  - apps/desktop/src-tauri/capabilities/default.json
  - apps/desktop/src-tauri/src/lib.rs
  - apps/desktop/src-tauri/src/commands/mod.rs
  - apps/desktop/src-tauri/src/commands/experiment.rs
  - apps/desktop/src-tauri/src/state.rs
  - apps/desktop/src/App.tsx
  - apps/desktop/src/main.tsx
  - apps/desktop/src/lib/invoke.ts
  - apps/desktop/index.html
  - apps/desktop/tsconfig.json
  - apps/desktop/vite.config.ts
autonomous: true
requirements:
  - EXPR-01

must_haves:
  truths:
    - "Tauri desktop app builds and launches showing a connection screen"
    - "Tauri Rust backend has experiment state machine with status transitions"
  artifacts:
    - path: "apps/desktop/src-tauri/src/lib.rs"
      provides: "Tauri app entry with command registration"
    - path: "apps/desktop/src-tauri/src/state.rs"
      provides: "ExperimentState machine"
  key_links:
    - from: "apps/desktop/src-tauri/src/lib.rs"
      to: "apps/desktop/src-tauri/src/commands/experiment.rs"
      via: "Tauri command registration"
      pattern: "start_experiment"
---

<objective>
Create the Tauri v2 desktop application scaffold with experiment state machine, React shell, and typed invoke wrappers.

Purpose: Establish the desktop app foundation that all subsequent plans (GPU monitoring, sync, experiment control) build upon.
Output: Tauri v2 desktop app with Rust state machine and React shell.
</objective>

<execution_context>
@/Users/admin/.claude/get-shit-done/workflows/execute-plan.md
@/Users/admin/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/08-experiment-execution-engine/08-RESEARCH.md

<interfaces>
From backend/app/schemas/experiment.py (Plan 08-01a -- created in parallel):
```python
class ExperimentRunCreate(BaseModel):
    plan_id: str
    gpu_device: int = 0
    max_rounds: int = 20
    consecutive_no_improve_limit: int = 5
    time_budget_minutes: int | None = None
    docker_image: str | None = None
```
Note: The Tauri app does NOT import from the Python backend. It communicates via REST API and WebSocket. The schemas above are for reference to keep types aligned.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Tauri v2 Rust backend with state machine and commands</name>
  <files>
    apps/desktop/src-tauri/Cargo.toml
    apps/desktop/src-tauri/tauri.conf.json
    apps/desktop/src-tauri/capabilities/default.json
    apps/desktop/src-tauri/src/lib.rs
    apps/desktop/src-tauri/src/commands/mod.rs
    apps/desktop/src-tauri/src/commands/experiment.rs
    apps/desktop/src-tauri/src/state.rs
  </files>
  <action>
    **Tauri Rust backend:**

    `src-tauri/Cargo.toml`: Dependencies -- tauri (2.x with features: []), tauri-plugin-shell (2.x), tauri-plugin-websocket (2.x), tauri-plugin-store (2.x), serde (1.x with derive), serde_json (1.x), tokio (1.x with full features), thiserror (2.x). Use edition = "2021".

    `src-tauri/tauri.conf.json`: Standard Tauri v2 config with:
    - identifier: "com.studyhub.desktop"
    - productName: "StudyHub Agent"
    - app.windows[0]: title "StudyHub Experiment Agent", width 1200, height 800
    - build.devUrl: "http://localhost:1420"
    - build.frontendDist: "../dist"

    `src-tauri/capabilities/default.json`: Tauri v2 capabilities granting permissions for shell (execute, sidecar), websocket (connect), store (get, set, delete), and core (window, event).

    `src-tauri/src/state.rs`: Define ExperimentState:
    ```rust
    pub struct ExperimentState {
        pub status: Mutex<ExperimentStatus>,
    }
    pub enum ExperimentStatus {
        Idle,
        SettingUp { plan_id: String },
        RunningBaseline { plan_id: String },
        Running { plan_id: String, round: u32, best_metric: f64 },
        Paused { plan_id: String, round: u32 },
        Completed { plan_id: String, rounds: u32 },
        Failed { plan_id: String, error: String },
    }
    ```
    Derive Clone, Serialize for ExperimentStatus. ExperimentState uses Mutex for thread-safe access.

    `src-tauri/src/commands/experiment.rs`: Tauri commands:
    - `get_status(state: State<ExperimentState>) -> Result<ExperimentStatus, String>`: Returns current status
    - `start_experiment(plan_id: String, config: serde_json::Value, state: State<ExperimentState>) -> Result<String, String>`: Sets status to SettingUp, returns confirmation. (Actual execution wired in Plan 08-04.)
    - `pause_experiment(state: State<ExperimentState>) -> Result<(), String>`: Transitions Running->Paused
    - `resume_experiment(state: State<ExperimentState>) -> Result<(), String>`: Transitions Paused->Running
    - `cancel_experiment(state: State<ExperimentState>) -> Result<(), String>`: Transitions to Idle

    `src-tauri/src/commands/mod.rs`: Re-export experiment commands.

    `src-tauri/src/lib.rs`:
    - Register ExperimentState as managed state
    - Register plugins: tauri_plugin_shell, tauri_plugin_websocket, tauri_plugin_store
    - Register commands: get_status, start_experiment, pause_experiment, resume_experiment, cancel_experiment
    - Standard `run()` function entry point

    **IMPORTANT:** Do NOT use `npm create tauri-app` -- manually create all files to control exact structure.
  </action>
  <verify>
    <automated>cd /Users/admin/ai/self-dev/study-community/apps/desktop/src-tauri && test -f Cargo.toml && test -f tauri.conf.json && test -f src/lib.rs && test -f src/state.rs && test -f src/commands/experiment.rs && python3 -c "
import json
with open('tauri.conf.json') as f:
    conf = json.load(f)
ident = conf.get('identifier', conf.get('app', {}).get('identifier', ''))
assert 'studyhub' in ident.lower(), f'Unexpected identifier: {ident}'
print('All Tauri files exist and config is valid')
"</automated>
  </verify>
  <done>Tauri v2 Rust backend with 7-state experiment state machine, 5 Tauri commands, plugins registered</done>
</task>

<task type="auto">
  <name>Task 2: React frontend shell with typed invoke wrappers</name>
  <files>
    apps/desktop/package.json
    apps/desktop/index.html
    apps/desktop/vite.config.ts
    apps/desktop/tsconfig.json
    apps/desktop/src/main.tsx
    apps/desktop/src/App.tsx
    apps/desktop/src/lib/invoke.ts
  </files>
  <action>
    **React frontend (apps/desktop/src/):**

    `package.json`: Dependencies -- react, react-dom, @tauri-apps/api (2.x), @tauri-apps/plugin-shell (2.x), @tauri-apps/plugin-websocket (2.x), @tauri-apps/plugin-store (2.x). Dev deps: vite, @vitejs/plugin-react, typescript.

    `index.html`: Standard Vite HTML entry with div#root.

    `vite.config.ts`: Standard Vite config with React plugin. Set server port to 1420 to match Tauri devUrl.

    `tsconfig.json`: Standard TypeScript config targeting ES2020, moduleResolution bundler.

    `src/lib/invoke.ts`: Typed wrappers around Tauri invoke:
    - `getExperimentStatus(): Promise<ExperimentStatus>`
    - `startExperiment(planId: string, config: object): Promise<string>`
    - `pauseExperiment(): Promise<void>`
    - `resumeExperiment(): Promise<void>`
    - `cancelExperiment(): Promise<void>`
    Define TypeScript types matching Rust ExperimentStatus enum.

    `src/App.tsx`: Minimal shell showing:
    - Connection status section (URL input for web backend, connect button)
    - Current experiment status display (calls getExperimentStatus on interval)
    - Placeholder sections for "Experiment Control" and "GPU Monitor" (wired in later plans)

    `src/main.tsx`: Standard React root render.

    **IMPORTANT:** The Tauri app is a NEW codebase under apps/desktop/, completely separate from the Next.js web app.
  </action>
  <verify>
    <automated>cd /Users/admin/ai/self-dev/study-community/apps/desktop && test -f package.json && test -f src/App.tsx && test -f src/lib/invoke.ts && python3 -c "
import json
with open('package.json') as f:
    pkg = json.load(f)
deps = {**pkg.get('dependencies', {}), **pkg.get('devDependencies', {})}
assert 'react' in deps, 'Missing react dependency'
assert '@tauri-apps/api' in deps, 'Missing @tauri-apps/api dependency'
print('React app files exist and package.json is valid')
"</automated>
  </verify>
  <done>React frontend shell with typed invoke wrappers for all Tauri commands, connection UI, and placeholder sections</done>
</task>

</tasks>

<verification>
1. Desktop: All Tauri source files exist under apps/desktop/src-tauri/src/
2. Desktop: React app files exist under apps/desktop/src/
3. Tauri config is valid JSON with correct identifier (behavioral check)
4. package.json has required dependencies (behavioral check)
</verification>

<success_criteria>
- Tauri v2 desktop app scaffold compiles (Cargo.toml valid, all .rs files parse)
- React frontend has typed invoke wrappers for all Tauri commands
- State machine covers all experiment lifecycle states
- Config JSON is valid with correct identifier and window settings
</success_criteria>

<output>
After completion, create `.planning/phases/08-experiment-execution-engine/08-01b-SUMMARY.md`
</output>
