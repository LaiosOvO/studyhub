//! WebSocket sync commands for Tauri-to-web backend communication.
//!
//! Manages a persistent WebSocket connection to the web backend
//! for pushing experiment status and GPU metrics in real-time.

use std::sync::Mutex;
use tauri::State;

/// State holding the WebSocket connection details.
pub struct SyncState {
    pub connection_url: Mutex<Option<String>>,
    pub is_connected: Mutex<bool>,
}

impl Default for SyncState {
    fn default() -> Self {
        Self {
            connection_url: Mutex::new(None),
            is_connected: Mutex::new(false),
        }
    }
}

/// Connect to web backend WebSocket.
#[tauri::command]
pub async fn connect_backend(
    url: String,
    token: String,
    state: State<'_, SyncState>,
) -> Result<(), String> {
    let ws_url = format!("{}/ws/experiment-sync?token={}", url, token);

    // Store connection URL
    if let Ok(mut conn_url) = state.connection_url.lock() {
        *conn_url = Some(ws_url.clone());
    }

    // Mark as connected (actual WebSocket connection via plugin)
    if let Ok(mut connected) = state.is_connected.lock() {
        *connected = true;
    }

    Ok(())
}

/// Disconnect from web backend.
#[tauri::command]
pub fn disconnect_backend(state: State<'_, SyncState>) -> Result<(), String> {
    if let Ok(mut conn_url) = state.connection_url.lock() {
        *conn_url = None;
    }
    if let Ok(mut connected) = state.is_connected.lock() {
        *connected = false;
    }
    Ok(())
}

/// Send sync payload to web backend via WebSocket.
#[tauri::command]
pub async fn send_sync(
    payload: serde_json::Value,
    state: State<'_, SyncState>,
) -> Result<(), String> {
    let is_connected = state
        .is_connected
        .lock()
        .map_err(|e| format!("Lock error: {e}"))?;

    if !*is_connected {
        return Err("Not connected to backend".to_string());
    }

    // Log payload for now -- actual WebSocket send wired via plugin in later iteration
    let payload_str = serde_json::to_string(&payload)
        .map_err(|e| format!("Serialization error: {e}"))?;

    eprintln!("Sync payload: {}", payload_str);
    Ok(())
}
