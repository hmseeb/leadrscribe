mod actions;
mod audio_feedback;
pub mod audio_toolkit;
mod clipboard;
mod commands;
mod cpu_features;
mod ghostwriter;
mod managers;
mod migration;
mod overlay;
mod settings;
mod shortcut;
mod tray;
mod utils;

use log::{debug, error, info, warn};
use managers::audio::AudioRecordingManager;
use managers::history::HistoryManager;
use managers::model::ModelManager;
use managers::profile::ProfileManager;
use managers::tag::TagManager;
use managers::transcription::TranscriptionManager;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::image::Image;

use tauri::tray::TrayIconBuilder;
use tauri::Emitter;
use tauri::{AppHandle, Manager};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

#[derive(Default)]
struct ShortcutToggleStates {
    // Map: shortcut_binding_id -> is_active
    active_toggles: HashMap<String, bool>,
    // Map: shortcut_binding_id -> is_key_held (guards against auto-repeat)
    key_held: HashMap<String, bool>,
}

type ManagedToggleState = Mutex<ShortcutToggleStates>;

fn show_main_window(app: &AppHandle) {
    if let Some(main_window) = app.get_webview_window("main") {
        // First, ensure the window is visible
        if let Err(e) = main_window.show() {
            error!("Failed to show window: {}", e);
        }
        // Then, bring it to the front and give it focus
        if let Err(e) = main_window.set_focus() {
            error!("Failed to focus window: {}", e);
        }
        // Optional: On macOS, ensure the app becomes active if it was an accessory
        #[cfg(target_os = "macos")]
        {
            if let Err(e) = app.set_activation_policy(tauri::ActivationPolicy::Regular) {
                error!("Failed to set activation policy to Regular: {}", e);
            }
        }
    } else {
        warn!("Main window not found.");
    }
}

fn initialize_core_logic(app_handle: &AppHandle) {
    // Migrate user data from old "handy" directory if it exists
    if let Err(e) = migration::migrate_user_data(app_handle) {
        warn!("Failed to migrate user data: {}", e);
        // Continue with initialization even if migration fails
    }

    // First, initialize the managers
    let recording_manager = Arc::new(
        AudioRecordingManager::new(app_handle).expect("Failed to initialize recording manager"),
    );
    let model_manager =
        Arc::new(ModelManager::new(app_handle).expect("Failed to initialize model manager"));
    let transcription_manager = Arc::new(
        TranscriptionManager::new(app_handle, model_manager.clone())
            .expect("Failed to initialize transcription manager"),
    );
    let history_manager =
        Arc::new(HistoryManager::new(app_handle).expect("Failed to initialize history manager"));
    let profile_manager =
        Arc::new(ProfileManager::new(app_handle).expect("Failed to initialize profile manager"));
    let tag_manager =
        Arc::new(TagManager::new(app_handle).expect("Failed to initialize tag manager"));

    // Add managers to Tauri's managed state
    app_handle.manage(recording_manager.clone());
    app_handle.manage(model_manager.clone());
    app_handle.manage(transcription_manager.clone());
    app_handle.manage(history_manager.clone());
    app_handle.manage(profile_manager.clone());
    app_handle.manage(tag_manager.clone());

    // Initialize the shortcuts
    shortcut::init_shortcuts(app_handle);

    // Apply macOS Accessory policy if starting hidden
    #[cfg(target_os = "macos")]
    {
        let settings = settings::get_settings(app_handle);
        if settings.start_hidden {
            let _ = app_handle.set_activation_policy(tauri::ActivationPolicy::Accessory);
        }
    }
    // Get the current theme to set the appropriate initial icon
    let initial_theme = tray::get_current_theme(app_handle);

    // Choose the appropriate initial icon based on theme
    let initial_icon_path = tray::get_icon_path(initial_theme, tray::TrayIconState::Idle);

    let tray = TrayIconBuilder::new()
        .icon(
            Image::from_path(
                app_handle
                    .path()
                    .resolve(initial_icon_path, tauri::path::BaseDirectory::Resource)
                    .unwrap(),
            )
            .unwrap(),
        )
        .show_menu_on_left_click(true)
        .icon_as_template(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "settings" => {
                show_main_window(app);
            }
            "check_updates" => {
                show_main_window(app);
                let _ = app.emit("check-for-updates", ());
            }
            "cancel" => {
                use crate::utils::cancel_current_operation;

                // Use centralized cancellation that handles all operations
                cancel_current_operation(app);
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app_handle)
        .unwrap();
    app_handle.manage(tray);

    // Initialize tray menu with idle state
    utils::update_tray_menu(app_handle, &utils::TrayIconState::Idle);

    // Get the autostart manager and configure based on user setting
    let autostart_manager = app_handle.autolaunch();
    let settings = settings::get_settings(&app_handle);

    if settings.autostart_enabled {
        // Enable autostart if user has opted in
        let _ = autostart_manager.enable();
    } else {
        // Disable autostart if user has opted out
        let _ = autostart_manager.disable();
    }

    // Create the recording overlay window (hidden by default)
    utils::create_recording_overlay(app_handle);
}

#[tauri::command]
fn trigger_update_check(app: AppHandle) -> Result<(), String> {
    app.emit("check-for-updates", ())
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main_window(app);
        }))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_macos_permissions::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    "sqlite:history.db",
                    managers::history::HistoryManager::get_migrations(),
                )
                .build(),
        )
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .manage(Mutex::new(ShortcutToggleStates::default()))
        .setup(move |app| {
            let settings = settings::get_settings(&app.handle());
            let app_handle = app.handle().clone();

            initialize_core_logic(&app_handle);

            // Auto-load the selected model if one is configured
            let mut selected_model = settings.selected_model.clone();
            if !selected_model.is_empty() {
                let transcription_manager: tauri::State<Arc<TranscriptionManager>> = app_handle.state();
                let model_manager: tauri::State<Arc<ModelManager>> = app_handle.state();
                let transcription_manager_clone = transcription_manager.inner().clone();
                let model_manager_clone = model_manager.inner().clone();
                let app_handle_clone = app_handle.clone();

                // Check if selected model is Parakeet and CPU doesn't support it
                if let Some(model_info) = model_manager.get_model_info(&selected_model) {
                    if matches!(model_info.engine_type, managers::model::EngineType::Parakeet)
                        && !cpu_features::supports_parakeet() {
                        warn!(
                            "Selected Parakeet model '{}' requires AVX2 CPU support. \
                             Your CPU does not support this feature. Switching to Whisper Small model.",
                            selected_model
                        );

                        // Switch to small as a safe default
                        selected_model = "small".to_string();

                        // Update settings to reflect the change
                        let mut updated_settings = settings.clone();
                        updated_settings.selected_model = selected_model.clone();
                        settings::write_settings(&app_handle_clone, updated_settings);

                        // Emit event to notify frontend
                        let _ = app_handle_clone.emit(
                            "cpu-incompatible-model",
                            serde_json::json!({
                                "message": "Your CPU does not support Parakeet models (requires AVX2). Switched to Whisper Small.",
                                "original_model": model_info.id,
                                "fallback_model": "small"
                            })
                        );
                    }
                }

                tauri::async_runtime::spawn(async move {
                    // Check if the model is actually downloaded before trying to load it
                    if let Some(model_info) = model_manager_clone.get_model_info(&selected_model) {
                        if model_info.is_downloaded {
                            if let Err(e) = transcription_manager_clone.load_model(&selected_model) {
                                error!("Failed to auto-load model on startup: {}", e);
                            } else {
                                info!("Successfully auto-loaded model: {}", selected_model);
                            }
                        } else {
                            info!("Selected model '{}' is not downloaded, skipping auto-load", selected_model);
                        }
                    } else {
                        info!("Selected model '{}' not found in available models", selected_model);
                    }
                });
            }

            // Show main window only if not starting hidden
            if !settings.start_hidden {
                if let Some(main_window) = app_handle.get_webview_window("main") {
                    main_window.show().unwrap();
                    main_window.set_focus().unwrap();
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                let _res = window.hide();
                #[cfg(target_os = "macos")]
                {
                    let res = window
                        .app_handle()
                        .set_activation_policy(tauri::ActivationPolicy::Accessory);
                    if let Err(e) = res {
                        debug!("Failed to set activation policy: {}", e);
                    }
                }
            }
            tauri::WindowEvent::ThemeChanged(theme) => {
                debug!("Theme changed to: {:?}", theme);
                // Update tray icon to match new theme, maintaining idle state
                utils::change_tray_icon(&window.app_handle(), utils::TrayIconState::Idle);
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            shortcut::change_binding,
            shortcut::reset_binding,
            shortcut::suspend_binding,
            shortcut::resume_binding,
            shortcut::refresh_shortcuts,
            commands::settings::change_ptt_setting,
            commands::settings::change_audio_feedback_setting,
            commands::settings::change_audio_feedback_volume_setting,
            commands::settings::change_sound_theme_setting,
            commands::settings::change_start_hidden_setting,
            commands::settings::change_autostart_setting,
            commands::settings::change_translate_to_english_setting,
            commands::settings::change_selected_language_setting,
            commands::settings::change_overlay_position_setting,
            commands::settings::change_debug_mode_setting,
            commands::settings::change_word_correction_threshold_setting,
            commands::settings::change_paste_method_setting,
            commands::settings::change_clipboard_handling_setting,
            commands::settings::update_custom_words,
            commands::settings::change_mute_while_recording_setting,
            commands::settings::change_output_mode_setting,
            commands::settings::get_openrouter_api_key_setting,
            commands::settings::change_openrouter_api_key_setting,
            commands::settings::change_openrouter_model_setting,
            commands::settings::change_custom_instructions_setting,
            trigger_update_check,
            commands::cancel_operation,
            commands::get_app_dir_path,
            commands::get_cpu_capabilities,
            commands::models::get_available_models,
            commands::models::get_model_info,
            commands::models::download_model,
            commands::models::delete_model,
            commands::models::cancel_download,
            commands::models::set_active_model,
            commands::models::get_current_model,
            commands::models::get_transcription_model_status,
            commands::models::is_model_loading,
            commands::models::has_any_models_available,
            commands::models::has_any_models_or_downloads,
            commands::models::get_recommended_first_model,
            commands::audio::update_microphone_mode,
            commands::audio::get_microphone_mode,
            commands::audio::get_available_microphones,
            commands::audio::set_selected_microphone,
            commands::audio::get_selected_microphone,
            commands::audio::get_available_output_devices,
            commands::audio::set_selected_output_device,
            commands::audio::get_selected_output_device,
            commands::audio::play_test_sound,
            commands::audio::check_custom_sounds,
            commands::transcription::set_model_unload_timeout,
            commands::transcription::get_model_load_status,
            commands::transcription::unload_model_manually,
            commands::history::get_history_entries,
            commands::history::toggle_history_entry_saved,
            commands::history::get_audio_file_path,
            commands::history::delete_history_entry,
            commands::history::update_history_limit,
            commands::history::search_transcriptions,
            commands::history::get_by_profile,
            commands::history::get_by_date_range,
            commands::history::get_saved_only,
            commands::history::update_notes,
            commands::history::get_history_stats,
            commands::profile::get_profiles,
            commands::profile::get_profile,
            commands::profile::create_profile,
            commands::profile::update_profile,
            commands::profile::delete_profile,
            commands::profile::get_profile_by_name,
            commands::profile::get_profile_stats,
            commands::tag::get_tags,
            commands::tag::get_tag,
            commands::tag::search_tags,
            commands::tag::create_tag,
            commands::tag::update_tag,
            commands::tag::delete_tag,
            commands::tag::get_tags_for_transcription,
            commands::tag::add_tag_to_transcription,
            commands::tag::remove_tag_from_transcription,
            commands::tag::get_transcriptions_by_tag,
            commands::tag::get_tag_stats
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, event| {
            if let tauri::RunEvent::Exit = event {
                shortcut::shutdown_health_check();
            }
        });
}
