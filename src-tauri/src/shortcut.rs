use log::{debug, error, warn};
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use crate::actions::ACTION_MAP;
use crate::settings::ShortcutBinding;
use crate::settings::{self, get_settings};
use crate::ManagedToggleState;

static HEALTH_CHECK_SHUTDOWN: AtomicBool = AtomicBool::new(false);

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
            if HEALTH_CHECK_SHUTDOWN.load(Ordering::Relaxed) {
                debug!("Health check thread shutting down");
                break;
            }
            verify_and_reregister_shortcuts(&app_clone);
        }
    });
}

/// Signal the health-check thread to stop.
pub fn shutdown_health_check() {
    HEALTH_CHECK_SHUTDOWN.store(true, Ordering::Relaxed);
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
