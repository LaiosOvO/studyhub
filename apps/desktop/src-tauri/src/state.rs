//! Experiment state machine for the desktop agent.
//!
//! Tracks experiment lifecycle from Idle through execution to completion.
//! Uses Mutex for thread-safe access from Tauri commands.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;

/// All possible experiment lifecycle states.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum ExperimentStatus {
    Idle,
    SettingUp {
        plan_id: String,
    },
    RunningBaseline {
        plan_id: String,
    },
    Running {
        plan_id: String,
        round: u32,
        best_metric: f64,
    },
    Paused {
        plan_id: String,
        round: u32,
    },
    Completed {
        plan_id: String,
        rounds: u32,
    },
    Failed {
        plan_id: String,
        error: String,
    },
}

impl Default for ExperimentStatus {
    fn default() -> Self {
        Self::Idle
    }
}

/// Thread-safe experiment state managed by Tauri.
pub struct ExperimentState {
    pub status: Mutex<ExperimentStatus>,
}

impl Default for ExperimentState {
    fn default() -> Self {
        Self {
            status: Mutex::new(ExperimentStatus::default()),
        }
    }
}
