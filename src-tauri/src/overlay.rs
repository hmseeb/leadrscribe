use crate::settings;
use crate::settings::OverlayPosition;
use log::debug;
use enigo::{Enigo, Mouse};
use std::sync::atomic::{AtomicBool, Ordering};

/// Atomic flag to track if a hide operation is pending.
/// This prevents race conditions where a delayed hide() executes after a new show().
static HIDE_PENDING: AtomicBool = AtomicBool::new(false);

/// Tracks whether the overlay is in streaming (expanded) mode.
/// When true, emit_levels skips repositioning to avoid fighting the expanded size.
static STREAMING_ACTIVE: AtomicBool = AtomicBool::new(false);

// Expanded overlay dimensions for streaming mode
const STREAMING_WIDTH: f64 = 400.0;
const STREAMING_HEIGHT: f64 = 180.0;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewWindowBuilder};

// Add padding for shadow (shadow extends ~32px)
const OVERLAY_WIDTH: f64 = 280.0;  // 200 + 40 padding for shadow on each side
const OVERLAY_HEIGHT: f64 = 90.0;  // 42 + 48 padding for shadow

#[cfg(target_os = "macos")]
const OVERLAY_TOP_OFFSET: f64 = 46.0;
#[cfg(any(target_os = "windows", target_os = "linux"))]
const OVERLAY_TOP_OFFSET: f64 = 4.0;

#[cfg(target_os = "macos")]
const OVERLAY_BOTTOM_OFFSET: f64 = 15.0;

#[cfg(any(target_os = "windows", target_os = "linux"))]
const OVERLAY_BOTTOM_OFFSET: f64 = 60.0;

fn get_monitor_with_cursor(app_handle: &AppHandle) -> Option<tauri::Monitor> {
    let enigo = Enigo::new(&Default::default());
    if let Ok(enigo) = enigo {
        if let Ok(mouse_location) = enigo.location() {
            if let Ok(monitors) = app_handle.available_monitors() {
                for monitor in monitors {
                    let is_within = is_mouse_within_monitor(mouse_location, monitor.position(), monitor.size());
                    if is_within {
                        return Some(monitor);
                    }
                }
            }
        }
    }

    app_handle.primary_monitor().ok().flatten()
}

fn is_mouse_within_monitor(
    mouse_pos: (i32, i32),
    monitor_pos: &PhysicalPosition<i32>,
    monitor_size: &PhysicalSize<u32>,
) -> bool {
    let (mouse_x, mouse_y) = mouse_pos;
    let PhysicalPosition { x: monitor_x, y: monitor_y } = *monitor_pos;
    let PhysicalSize { width: monitor_width, height: monitor_height } = *monitor_size;

    mouse_x >= monitor_x
        && mouse_x < (monitor_x + monitor_width as i32)
        && mouse_y >= monitor_y
        && mouse_y < (monitor_y + monitor_height as i32)
}

fn calculate_overlay_position(app_handle: &AppHandle) -> Option<(f64, f64)> {
    let settings = settings::get_settings(app_handle);
    let monitor = get_monitor_with_cursor(app_handle)?;

    let work_area = monitor.work_area();
    let scale = monitor.scale_factor();
    let work_area_width = work_area.size.width as f64 / scale;
    let work_area_height = work_area.size.height as f64 / scale;
    let work_area_x = work_area.position.x as f64 / scale;
    let work_area_y = work_area.position.y as f64 / scale;

    let (x, y) = match settings.overlay_position {
        OverlayPosition::FollowCursor => {
            // Get cursor position
            let cursor_pos = Enigo::new(&Default::default())
                .ok()
                .and_then(|e| e.location().ok());

            if let Some((cx, cy)) = cursor_pos {
                // Position below cursor with 40px offset
                let cursor_x = cx as f64 / scale;
                let cursor_y = cy as f64 / scale;

                // Center overlay horizontally on cursor, but clamp to screen bounds
                let x = (cursor_x - OVERLAY_WIDTH / 2.0).clamp(
                    work_area_x,
                    work_area_x + work_area_width - OVERLAY_WIDTH
                );

                // Position below cursor with offset, clamp to screen bounds
                let y = (cursor_y + 40.0).clamp(
                    work_area_y,
                    work_area_y + work_area_height - OVERLAY_HEIGHT
                );

                (x, y)
            } else {
                // Fallback to center-bottom if cursor position unavailable
                let x = work_area_x + (work_area_width - OVERLAY_WIDTH) / 2.0;
                let y = work_area_y + work_area_height - OVERLAY_BOTTOM_OFFSET;
                (x, y)
            }
        },
        OverlayPosition::Top => {
            let x = work_area_x + (work_area_width - OVERLAY_WIDTH) / 2.0;
            let y = work_area_y + OVERLAY_TOP_OFFSET;
            (x, y)
        },
        OverlayPosition::Bottom | OverlayPosition::None => {
            let x = work_area_x + (work_area_width - OVERLAY_WIDTH) / 2.0;
            let y = work_area_y + work_area_height - OVERLAY_BOTTOM_OFFSET;
            (x, y)
        }
    };

    Some((x, y))
}

/// Creates the recording overlay window and keeps it hidden by default
pub fn create_recording_overlay(app_handle: &AppHandle) {
    if let Some((x, y)) = calculate_overlay_position(app_handle) {
        match WebviewWindowBuilder::new(
            app_handle,
            "recording_overlay",
            tauri::WebviewUrl::App("src/overlay/index.html".into()),
        )
        .title("Recording")
        .position(x, y)
        .resizable(false)
        .inner_size(OVERLAY_WIDTH, OVERLAY_HEIGHT)
        .shadow(false)
        .maximizable(false)
        .minimizable(false)
        .closable(false)
        .accept_first_mouse(true)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .transparent(true)
        .focused(false)
        .visible(false)
        .build()
        {
            Ok(_window) => {
                debug!("Recording overlay window created successfully (hidden)");
            }
            Err(e) => {
                debug!("Failed to create recording overlay window: {}", e);
            }
        }
    }
}

/// Attempts to show overlay window and verify it actually became visible.
/// Returns true if show succeeded, false if window appears broken.
fn try_show_overlay(window: &tauri::WebviewWindow) -> bool {
    // First check if window handle is valid at all
    if window.is_visible().is_err() {
        debug!("Overlay window handle is stale (is_visible failed)");
        return false;
    }

    // Try to show the window
    if window.show().is_err() {
        debug!("Overlay window show() call failed");
        return false;
    }

    // Give the window a moment to actually become visible
    std::thread::sleep(std::time::Duration::from_millis(10));

    // Verify the window is actually visible now
    match window.is_visible() {
        Ok(true) => {
            let _ = window.emit("show-overlay", "recording");
            true
        }
        Ok(false) => {
            // show() succeeded but window isn't visible - broken state (common after Windows sleep)
            debug!("Overlay window show() succeeded but is_visible() returns false - window is broken");
            false
        }
        Err(_) => {
            debug!("Overlay window became invalid after show()");
            false
        }
    }
}

/// Shows the recording overlay window with fade-in animation
pub fn show_recording_overlay(app_handle: &AppHandle) {
    // Cancel any pending hide operation to prevent race condition
    // where a delayed hide() from a previous call would hide this new show()
    HIDE_PENDING.store(false, Ordering::SeqCst);

    // Check if overlay should be shown based on position setting
    let settings = settings::get_settings(app_handle);
    if settings.overlay_position == OverlayPosition::None {
        return;
    }

    // Ensure overlay exists before trying to show it
    ensure_overlay_exists(app_handle);

    update_overlay_position(app_handle);

    // Try to show existing window, with retry after recreation if it fails
    for attempt in 0..2 {
        if let Some(overlay_window) = app_handle.get_webview_window("recording_overlay") {
            if try_show_overlay(&overlay_window) {
                return; // Success!
            }

            // Show failed - destroy and recreate
            debug!(
                "Overlay show attempt {} failed, recreating window...",
                attempt + 1
            );
            let _ = overlay_window.destroy();
            create_recording_overlay(app_handle);
        } else {
            // Window doesn't exist, create it
            debug!("Overlay window not found, creating...");
            create_recording_overlay(app_handle);
        }
    }

    // Final attempt after recreation
    if let Some(overlay_window) = app_handle.get_webview_window("recording_overlay") {
        if !try_show_overlay(&overlay_window) {
            debug!("Overlay failed to show after recreation - giving up");
        }
    }
}

/// Updates the overlay window position based on current settings
pub fn update_overlay_position(app_handle: &AppHandle) {
    if let Some(overlay_window) = app_handle.get_webview_window("recording_overlay") {
        if let Some((x, y)) = calculate_overlay_position(app_handle) {
            let _ = overlay_window
                .set_position(tauri::Position::Logical(tauri::LogicalPosition { x, y }));
        }
    }
}

/// Hides the recording overlay window with fade-out animation
pub fn hide_recording_overlay(app_handle: &AppHandle) {
    // Always hide the overlay regardless of settings - if setting was changed while recording,
    // we still want to hide it properly
    if let Some(overlay_window) = app_handle.get_webview_window("recording_overlay") {
        // Emit event to trigger fade-out animation
        let _ = overlay_window.emit("hide-overlay", ());
        // Mark that a hide operation is pending
        HIDE_PENDING.store(true, Ordering::SeqCst);

        let app_clone = app_handle.clone();
        let window_clone = overlay_window.clone();

        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(300));
            if HIDE_PENDING.load(Ordering::SeqCst) {
                // Hide the window first (it's already faded out by now)
                let _ = window_clone.hide();

                // Reset streaming state and window size AFTER hiding (invisible to user)
                if STREAMING_ACTIVE.load(Ordering::SeqCst) {
                    STREAMING_ACTIVE.store(false, Ordering::SeqCst);
                    // Reset to original size so next show starts correctly
                    let _ = window_clone.set_size(tauri::Size::Logical(
                        tauri::LogicalSize { width: OVERLAY_WIDTH, height: OVERLAY_HEIGHT },
                    ));
                    // Reset position for next show
                    if let Some((x, y)) = calculate_overlay_position(&app_clone) {
                        let _ = window_clone.set_position(tauri::Position::Logical(
                            tauri::LogicalPosition { x, y },
                        ));
                    }
                }

                HIDE_PENDING.store(false, Ordering::SeqCst);
            }
        });
    }
}

/// Expands the overlay window for streaming text display.
/// Keeps the pill at the same screen position by shifting the window up.
/// Uses atomic compare_exchange to ensure this only runs once per session.
pub fn expand_overlay_for_streaming(app_handle: &AppHandle) {
    // Atomically check and set - only the first caller proceeds
    if STREAMING_ACTIVE.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_err() {
        return;
    }

    if let Some(window) = app_handle.get_webview_window("recording_overlay") {
        if let (Ok(pos), Ok(scale)) = (window.outer_position(), window.scale_factor()) {
            let old_x = pos.x as f64 / scale;
            let old_y = pos.y as f64 / scale;

            let width_diff = STREAMING_WIDTH - OVERLAY_WIDTH;
            let height_diff = STREAMING_HEIGHT - OVERLAY_HEIGHT;

            // Center horizontally, shift up so pill bottom stays at same screen position
            let new_x = old_x - width_diff / 2.0;
            let new_y = old_y - height_diff;

            let _ = window.set_size(tauri::Size::Logical(
                tauri::LogicalSize { width: STREAMING_WIDTH, height: STREAMING_HEIGHT },
            ));
            let _ = window.set_position(tauri::Position::Logical(
                tauri::LogicalPosition { x: new_x, y: new_y },
            ));
        }
    }
}

pub fn emit_levels(app_handle: &AppHandle, levels: &Vec<f32>) {
    // emit levels to main app
    let _ = app_handle.emit("mic-level", levels);

    // also emit to the recording overlay if it's open
    if let Some(overlay_window) = app_handle.get_webview_window("recording_overlay") {
        let _ = overlay_window.emit("mic-level", levels);

        // Skip repositioning during streaming - the window is expanded and
        // repositioning with the original dimensions would push it off-screen
        if STREAMING_ACTIVE.load(Ordering::SeqCst) {
            return;
        }

        // Update overlay position dynamically to follow cursor across monitors
        let current_settings = settings::get_settings(app_handle);
        if current_settings.overlay_position != OverlayPosition::None {
            if let Some((x, y)) = calculate_overlay_position(app_handle) {
                let _ = overlay_window
                    .set_position(tauri::Position::Logical(tauri::LogicalPosition { x, y }));
            }
        }
    }
}

/// Ensures the overlay window exists, recreating it if it was destroyed.
/// This is used by the health check system to recover from system sleep/idle.
pub fn ensure_overlay_exists(app_handle: &AppHandle) {
    let needs_recreation = if let Some(window) = app_handle.get_webview_window("recording_overlay") {
        // Check if window is actually valid by trying to query its state
        // If is_visible() returns an error, the window handle is stale/invalid
        window.is_visible().is_err()
    } else {
        // Window doesn't exist at all
        true
    };

    if needs_recreation {
        debug!("Health check: Overlay window missing or invalid, recreating...");
        // First try to destroy the old one if it exists
        if let Some(old_window) = app_handle.get_webview_window("recording_overlay") {
            let _ = old_window.destroy();
        }
        create_recording_overlay(app_handle);
    }
}

