use crate::managers::history::Profile;
use crate::managers::profile::ProfileManager;
use std::sync::Arc;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn get_profiles(
    _app: AppHandle,
    profile_manager: State<'_, Arc<ProfileManager>>,
) -> Result<Vec<Profile>, String> {
    profile_manager
        .get_profiles()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_profile(
    _app: AppHandle,
    profile_manager: State<'_, Arc<ProfileManager>>,
    id: i64,
) -> Result<Option<Profile>, String> {
    profile_manager
        .get_profile(id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_profile(
    _app: AppHandle,
    profile_manager: State<'_, Arc<ProfileManager>>,
    name: String,
    description: Option<String>,
    color: String,
    icon: String,
    custom_instructions: Option<String>,
) -> Result<i64, String> {
    profile_manager
        .create_profile(name, description, color, icon, custom_instructions)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_profile(
    _app: AppHandle,
    profile_manager: State<'_, Arc<ProfileManager>>,
    id: i64,
    name: String,
    description: Option<String>,
    color: String,
    icon: String,
    custom_instructions: Option<String>,
) -> Result<(), String> {
    profile_manager
        .update_profile(id, name, description, color, icon, custom_instructions)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_profile(
    _app: AppHandle,
    profile_manager: State<'_, Arc<ProfileManager>>,
    id: i64,
) -> Result<(), String> {
    profile_manager
        .delete_profile(id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_profile_by_name(
    _app: AppHandle,
    profile_manager: State<'_, Arc<ProfileManager>>,
    name: String,
) -> Result<Option<Profile>, String> {
    profile_manager
        .get_profile_by_name(&name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_profile_stats(
    _app: AppHandle,
    profile_manager: State<'_, Arc<ProfileManager>>,
    id: i64,
) -> Result<i64, String> {
    profile_manager
        .get_profile_stats(id)
        .await
        .map_err(|e| e.to_string())
}
