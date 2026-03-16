//! StudyHub Desktop Agent - Tauri v2 application entry point.
//!
//! Registers plugins, managed state, and commands for the
//! experiment execution engine desktop companion.

mod commands;
mod state;

use commands::experiment::ProcessState;
use commands::gpu::GpuMonitorState;
use commands::sync::SyncState;
use state::ExperimentState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_websocket::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(ExperimentState::default())
        .manage(ProcessState::default())
        .manage(GpuMonitorState::default())
        .manage(SyncState::default())
        .invoke_handler(tauri::generate_handler![
            // Experiment lifecycle
            commands::experiment::get_status,
            commands::experiment::start_experiment,
            commands::experiment::pause_experiment,
            commands::experiment::resume_experiment,
            commands::experiment::cancel_experiment,
            commands::experiment::skip_iteration,
            commands::experiment::send_guidance,
            // GPU monitoring
            commands::gpu::get_gpu_info,
            commands::gpu::start_gpu_monitoring,
            commands::gpu::stop_gpu_monitoring,
            // Backend sync
            commands::sync::connect_backend,
            commands::sync::disconnect_backend,
            commands::sync::send_sync,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
