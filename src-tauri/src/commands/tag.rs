use crate::managers::history::Tag;
use crate::managers::tag::TagManager;
use std::sync::Arc;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn get_tags(
    _app: AppHandle,
    tag_manager: State<'_, Arc<TagManager>>,
) -> Result<Vec<Tag>, String> {
    tag_manager.get_tags().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_tag(
    _app: AppHandle,
    tag_manager: State<'_, Arc<TagManager>>,
    id: i64,
) -> Result<Option<Tag>, String> {
    tag_manager.get_tag(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_tags(
    _app: AppHandle,
    tag_manager: State<'_, Arc<TagManager>>,
    query: String,
) -> Result<Vec<Tag>, String> {
    tag_manager
        .search_tags(&query)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_tag(
    _app: AppHandle,
    tag_manager: State<'_, Arc<TagManager>>,
    name: String,
    color: String,
) -> Result<i64, String> {
    tag_manager
        .create_tag(name, color)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_tag(
    _app: AppHandle,
    tag_manager: State<'_, Arc<TagManager>>,
    id: i64,
    name: String,
    color: String,
) -> Result<(), String> {
    tag_manager
        .update_tag(id, name, color)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_tag(
    _app: AppHandle,
    tag_manager: State<'_, Arc<TagManager>>,
    id: i64,
) -> Result<(), String> {
    tag_manager
        .delete_tag(id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_tags_for_transcription(
    _app: AppHandle,
    tag_manager: State<'_, Arc<TagManager>>,
    transcription_id: i64,
) -> Result<Vec<Tag>, String> {
    tag_manager
        .get_tags_for_transcription(transcription_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_tag_to_transcription(
    _app: AppHandle,
    tag_manager: State<'_, Arc<TagManager>>,
    transcription_id: i64,
    tag_id: i64,
) -> Result<(), String> {
    tag_manager
        .add_tag_to_transcription(transcription_id, tag_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_tag_from_transcription(
    _app: AppHandle,
    tag_manager: State<'_, Arc<TagManager>>,
    transcription_id: i64,
    tag_id: i64,
) -> Result<(), String> {
    tag_manager
        .remove_tag_from_transcription(transcription_id, tag_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_transcriptions_by_tag(
    _app: AppHandle,
    tag_manager: State<'_, Arc<TagManager>>,
    tag_id: i64,
) -> Result<Vec<i64>, String> {
    tag_manager
        .get_transcriptions_by_tag(tag_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_tag_stats(
    _app: AppHandle,
    tag_manager: State<'_, Arc<TagManager>>,
    tag_id: i64,
) -> Result<i64, String> {
    tag_manager
        .get_tag_stats(tag_id)
        .await
        .map_err(|e| e.to_string())
}
