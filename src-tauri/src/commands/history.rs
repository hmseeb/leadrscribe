use crate::managers::history::{HistoryEntry, HistoryManager, HistoryStats};
use std::sync::Arc;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn get_history_entries(
    _app: AppHandle,
    history_manager: State<'_, Arc<HistoryManager>>,
) -> Result<Vec<HistoryEntry>, String> {
    history_manager
        .get_history_entries()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn toggle_history_entry_saved(
    _app: AppHandle,
    history_manager: State<'_, Arc<HistoryManager>>,
    id: i64,
) -> Result<(), String> {
    history_manager
        .toggle_saved_status(id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_audio_file_path(
    _app: AppHandle,
    history_manager: State<'_, Arc<HistoryManager>>,
    file_name: String,
) -> Result<String, String> {
    let path = history_manager.get_audio_file_path(&file_name);
    path.to_str()
        .ok_or_else(|| "Invalid file path".to_string())
        .map(|s| s.to_string())
}

#[tauri::command]
pub async fn delete_history_entry(
    _app: AppHandle,
    history_manager: State<'_, Arc<HistoryManager>>,
    id: i64,
) -> Result<(), String> {
    history_manager
        .delete_entry(id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_history_limit(
    app: AppHandle,
    history_manager: State<'_, Arc<HistoryManager>>,
    limit: usize,
) -> Result<(), String> {
    let mut settings = crate::settings::get_settings(&app);
    settings.history_limit = limit;
    crate::settings::write_settings(&app, settings);

    history_manager
        .update_history_limit()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn search_transcriptions(
    _app: AppHandle,
    history_manager: State<'_, Arc<HistoryManager>>,
    query: String,
    limit: usize,
) -> Result<Vec<HistoryEntry>, String> {
    history_manager
        .search_transcriptions(&query, limit)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_by_profile(
    _app: AppHandle,
    history_manager: State<'_, Arc<HistoryManager>>,
    profile_id: i64,
    limit: usize,
) -> Result<Vec<HistoryEntry>, String> {
    history_manager
        .get_by_profile(profile_id, limit)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_by_date_range(
    _app: AppHandle,
    history_manager: State<'_, Arc<HistoryManager>>,
    start_timestamp: i64,
    end_timestamp: i64,
    limit: usize,
) -> Result<Vec<HistoryEntry>, String> {
    history_manager
        .get_by_date_range(start_timestamp, end_timestamp, limit)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_saved_only(
    _app: AppHandle,
    history_manager: State<'_, Arc<HistoryManager>>,
    limit: usize,
) -> Result<Vec<HistoryEntry>, String> {
    history_manager
        .get_saved_only(limit)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_notes(
    _app: AppHandle,
    history_manager: State<'_, Arc<HistoryManager>>,
    id: i64,
    notes: Option<String>,
) -> Result<(), String> {
    history_manager
        .update_notes(id, notes)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_history_stats(
    _app: AppHandle,
    history_manager: State<'_, Arc<HistoryManager>>,
) -> Result<HistoryStats, String> {
    history_manager
        .get_stats()
        .await
        .map_err(|e| e.to_string())
}
