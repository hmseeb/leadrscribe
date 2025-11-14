pub mod audio;
pub mod history;
pub mod models;
pub mod profile;
pub mod tag;
pub mod transcription;

use crate::cpu_features::{self, CpuCapabilities};
use crate::utils::cancel_current_operation;
use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn cancel_operation(app: AppHandle) {
    cancel_current_operation(&app);
}

#[tauri::command]
pub fn get_app_dir_path(app: AppHandle) -> Result<String, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    Ok(app_data_dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_cpu_capabilities() -> CpuCapabilities {
    cpu_features::check_cpu_capabilities()
}
