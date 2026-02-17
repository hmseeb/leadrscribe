use log::{debug, warn};
use tauri::{AppHandle, Emitter};
use tauri_plugin_autostart::ManagerExt;

use crate::settings::{self, ClipboardHandling, OverlayPosition, PasteMethod, SoundTheme};

#[tauri::command]
pub fn change_ptt_setting(app: AppHandle, enabled: bool) -> Result<(), String> {
    let mut settings = settings::get_settings(&app);

    // TODO if the setting is currently false, we probably want to
    // cancel any ongoing recordings or actions
    settings.push_to_talk = enabled;

    settings::write_settings(&app, settings);

    Ok(())
}

#[tauri::command]
pub fn change_audio_feedback_setting(app: AppHandle, enabled: bool) -> Result<(), String> {
    let mut settings = settings::get_settings(&app);
    settings.audio_feedback = enabled;
    settings::write_settings(&app, settings);
    Ok(())
}

#[tauri::command]
pub fn change_audio_feedback_volume_setting(app: AppHandle, volume: f32) -> Result<(), String> {
    let mut settings = settings::get_settings(&app);
    settings.audio_feedback_volume = volume;
    settings::write_settings(&app, settings);
    Ok(())
}

#[tauri::command]
pub fn change_sound_theme_setting(app: AppHandle, theme: String) -> Result<(), String> {
    let mut settings = settings::get_settings(&app);
    let parsed = match theme.as_str() {
        "marimba" => SoundTheme::Marimba,
        "pop" => SoundTheme::Pop,
        "custom" => SoundTheme::Custom,
        other => {
            warn!("Invalid sound theme '{}', defaulting to marimba", other);
            SoundTheme::Marimba
        }
    };
    settings.sound_theme = parsed;
    settings::write_settings(&app, settings);
    Ok(())
}

#[tauri::command]
pub fn change_translate_to_english_setting(app: AppHandle, enabled: bool) -> Result<(), String> {
    let mut settings = settings::get_settings(&app);
    settings.translate_to_english = enabled;
    settings::write_settings(&app, settings);
    Ok(())
}

#[tauri::command]
pub fn change_selected_language_setting(app: AppHandle, language: String) -> Result<(), String> {
    let mut settings = settings::get_settings(&app);
    settings.selected_language = language;
    settings::write_settings(&app, settings);
    Ok(())
}

#[tauri::command]
pub fn change_overlay_position_setting(app: AppHandle, position: String) -> Result<(), String> {
    let mut settings = settings::get_settings(&app);
    let parsed = match position.as_str() {
        "none" => OverlayPosition::None,
        "top" => OverlayPosition::Top,
        "bottom" => OverlayPosition::Bottom,
        other => {
            warn!("Invalid overlay position '{}', defaulting to bottom", other);
            OverlayPosition::Bottom
        }
    };
    settings.overlay_position = parsed;
    settings::write_settings(&app, settings);

    // Update overlay position without recreating window
    crate::utils::update_overlay_position(&app);

    Ok(())
}

#[tauri::command]
pub fn change_debug_mode_setting(app: AppHandle, enabled: bool) -> Result<(), String> {
    let mut settings = settings::get_settings(&app);
    settings.debug_mode = enabled;
    settings::write_settings(&app, settings);

    // Emit event to notify frontend of debug mode change
    let _ = app.emit(
        "settings-changed",
        serde_json::json!({
            "setting": "debug_mode",
            "value": enabled
        }),
    );

    Ok(())
}

#[tauri::command]
pub fn change_start_hidden_setting(app: AppHandle, enabled: bool) -> Result<(), String> {
    let mut settings = settings::get_settings(&app);
    settings.start_hidden = enabled;
    settings::write_settings(&app, settings);

    // Notify frontend
    let _ = app.emit(
        "settings-changed",
        serde_json::json!({
            "setting": "start_hidden",
            "value": enabled
        }),
    );

    Ok(())
}

#[tauri::command]
pub fn change_autostart_setting(app: AppHandle, enabled: bool) -> Result<(), String> {
    let mut settings = settings::get_settings(&app);
    settings.autostart_enabled = enabled;
    settings::write_settings(&app, settings);

    // Apply the autostart setting immediately
    let autostart_manager = app.autolaunch();
    if enabled {
        let _ = autostart_manager.enable();
    } else {
        let _ = autostart_manager.disable();
    }

    // Notify frontend
    let _ = app.emit(
        "settings-changed",
        serde_json::json!({
            "setting": "autostart_enabled",
            "value": enabled
        }),
    );

    Ok(())
}

#[tauri::command]
pub fn update_custom_words(app: AppHandle, words: Vec<String>) -> Result<(), String> {
    let mut settings = settings::get_settings(&app);
    settings.custom_words = words;
    settings::write_settings(&app, settings);
    Ok(())
}

#[tauri::command]
pub fn change_word_correction_threshold_setting(
    app: AppHandle,
    threshold: f64,
) -> Result<(), String> {
    let mut settings = settings::get_settings(&app);
    settings.word_correction_threshold = threshold;
    settings::write_settings(&app, settings);
    Ok(())
}

#[tauri::command]
pub fn change_paste_method_setting(app: AppHandle, method: String) -> Result<(), String> {
    let mut settings = settings::get_settings(&app);
    let parsed = match method.as_str() {
        "ctrl_v" => PasteMethod::CtrlV,
        "direct" => PasteMethod::Direct,
        other => {
            warn!("Invalid paste method '{}', defaulting to ctrl_v", other);
            PasteMethod::CtrlV
        }
    };
    settings.paste_method = parsed;
    settings::write_settings(&app, settings);
    Ok(())
}

#[tauri::command]
pub fn change_clipboard_handling_setting(app: AppHandle, handling: String) -> Result<(), String> {
    let mut settings = settings::get_settings(&app);
    let parsed = match handling.as_str() {
        "dont_modify" => ClipboardHandling::DontModify,
        "copy_to_clipboard" => ClipboardHandling::CopyToClipboard,
        other => {
            warn!("Invalid clipboard handling '{}', defaulting to dont_modify", other);
            ClipboardHandling::DontModify
        }
    };
    settings.clipboard_handling = parsed;
    settings::write_settings(&app, settings);
    Ok(())
}

#[tauri::command]
pub fn change_mute_while_recording_setting(app: AppHandle, enabled: bool) -> Result<(), String> {
    let mut settings = settings::get_settings(&app);
    settings.mute_while_recording = enabled;
    settings::write_settings(&app, settings);

    Ok(())
}

#[tauri::command]
pub fn change_output_mode_setting(app: AppHandle, mode: String) -> Result<(), String> {
    let mut settings = settings::get_settings(&app);
    let parsed = match mode.as_str() {
        "transcript" => settings::OutputMode::Transcript,
        "ghostwriter" => settings::OutputMode::Ghostwriter,
        other => {
            warn!("Invalid output mode '{}', defaulting to transcript", other);
            settings::OutputMode::Transcript
        }
    };
    settings.output_mode = parsed;
    settings::write_settings(&app, settings);
    Ok(())
}

#[tauri::command]
pub fn get_openrouter_api_key_setting(app: AppHandle) -> Option<String> {
    // Try keychain first
    if let Some(key) = settings::get_openrouter_api_key() {
        return Some(key);
    }

    // Fall back to settings file, and auto-migrate to keychain if found
    if let Some(key) = settings::get_settings(&app).openrouter_api_key.clone() {
        if !key.is_empty() {
            debug!("Migrating API key from settings file to keychain");
            if settings::set_openrouter_api_key(&key).is_ok() {
                // Clear plaintext from settings file after successful migration
                let mut s = settings::get_settings(&app);
                s.openrouter_api_key = None;
                settings::write_settings(&app, s);
            }
            return Some(key);
        }
    }

    None
}

#[tauri::command]
pub fn change_openrouter_api_key_setting(app: AppHandle, api_key: Option<String>) -> Result<(), String> {
    let mut s = settings::get_settings(&app);

    if let Some(ref key) = api_key {
        // Try to save to keyring and verify it can be read back
        let keyring_works = settings::set_openrouter_api_key(key).is_ok()
            && settings::get_openrouter_api_key().as_deref() == Some(key.as_str());

        if keyring_works {
            debug!("API key saved to keychain successfully");
            // Keyring works — clear plaintext from settings file for security.
            // get_openrouter_api_key_setting already handles keyring → settings fallback on read.
            s.openrouter_api_key = None;
        } else {
            // Keychain unreliable: store in settings file as fallback
            warn!("Keychain storage failed or unverifiable, falling back to settings file");
            s.openrouter_api_key = api_key;
        }
    } else {
        let _ = settings::delete_openrouter_api_key();
        s.openrouter_api_key = None;
    }

    settings::write_settings(&app, s);
    Ok(())
}

#[tauri::command]
pub fn change_openrouter_model_setting(app: AppHandle, model: String) -> Result<(), String> {
    let mut settings = settings::get_settings(&app);
    settings.openrouter_model = model;
    settings::write_settings(&app, settings);
    Ok(())
}

#[tauri::command]
pub fn change_custom_instructions_setting(app: AppHandle, instructions: String) -> Result<(), String> {
    let mut settings = settings::get_settings(&app);
    settings.custom_instructions = instructions;
    settings::write_settings(&app, settings);
    Ok(())
}
