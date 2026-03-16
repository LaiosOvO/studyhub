//! Tauri commands for experiment lifecycle management.
//!
//! Provides get_status, start, pause, resume, and cancel operations
//! with state machine transition validation.

use tauri::State;

use crate::state::{ExperimentState, ExperimentStatus};

/// Get the current experiment status.
#[tauri::command]
pub fn get_status(state: State<'_, ExperimentState>) -> Result<ExperimentStatus, String> {
    let status = state
        .status
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {e}"))?;
    Ok(status.clone())
}

/// Start a new experiment. Sets status to SettingUp.
/// Actual execution orchestration is wired in Plan 08-04.
#[tauri::command]
pub fn start_experiment(
    plan_id: String,
    _config: serde_json::Value,
    state: State<'_, ExperimentState>,
) -> Result<String, String> {
    let mut status = state
        .status
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {e}"))?;

    match &*status {
        ExperimentStatus::Idle => {
            *status = ExperimentStatus::SettingUp {
                plan_id: plan_id.clone(),
            };
            Ok(format!("Experiment started for plan {plan_id}"))
        }
        _ => Err("Cannot start experiment: not in Idle state".to_string()),
    }
}

/// Pause a running experiment. Transitions Running -> Paused.
#[tauri::command]
pub fn pause_experiment(state: State<'_, ExperimentState>) -> Result<(), String> {
    let mut status = state
        .status
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {e}"))?;

    match &*status {
        ExperimentStatus::Running {
            plan_id, round, ..
        } => {
            *status = ExperimentStatus::Paused {
                plan_id: plan_id.clone(),
                round: *round,
            };
            Ok(())
        }
        _ => Err("Cannot pause: experiment is not running".to_string()),
    }
}

/// Resume a paused experiment. Transitions Paused -> Running.
#[tauri::command]
pub fn resume_experiment(state: State<'_, ExperimentState>) -> Result<(), String> {
    let mut status = state
        .status
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {e}"))?;

    match &*status {
        ExperimentStatus::Paused { plan_id, round } => {
            *status = ExperimentStatus::Running {
                plan_id: plan_id.clone(),
                round: *round,
                best_metric: 0.0,
            };
            Ok(())
        }
        _ => Err("Cannot resume: experiment is not paused".to_string()),
    }
}

/// Cancel the current experiment. Transitions any active state -> Idle.
#[tauri::command]
pub fn cancel_experiment(state: State<'_, ExperimentState>) -> Result<(), String> {
    let mut status = state
        .status
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {e}"))?;

    match &*status {
        ExperimentStatus::Idle
        | ExperimentStatus::Completed { .. }
        | ExperimentStatus::Failed { .. } => {
            Err("No active experiment to cancel".to_string())
        }
        _ => {
            *status = ExperimentStatus::Idle;
            Ok(())
        }
    }
}
