use log::{debug, error, warn};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use crate::actions::ACTION_MAP;
use crate::settings::ShortcutBinding;
use crate::settings::{self, get_settings, ClipboardHandling, OverlayPosition, PasteMethod, SoundTheme};
use crate::ManagedToggleState;

pub fn init_shortcuts(app: &AppHandle) {
    let settings = settings::load_or_create_app_settings(app);

    // Register shortcuts with the bindings from settings
    for (_id, binding) in settings.bindings {
        if let Err(e) = _register_shortcut(app, binding) {
            error!("Failed to register shortcut {} during init: {}", _id, e);
        }
    }

    // Start periodic health check to recover from Windows sleep/idle issues
    // This runs every 10 seconds to verify shortcuts and overlay are still registered
    let app_clone = app.clone();
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_secs(10));
            verify_and_reregister_shortcuts(&app_clone);
        }
    });
}

/// Verifies that all shortcuts are still registered and re-registers them if needed.
/// This recovers from Windows sleep/idle scenarios where shortcuts silently stop working.
fn verify_and_reregister_shortcuts(app: &AppHandle) {
    let settings = settings::get_settings(app);

    for (id, binding) in settings.bindings.iter() {
        // Try to parse the shortcut
        if let Ok(shortcut) = binding.current_binding.parse::<Shortcut>() {
            // Check if it's still registered
            if !app.global_shortcut().is_registered(shortcut) {
                warn!(
                    "Health check: Shortcut '{}' ({}) is not registered. Re-registering...",
                    id, binding.current_binding
                );
                // Try to re-register
                if let Err(e) = _register_shortcut(app, binding.clone()) {
                    error!(
                        "Health check: Failed to re-register shortcut '{}': {}",
                        id, e
                    );
                } else {
                    debug!("Health check: Successfully re-registered shortcut '{}'", id);
                }
            }
        }
    }

    // Also ensure overlay window still exists
    crate::overlay::ensure_overlay_exists(app);
}

#[derive(Serialize)]
pub struct BindingResponse {
    success: bool,
    binding: Option<ShortcutBinding>,
    error: Option<String>,
}

#[tauri::command]
pub fn change_binding(
    app: AppHandle,
    id: String,
    binding: String,
) -> Result<BindingResponse, String> {
    let mut settings = settings::get_settings(&app);

    // Get the binding to modify
    let binding_to_modify = match settings.bindings.get(&id) {
        Some(binding) => binding.clone(),
        None => {
            let error_msg = format!("Binding with id '{}' not found", id);
            warn!("change_binding error: {}", error_msg);
            return Ok(BindingResponse {
                success: false,
                binding: None,
                error: Some(error_msg),
            });
        }
    };

    // Unregister the existing binding
    if let Err(e) = _unregister_shortcut(&app, binding_to_modify.clone()) {
        let error_msg = format!("Failed to unregister shortcut: {}", e);
        warn!("change_binding error: {}", error_msg);
    }

    // Validate the new shortcut before we touch the current registration
    if let Err(e) = validate_shortcut_string(&binding) {
        warn!("change_binding validation error: {}", e);
        return Err(e);
    }

    // Create an updated binding
    let mut updated_binding = binding_to_modify;
    updated_binding.current_binding = binding;

    // Register the new binding
    if let Err(e) = _register_shortcut(&app, updated_binding.clone()) {
        let error_msg = format!("Failed to register shortcut: {}", e);
        error!("change_binding error: {}", error_msg);
        return Ok(BindingResponse {
            success: false,
            binding: None,
            error: Some(error_msg),
        });
    }

    // Update the binding in the settings
    settings.bindings.insert(id, updated_binding.clone());

    // Save the settings
    settings::write_settings(&app, settings);

    // Return the updated binding
    Ok(BindingResponse {
        success: true,
        binding: Some(updated_binding),
        error: None,
    })
}

#[tauri::command]
pub fn reset_binding(app: AppHandle, id: String) -> Result<BindingResponse, String> {
    let binding = settings::get_stored_binding(&app, &id)
        .ok_or_else(|| format!("Binding with id '{}' not found", id))?;

    change_binding(app, id, binding.default_binding)
}

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

/// Determine whether a shortcut string contains at least one non-modifier key.
/// We allow single non-modifier keys (e.g. "f5" or "space") but disallow
/// modifier-only combos (e.g. "ctrl" or "ctrl+shift").
fn validate_shortcut_string(raw: &str) -> Result<(), String> {
    let modifiers = [
        "ctrl", "control", "shift", "alt", "option", "meta", "command", "cmd", "super", "win",
        "windows",
    ];
    let has_non_modifier = raw
        .split('+')
        .any(|part| !modifiers.contains(&part.trim().to_lowercase().as_str()));
    if has_non_modifier {
        Ok(())
    } else {
        Err("Shortcut must contain at least one non-modifier key".into())
    }
}

/// Temporarily unregister a binding while the user is editing it in the UI.
/// This avoids firing the action while keys are being recorded.
#[tauri::command]
pub fn suspend_binding(app: AppHandle, id: String) -> Result<(), String> {
    if let Some(b) = settings::get_bindings(&app).get(&id).cloned() {
        if let Err(e) = _unregister_shortcut(&app, b) {
            error!("suspend_binding error for id '{}': {}", id, e);
            return Err(e);
        }
    }
    Ok(())
}

/// Re-register the binding after the user has finished editing.
#[tauri::command]
pub fn resume_binding(app: AppHandle, id: String) -> Result<(), String> {
    if let Some(b) = settings::get_bindings(&app).get(&id).cloned() {
        if let Err(e) = _register_shortcut(&app, b) {
            error!("resume_binding error for id '{}': {}", id, e);
            return Err(e);
        }
    }
    Ok(())
}

/// Manually trigger a health check and re-register all shortcuts if needed.
/// This can be called from the frontend for testing or troubleshooting,
/// or automatically after system wake events.
#[tauri::command]
pub fn refresh_shortcuts(app: AppHandle) -> Result<(), String> {
    debug!("Manual shortcut refresh triggered");
    verify_and_reregister_shortcuts(&app);
    Ok(())
}

fn _register_shortcut(app: &AppHandle, binding: ShortcutBinding) -> Result<(), String> {
    // Validate human-level rules first
    if let Err(e) = validate_shortcut_string(&binding.current_binding) {
        warn!(
            "_register_shortcut validation error for binding '{}': {}",
            binding.current_binding, e
        );
        return Err(e);
    }

    // Parse shortcut and return error if it fails
    let shortcut = match binding.current_binding.parse::<Shortcut>() {
        Ok(s) => s,
        Err(e) => {
            let error_msg = format!(
                "Failed to parse shortcut '{}': {}",
                binding.current_binding, e
            );
            error!("_register_shortcut parse error: {}", error_msg);
            return Err(error_msg);
        }
    };

    // Prevent duplicate registrations that would silently shadow one another
    if app.global_shortcut().is_registered(shortcut) {
        let error_msg = format!("Shortcut '{}' is already in use", binding.current_binding);
        warn!("_register_shortcut duplicate error: {}", error_msg);
        return Err(error_msg);
    }

    // Clone binding.id for use in the closure
    let binding_id_for_closure = binding.id.clone();

    app.global_shortcut()
        .on_shortcut(shortcut, move |ah, scut, event| {
            if scut == &shortcut {
                let shortcut_string = scut.into_string();
                let settings = get_settings(ah);

                debug!(
                    "[HOTKEY DEBUG] Shortcut '{}' triggered - ID: '{}', State: {:?}, PTT: {}",
                    shortcut_string, binding_id_for_closure, event.state, settings.push_to_talk
                );

                if let Some(action) = ACTION_MAP.get(&binding_id_for_closure) {
                    if settings.push_to_talk {
                        if event.state == ShortcutState::Pressed {
                            debug!("[HOTKEY DEBUG] PTT mode - calling start()");
                            action.start(ah, &binding_id_for_closure, &shortcut_string);
                        } else if event.state == ShortcutState::Released {
                            debug!("[HOTKEY DEBUG] PTT mode - calling stop()");
                            action.stop(ah, &binding_id_for_closure, &shortcut_string);
                        }
                    } else {
                        let toggle_state_manager = ah.state::<ManagedToggleState>();
                        let mut states = toggle_state_manager.lock().expect("Failed to lock toggle state manager");

                        if event.state == ShortcutState::Pressed {
                            // Guard against keyboard auto-repeat: ignore repeated Pressed
                            // events while the key is already held down
                            let is_held = states.key_held
                                .entry(binding_id_for_closure.clone())
                                .or_insert(false);
                            if *is_held {
                                debug!("[HOTKEY DEBUG] Toggle mode - ignoring auto-repeat Pressed event");
                                return;
                            }
                            *is_held = true;

                            let is_currently_active = states.active_toggles
                                .entry(binding_id_for_closure.clone())
                                .or_insert(false);

                            debug!(
                                "[HOTKEY DEBUG] Toggle mode - current state: {}, will call: {}",
                                is_currently_active,
                                if *is_currently_active { "stop()" } else { "start()" }
                            );

                            if *is_currently_active {
                                action.stop(
                                    ah,
                                    &binding_id_for_closure,
                                    &shortcut_string,
                                );
                                *is_currently_active = false;
                                debug!("[HOTKEY DEBUG] Toggle state now: false (inactive)");
                            } else {
                                action.start(ah, &binding_id_for_closure, &shortcut_string);
                                *is_currently_active = true;
                                debug!("[HOTKEY DEBUG] Toggle state now: true (active)");
                            }
                        } else if event.state == ShortcutState::Released {
                            // Clear the key-held guard so next press is recognized
                            states.key_held.insert(binding_id_for_closure.clone(), false);
                            debug!("[HOTKEY DEBUG] Toggle mode - key released, cleared held guard");
                        }
                    }
                } else {
                    warn!(
                        "No action defined in ACTION_MAP for shortcut ID '{}'. Shortcut: '{}', State: {:?}",
                        binding_id_for_closure, shortcut_string, event.state
                    );
                }
            }
        })
        .map_err(|e| {
            let error_msg = format!("Couldn't register shortcut '{}': {}", binding.current_binding, e);
            error!("_register_shortcut registration error: {}", error_msg);
            error_msg
        })?;

    Ok(())
}

fn _unregister_shortcut(app: &AppHandle, binding: ShortcutBinding) -> Result<(), String> {
    let shortcut = match binding.current_binding.parse::<Shortcut>() {
        Ok(s) => s,
        Err(e) => {
            let error_msg = format!(
                "Failed to parse shortcut '{}' for unregistration: {}",
                binding.current_binding, e
            );
            error!("_unregister_shortcut parse error: {}", error_msg);
            return Err(error_msg);
        }
    };

    app.global_shortcut().unregister(shortcut).map_err(|e| {
        let error_msg = format!(
            "Failed to unregister shortcut '{}': {}",
            binding.current_binding, e
        );
        error!("_unregister_shortcut error: {}", error_msg);
        error_msg
    })?;

    Ok(())
}
