//! Tauri commands for GPU monitoring via Python pynvml subprocess.
//!
//! Spawns the Python gpu_monitor.py script and streams JSON metrics
//! as Tauri events to the frontend.

use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::task::JoinHandle;

/// State tracking the GPU monitoring background task.
pub struct GpuMonitorState {
    pub task_handle: Mutex<Option<JoinHandle<()>>>,
}

impl Default for GpuMonitorState {
    fn default() -> Self {
        Self {
            task_handle: Mutex::new(None),
        }
    }
}

/// Get GPU info by running the monitor script once.
#[tauri::command]
pub async fn get_gpu_info() -> Result<serde_json::Value, String> {
    let output = tokio::process::Command::new("python")
        .args(["-c", "
import json
try:
    import pynvml
    pynvml.nvmlInit()
    count = pynvml.nvmlDeviceGetCount()
    driver = pynvml.nvmlSystemGetDriverVersion()
    gpus = []
    for i in range(count):
        h = pynvml.nvmlDeviceGetHandleByIndex(i)
        name = pynvml.nvmlDeviceGetName(h)
        mem = pynvml.nvmlDeviceGetMemoryInfo(h)
        gpus.append({
            'index': i,
            'name': name if isinstance(name, str) else name.decode('utf-8'),
            'memory_total_mb': mem.total // (1024 * 1024),
            'driver_version': driver if isinstance(driver, str) else driver.decode('utf-8'),
        })
    pynvml.nvmlShutdown()
    print(json.dumps(gpus))
except Exception:
    print(json.dumps([]))
"])
        .output()
        .await
        .map_err(|e| format!("Failed to run GPU info script: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(stdout.trim())
        .map_err(|e| format!("Failed to parse GPU info: {e}"))
}

/// Start GPU monitoring in background, emitting "gpu-metrics" events.
#[tauri::command]
pub async fn start_gpu_monitoring(
    device_id: u32,
    app: AppHandle,
    state: State<'_, GpuMonitorState>,
) -> Result<(), String> {
    // Stop any existing monitoring
    if let Ok(mut handle) = state.task_handle.lock() {
        if let Some(h) = handle.take() {
            h.abort();
        }
    }

    let app_handle = app.clone();
    let task = tokio::spawn(async move {
        use tokio::io::{AsyncBufReadExt, BufReader};
        use tokio::process::Command;

        let mut child = match Command::new("python")
            .args([
                "-m",
                "app.services.experiment.gpu_monitor",
                &device_id.to_string(),
                "1.0",
            ])
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null())
            .spawn()
        {
            Ok(child) => child,
            Err(e) => {
                eprintln!("Failed to start GPU monitor: {e}");
                return;
            }
        };

        if let Some(stdout) = child.stdout.take() {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();

            while let Ok(Some(line)) = lines.next_line().await {
                if let Ok(metrics) = serde_json::from_str::<serde_json::Value>(&line) {
                    let _ = app_handle.emit("gpu-metrics", metrics);
                }
            }
        }
    });

    if let Ok(mut handle) = state.task_handle.lock() {
        *handle = Some(task);
    }

    Ok(())
}

/// Stop GPU monitoring background task.
#[tauri::command]
pub fn stop_gpu_monitoring(state: State<'_, GpuMonitorState>) -> Result<(), String> {
    if let Ok(mut handle) = state.task_handle.lock() {
        if let Some(h) = handle.take() {
            h.abort();
        }
    }
    Ok(())
}
