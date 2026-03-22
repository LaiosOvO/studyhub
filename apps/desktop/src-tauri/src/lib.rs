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
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_websocket::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_http::init())
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
            // AutoResearch local execution
            commands::autoresearch::local_ar_init,
            commands::autoresearch::local_ar_write_code,
            commands::autoresearch::local_ar_execute,
            commands::autoresearch::local_ar_decide,
            commands::autoresearch::local_ar_read_file,
            commands::autoresearch::local_ar_write_file,
            commands::autoresearch::local_ar_list_files,
            commands::autoresearch::local_ar_git_log,
            commands::autoresearch::read_skill_file,
        ])
        .setup(|app| {
            // Only open devtools in debug builds
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
