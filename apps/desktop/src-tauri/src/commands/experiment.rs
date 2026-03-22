//! Tauri commands for experiment lifecycle management.
//!
//! Provides get_status, start, pause, resume, skip, guidance,
//! and cancel operations with state machine transitions.
//! Orchestrates the Python experiment loop via subprocess.

use std::process::Stdio;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::task::JoinHandle;

use crate::state::{ExperimentState, ExperimentStatus};

/// State holding the experiment subprocess handle.
pub struct ProcessState {
    pub handle: Mutex<Option<JoinHandle<()>>>,
    pub stdin_tx: Mutex<Option<tokio::sync::mpsc::Sender<String>>>,
}

impl Default for ProcessState {
    fn default() -> Self {
        Self {
            handle: Mutex::new(None),
            stdin_tx: Mutex::new(None),
        }
    }
}

/// Get the current experiment status.
#[tauri::command]
pub fn get_status(state: State<'_, ExperimentState>) -> Result<ExperimentStatus, String> {
    let status = state
        .status
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {e}"))?;
    Ok(status.clone())
}

/// Start a new experiment. Spawns the Python loop subprocess.
#[tauri::command]
pub async fn start_experiment(
    plan_id: String,
    config: serde_json::Value,
    app: AppHandle,
    state: State<'_, ExperimentState>,
    proc_state: State<'_, ProcessState>,
) -> Result<String, String> {
    // Validate state is Idle
    {
        let mut status = state
            .status
            .lock()
            .map_err(|e| format!("Lock error: {e}"))?;
        match &*status {
            ExperimentStatus::Idle => {
                *status = ExperimentStatus::SettingUp {
                    plan_id: plan_id.clone(),
                };
            }
            _ => return Err("Cannot start experiment: not in Idle state".to_string()),
        }
    }

    let run_id = uuid_simple();
    let max_rounds = config
        .get("max_rounds")
        .and_then(|v| v.as_u64())
        .unwrap_or(20) as u32;
    let gpu_device = config
        .get("gpu_device")
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as u32;
    let no_improve_limit = config
        .get("consecutive_no_improve_limit")
        .and_then(|v| v.as_u64())
        .unwrap_or(5) as u32;

    let plan_id_clone = plan_id.clone();
    let run_id_clone = run_id.clone();
    let app_handle = app.clone();

    // Create stdin channel
    let (stdin_tx, mut stdin_rx) = tokio::sync::mpsc::channel::<String>(32);
    if let Ok(mut tx_lock) = proc_state.stdin_tx.lock() {
        *tx_lock = Some(stdin_tx);
    }

    // Spawn subprocess in background
    let exp_state = app.state::<ExperimentState>().inner().clone();
    let task = tokio::spawn(async move {
        let mut child = match tokio::process::Command::new("python")
            .args([
                "-m",
                "app.services.experiment.cli",
                "--plan-id",
                &plan_id_clone,
                "--run-id",
                &run_id_clone,
                "--gpu",
                &gpu_device.to_string(),
                "--max-rounds",
                &max_rounds.to_string(),
                "--no-improve-limit",
                &no_improve_limit.to_string(),
            ])
            .stdout(Stdio::piped())
            .stdin(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
        {
            Ok(c) => c,
            Err(e) => {
                eprintln!("Failed to start experiment process: {e}");
                if let Ok(mut status) = exp_state.status.lock() {
                    *status = ExperimentStatus::Failed {
                        plan_id: plan_id_clone,
                        error: format!("Process start failed: {e}"),
                    };
                }
                return;
            }
        };

        // Forward stdin from channel to process
        let mut child_stdin = child.stdin.take();
        tokio::spawn(async move {
            if let Some(ref mut stdin) = child_stdin {
                while let Some(msg) = stdin_rx.recv().await {
                    let _ = stdin.write_all(msg.as_bytes()).await;
                    let _ = stdin.write_all(b"\n").await;
                    let _ = stdin.flush().await;
                }
            }
        });

        // Read stdout for JSON events
        if let Some(stdout) = child.stdout.take() {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();

            while let Ok(Some(line)) = lines.next_line().await {
                if let Ok(event) = serde_json::from_str::<serde_json::Value>(&line) {
                    let event_type = event
                        .get("type")
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    let data = event.get("data").cloned().unwrap_or_default();

                    match event_type {
                        "iteration" => {
                            let _ = app_handle.emit("experiment-iteration", data.clone());

                            // Update state with round info
                            if let Some(round) = data.get("round").and_then(|v| v.as_u64()) {
                                let metric = data
                                    .get("metric_value")
                                    .and_then(|v| v.as_f64())
                                    .unwrap_or(0.0);
                                if let Ok(mut status) = exp_state.status.lock() {
                                    if round > 0 {
                                        *status = ExperimentStatus::Running {
                                            plan_id: plan_id_clone.clone(),
                                            round: round as u32,
                                            best_metric: metric,
                                        };
                                    }
                                }
                            }
                        }
                        "status" => {
                            let _ = app_handle.emit("experiment-status", data.clone());
                            let status_str = data.as_str().unwrap_or("");

                            if let Ok(mut status) = exp_state.status.lock() {
                                match status_str {
                                    "baseline" => {
                                        *status = ExperimentStatus::RunningBaseline {
                                            plan_id: plan_id_clone.clone(),
                                        };
                                    }
                                    "running" => {
                                        *status = ExperimentStatus::Running {
                                            plan_id: plan_id_clone.clone(),
                                            round: 0,
                                            best_metric: 0.0,
                                        };
                                    }
                                    "completed" => {
                                        *status = ExperimentStatus::Completed {
                                            plan_id: plan_id_clone.clone(),
                                            rounds: 0,
                                        };
                                    }
                                    "failed" | "cancelled" => {
                                        *status = ExperimentStatus::Failed {
                                            plan_id: plan_id_clone.clone(),
                                            error: status_str.to_string(),
                                        };
                                    }
                                    _ => {}
                                }
                            }
                        }
                        "error" => {
                            let _ = app_handle.emit("experiment-error", data);
                        }
                        "result" => {
                            let _ = app_handle.emit("experiment-result", data);
                        }
                        _ => {}
                    }
                }
            }
        }

        // Process finished -- ensure terminal state
        let _ = child.wait().await;
        if let Ok(status) = exp_state.status.lock() {
            match &*status {
                ExperimentStatus::Running { .. }
                | ExperimentStatus::SettingUp { .. }
                | ExperimentStatus::RunningBaseline { .. } => {
                    drop(status);
                    if let Ok(mut s) = exp_state.status.lock() {
                        *s = ExperimentStatus::Idle;
                    }
                }
                _ => {}
            }
        }
    });

    if let Ok(mut handle) = proc_state.handle.lock() {
        *handle = Some(task);
    }

    Ok(format!("Experiment {run_id} started for plan {plan_id}"))
}

/// Pause a running experiment.
#[tauri::command]
pub async fn pause_experiment(
    state: State<'_, ExperimentState>,
    proc_state: State<'_, ProcessState>,
) -> Result<(), String> {
    {
        let mut status = state.status.lock().map_err(|e| format!("Lock: {e}"))?;
        match &*status {
            ExperimentStatus::Running { plan_id, round, .. } => {
                *status = ExperimentStatus::Paused {
                    plan_id: plan_id.clone(),
                    round: *round,
                };
            }
            _ => return Err("Not running".to_string()),
        }
    }
    send_signal(&proc_state, "pause").await
}

/// Resume a paused experiment.
#[tauri::command]
pub async fn resume_experiment(
    state: State<'_, ExperimentState>,
    proc_state: State<'_, ProcessState>,
) -> Result<(), String> {
    {
        let mut status = state.status.lock().map_err(|e| format!("Lock: {e}"))?;
        match &*status {
            ExperimentStatus::Paused { plan_id, round } => {
                *status = ExperimentStatus::Running {
                    plan_id: plan_id.clone(),
                    round: *round,
                    best_metric: 0.0,
                };
            }
            _ => return Err("Not paused".to_string()),
        }
    }
    send_signal(&proc_state, "resume").await
}

/// Cancel the current experiment.
#[tauri::command]
pub async fn cancel_experiment(
    state: State<'_, ExperimentState>,
    proc_state: State<'_, ProcessState>,
) -> Result<(), String> {
    send_signal(&proc_state, "cancel").await?;

    // Wait briefly then force idle
    tokio::time::sleep(std::time::Duration::from_secs(2)).await;
    if let Ok(mut status) = state.status.lock() {
        *status = ExperimentStatus::Idle;
    }
    Ok(())
}

/// Skip the current iteration.
#[tauri::command]
pub async fn skip_iteration(
    proc_state: State<'_, ProcessState>,
) -> Result<(), String> {
    send_signal(&proc_state, "skip").await
}

/// Send user guidance to override the next LLM prompt.
#[tauri::command]
pub async fn send_guidance(
    guidance: String,
    proc_state: State<'_, ProcessState>,
) -> Result<(), String> {
    let msg = format!("guide:{guidance}");
    send_signal(&proc_state, &msg).await
}

/// Send a control signal to the Python subprocess via stdin.
async fn send_signal(proc_state: &State<'_, ProcessState>, signal: &str) -> Result<(), String> {
    let tx = {
        let lock = proc_state.stdin_tx.lock().map_err(|e| format!("Lock: {e}"))?;
        lock.clone()
    };

    if let Some(tx) = tx {
        tx.send(signal.to_string())
            .await
            .map_err(|e| format!("Send failed: {e}"))?;
        Ok(())
    } else {
        Err("No active experiment process".to_string())
    }
}

/// Generate a simple UUID-like string.
fn uuid_simple() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    format!("{:x}{:08x}", now.as_secs(), now.subsec_nanos())
}
