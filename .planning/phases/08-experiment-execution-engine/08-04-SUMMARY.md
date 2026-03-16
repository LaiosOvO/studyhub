---
phase: 08-experiment-execution-engine
plan: 04
subsystem: backend+desktop
tags: [llm-loop, autonomous-experiment, tauri-subprocess, react-controls]

requires:
  - phase: 08-experiment-execution-engine
    provides: DockerRunner, GitManager, metrics (08-02), GPU monitor, sync (08-03)
provides:
  - Autonomous experiment loop with LLM-driven code modification
  - LLM prompt builders for analysis, modification, fix, and guidance
  - Python CLI bridge for Tauri subprocess communication
  - Full Tauri experiment orchestration with subprocess management
  - React ExperimentControl with config form and active controls
  - React IterationLog with color-coded status indicators
affects: [09-experiment-dashboard]

tech-stack:
  added: []
  patterns: [llm-driven-loop, subprocess-json-protocol, stdin-control-signals, frozen-dataclass]

key-files:
  created:
    - backend/app/services/experiment/prompts.py
    - backend/app/services/experiment/loop_agent.py
    - backend/app/services/experiment/cli.py
    - apps/desktop/src/components/ExperimentControl.tsx
    - apps/desktop/src/components/IterationLog.tsx
  modified:
    - apps/desktop/src-tauri/src/commands/experiment.rs
    - apps/desktop/src-tauri/src/state.rs
    - apps/desktop/src-tauri/src/lib.rs
    - apps/desktop/src/App.tsx
    - apps/desktop/src/lib/invoke.ts

key-decisions:
  - "JSON-line protocol for subprocess stdout events (type + data)"
  - "stdin control signals: pause/resume/skip/cancel/guide:<text>"
  - "Frozen dataclass for ExperimentConfig (immutable)"
  - "Bilingual prompt detection for Chinese/English research contexts"
  - "Arc<Mutex<>> for ExperimentState to support Clone in Tauri"

patterns-established:
  - "LLM analyze -> modify -> train -> evaluate -> keep/discard cycle"
  - "Control signal queue for async experiment control"
  - "Subprocess JSON stdout + stdin bidirectional communication"

requirements-completed: [EXPR-04, EXPR-06, EXPR-07, EXPR-10]

duration: 12min
completed: 2026-03-16
---

# Plan 08-04: Autonomous Experiment Loop & Control UI Summary

**LLM-driven autonomous experiment loop with code modification, configurable stopping conditions, pause/resume/skip/guide controls, and React desktop UI**

## Performance

- **Duration:** 12 min
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- LLM prompt builders for analysis, code modification, crash fix, and user guidance
- Autonomous experiment loop with full lifecycle: analyze -> modify -> train -> evaluate -> keep/discard
- Configurable stopping conditions: max rounds, consecutive no-improvement, time budget
- Python CLI bridge with JSON stdout events and stdin control signals
- Tauri subprocess orchestration with signal forwarding
- ExperimentControl component with config form and active controls
- IterationLog component with color-coded status indicators and auto-scroll

## Task Commits

1. **Task 1: LLM prompts and autonomous loop agent** - `fe58cf7` (feat)
2. **Task 2: CLI bridge, Tauri orchestration, and control UI** - `afed4d3` (feat)

## Decisions Made
- JSON-line protocol for subprocess communication (one JSON object per line on stdout)
- Control signals via stdin: simple text protocol (pause/resume/skip/cancel/guide:<text>)
- Frozen dataclass for ExperimentConfig ensures immutability throughout loop
- Bilingual prompt support detects Chinese characters in plan context

## Deviations from Plan
- Added Arc<Mutex<>> wrapper for ExperimentState (needed Clone for Tauri state sharing)
- ExperimentControl uses dynamic import for skip/guidance (consistency with other handlers)

## Issues Encountered
- ExperimentState needed Clone trait - resolved by wrapping inner Mutex in Arc

## User Setup Required
None - all components are self-contained.

## Next Phase Readiness
- Full experiment execution engine ready for Phase 9 dashboard integration
- All 10 EXPR requirements addressed across Plans 08-01a through 08-04

---
*Phase: 08-experiment-execution-engine*
*Completed: 2026-03-16*
