//! StudyHub Desktop Agent - Tauri v2 application entry point.
//!
//! Registers plugins, managed state, and commands for the
//! experiment execution engine desktop companion.

mod commands;
mod state;

use state::ExperimentState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_websocket::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(ExperimentState::default())
        .invoke_handler(tauri::generate_handler![
            commands::experiment::get_status,
            commands::experiment::start_experiment,
            commands::experiment::pause_experiment,
            commands::experiment::resume_experiment,
            commands::experiment::cancel_experiment,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
