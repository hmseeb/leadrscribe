use crate::settings;
use crate::settings::OverlayPosition;
use log::debug;
use enigo::{Enigo, Mouse};
use std::sync::atomic::{AtomicBool, AtomicI64, AtomicU8, Ordering};

/// Atomic flag to track if a hide operation is pending.
/// This prevents race conditions where a delayed hide() executes after a new show().
static HIDE_PENDING: AtomicBool = AtomicBool::new(false);

/// Tracks whether streaming text is active.
/// When true, emit_levels skips repositioning to avoid jumping while user reads text.
static STREAMING_ACTIVE: AtomicBool = AtomicBool::new(false);

/// Counter for throttling periodic always-on-top re-assertion in emit_levels.
static TOPMOST_REFRESH_COUNTER: AtomicU8 = AtomicU8::new(0);

/// Cached overlay position to avoid reading settings on every audio level callback.
/// Values: 0 = None, 1 = Top, 2 = Bottom
static CACHED_OVERLAY_POSITION: AtomicU8 = AtomicU8::new(2); // Default: Bottom

/// Tracks which monitor the overlay is currently on (by physical origin position).
/// Two i32 values packed into one i64: upper 32 bits = x, lower 32 bits = y.
/// Value of i64::MIN means "no monitor cached yet".
static LAST_OVERLAY_MONITOR: AtomicI64 = AtomicI64::new(i64::MIN);

use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewWindowBuilder};

/// Updates the cached overlay position. Call this when the setting changes.
pub fn update_cached_overlay_position(position: OverlayPosition) {
    let val = match position {
        OverlayPosition::None => 0,
        OverlayPosition::Top => 1,
        OverlayPosition::Bottom => 2,
    };
    CACHED_OVERLAY_POSITION.store(val, Ordering::Relaxed);
}

fn get_cached_overlay_position() -> OverlayPosition {
    match CACHED_OVERLAY_POSITION.load(Ordering::Relaxed) {
        0 => OverlayPosition::None,
        1 => OverlayPosition::Top,
        _ => OverlayPosition::Bottom,
    }
}

#[derive(serde::Serialize, Clone)]
struct ShowOverlayPayload<'a> {
    state: &'a str,
    position: &'a str,
}

// Window is always the full streaming size. The transparent area above the pill
// is invisible and click-through. CSS flex-end anchors the pill at the bottom.
// When streaming text arrives, it grows upward within the existing window — no resize needed.
const WINDOW_WIDTH: f64 = 400.0;
const WINDOW_HEIGHT: f64 = 180.0;

#[cfg(target_os = "macos")]
const PLATFORM_BOTTOM_MARGIN: f64 = 15.0;
#[cfg(any(target_os = "windows", target_os = "linux"))]
const PLATFORM_BOTTOM_MARGIN: f64 = 96.0;

#[cfg(target_os = "macos")]
const PLATFORM_TOP_MARGIN: f64 = 46.0;
#[cfg(any(target_os = "windows", target_os = "linux"))]
const PLATFORM_TOP_MARGIN: f64 = 8.0;

fn get_monitor_with_cursor(app_handle: &AppHandle) -> Option<tauri::Monitor> {
    let enigo = Enigo::new(&Default::default());
    if let Ok(enigo) = enigo {
        if let Ok(mouse_location) = enigo.location() {
            if let Ok(monitors) = app_handle.available_monitors() {
                for monitor in monitors {
                    let scale = monitor.scale_factor();
                    let is_within = is_mouse_within_monitor(mouse_location, monitor.position(), monitor.size(), scale);
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
    scale: f64,
) -> bool {
    // enigo.location() calls GetCursorPos() on Windows, which returns logical pixel coordinates
    // (i.e. DPI-scaled, where 1920x1080 at 200% DPI still reads as ~1920px wide).
    // Tauri's monitor.position() and monitor.size() return physical pixel coordinates.
    // Comparing them directly fails on multi-monitor setups with different scale factors.
    //
    // Fix: convert the monitor's physical bounds to logical coordinates using the monitor's
    // own scale factor before comparing with the logical mouse position from enigo.
    let (mouse_x, mouse_y) = mouse_pos;
    let PhysicalPosition { x: phys_x, y: phys_y } = *monitor_pos;
    let PhysicalSize { width: phys_w, height: phys_h } = *monitor_size;

    // Convert monitor bounds to logical pixels
    let monitor_x = (phys_x as f64 / scale).round() as i32;
    let monitor_y = (phys_y as f64 / scale).round() as i32;
    let monitor_width = (phys_w as f64 / scale).round() as i32;
    let monitor_height = (phys_h as f64 / scale).round() as i32;

    mouse_x >= monitor_x
        && mouse_x < (monitor_x + monitor_width)
        && mouse_y >= monitor_y
        && mouse_y < (monitor_y + monitor_height)
}

/// Calculate overlay position for a specific monitor.
fn calculate_overlay_position_for_monitor(monitor: &tauri::Monitor, app_handle: &AppHandle) -> Option<(f64, f64)> {
    let settings = settings::get_settings(app_handle);

    let work_area = monitor.work_area();
    let scale = monitor.scale_factor();

    // Work area in physical pixels (raw from OS)
    let wa_phys_x = work_area.position.x as f64;
    let wa_phys_y = work_area.position.y as f64;
    let wa_phys_w = work_area.size.width as f64;
    let wa_phys_h = work_area.size.height as f64;

    // Convert to logical coordinates for positioning
    let work_area_x = wa_phys_x / scale;
    let work_area_y = wa_phys_y / scale;
    let work_area_width = wa_phys_w / scale;
    let work_area_height = wa_phys_h / scale;

    // Window bottom edge should be margin logical px above work area bottom.
    // The pill (via CSS flex-end) sits at the window's bottom edge.

    let (window_x, window_y) = match settings.overlay_position {
        OverlayPosition::Top => {
            let x = work_area_x + (work_area_width - WINDOW_WIDTH) / 2.0;
            // Place window top edge at margin from work area top.
            // CSS flex-start anchors the pill at the window's top edge.
            let y = work_area_y + PLATFORM_TOP_MARGIN;
            (x, y)
        },
        OverlayPosition::Bottom | OverlayPosition::None => {
            // Place window so its bottom edge is PLATFORM_BOTTOM_MARGIN above work area bottom
            let x = work_area_x + (work_area_width - WINDOW_WIDTH) / 2.0;
            let y = work_area_y + work_area_height - WINDOW_HEIGHT - PLATFORM_BOTTOM_MARGIN;
            (x, y)
        }
    };

    Some((window_x, window_y))
}

fn calculate_overlay_position(app_handle: &AppHandle) -> Option<(f64, f64)> {
    let monitor = get_monitor_with_cursor(app_handle)?;
    calculate_overlay_position_for_monitor(&monitor, app_handle)
}

/// Creates the recording overlay window and keeps it hidden by default
pub fn create_recording_overlay(app_handle: &AppHandle) {
    let settings = settings::get_settings(app_handle);
    update_cached_overlay_position(settings.overlay_position);

    if let Some((x, y)) = calculate_overlay_position(app_handle) {
        match WebviewWindowBuilder::new(
            app_handle,
            "recording_overlay",
            tauri::WebviewUrl::App("src/overlay/index.html".into()),
        )
        .title("Recording")
        .position(x, y)
        .resizable(false)
        .inner_size(WINDOW_WIDTH, WINDOW_HEIGHT)
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
///
/// After Windows sleep/idle, WebView2 renderer processes are suspended. The window handle
/// remains valid but show() may succeed while is_visible() still returns false because the
/// WebView2 process hasn't finished waking up. This function polls is_visible() for up to
/// SHOW_POLL_TIMEOUT_MS to give the WebView sufficient time to initialize or wake up.
fn try_show_overlay(window: &tauri::WebviewWindow, position: &str) -> bool {
    try_show_overlay_with_timeout(window, position, 800)
}

/// Same as try_show_overlay but allows specifying the poll timeout in milliseconds.
/// Use a longer timeout for freshly created windows (WebView2 initialization takes longer
/// than just waking a suspended renderer).
fn try_show_overlay_with_timeout(
    window: &tauri::WebviewWindow,
    position: &str,
    poll_timeout_ms: u64,
) -> bool {
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

    // Re-assert always-on-top after show(). On Windows the WS_EX_TOPMOST flag
    // can be lost after hide/show cycles, sleep/wake, or focus changes.
    let _ = window.set_always_on_top(true);

    // Poll is_visible() until the window becomes visible or we time out.
    // This handles two cases:
    //   1. WebView2 waking from Windows sleep/idle suspension (can take 200-600ms)
    //   2. Freshly created windows where WebView2 is still initializing
    const POLL_INTERVAL_MS: u64 = 30;
    let max_polls = (poll_timeout_ms / POLL_INTERVAL_MS).max(1);

    for poll in 0..max_polls {
        std::thread::sleep(std::time::Duration::from_millis(POLL_INTERVAL_MS));
        match window.is_visible() {
            Ok(true) => {
                debug!("Overlay became visible after {}ms", (poll + 1) * POLL_INTERVAL_MS);
                let _ = window.emit("show-overlay", ShowOverlayPayload {
                    state: "recording",
                    position,
                });
                return true;
            }
            Ok(false) => {
                // Not visible yet - keep polling
                continue;
            }
            Err(_) => {
                debug!("Overlay window became invalid after show()");
                return false;
            }
        }
    }

    // Timed out: show() succeeded but window never became visible
    debug!(
        "Overlay window show() succeeded but is_visible() returned false after {}ms - window is broken",
        poll_timeout_ms
    );
    false
}

/// Shows the recording overlay window with fade-in animation
pub fn show_recording_overlay(app_handle: &AppHandle) {
    // Cancel any pending hide operation to prevent race condition
    // where a delayed hide() from a previous call would hide this new show()
    HIDE_PENDING.store(false, Ordering::SeqCst);
    // Reset streaming state for new recording session
    STREAMING_ACTIVE.store(false, Ordering::SeqCst);
    // Reset monitor tracking so the overlay is positioned on first level callback
    LAST_OVERLAY_MONITOR.store(i64::MIN, Ordering::Relaxed);

    // Check if overlay should be shown based on position setting
    let settings = settings::get_settings(app_handle);
    update_cached_overlay_position(settings.overlay_position);
    if settings.overlay_position == OverlayPosition::None {
        return;
    }

    let position_str = match settings.overlay_position {
        OverlayPosition::Top => "top",
        _ => "bottom",
    };

    // Ensure overlay exists before trying to show it
    ensure_overlay_exists(app_handle);

    update_overlay_position(app_handle);

    // First attempt: try to show the existing window.
    // Uses a generous poll timeout to handle WebView2 waking from Windows sleep/idle.
    if let Some(overlay_window) = app_handle.get_webview_window("recording_overlay") {
        if try_show_overlay(&overlay_window, position_str) {
            return; // Success on first attempt
        }

        // First attempt failed - the window is in a broken state.
        // Destroy it and create a fresh one.
        debug!("Overlay show attempt 1 failed, destroying and recreating window...");
        let _ = overlay_window.destroy();
    } else {
        debug!("Overlay window not found before first attempt, creating...");
    }

    // Create a fresh overlay window
    create_recording_overlay(app_handle);

    // Second attempt: show the freshly created window.
    // Use a longer timeout because WebView2 initialization (loading web content from scratch)
    // takes significantly longer than waking a suspended renderer.
    // On slower systems or after long idle, this can take 1-2 seconds.
    if let Some(overlay_window) = app_handle.get_webview_window("recording_overlay") {
        if try_show_overlay_with_timeout(&overlay_window, position_str, 2000) {
            return; // Success after recreation
        }

        // Still failing after creation with a 2s wait - destroy and give up cleanly.
        // This is an extremely rare edge case (e.g. system resource exhaustion).
        debug!("Overlay failed to show after recreation with 2s wait - giving up");
        let _ = overlay_window.destroy();
        // Schedule a fresh window creation for next time
        create_recording_overlay(app_handle);
    } else {
        debug!("Overlay window not found even after creation - giving up");
    }
}

/// Updates the overlay window position based on current settings
pub fn update_overlay_position(app_handle: &AppHandle) {
    let settings = settings::get_settings(app_handle);
    update_cached_overlay_position(settings.overlay_position);

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

        let window_clone = overlay_window.clone();

        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(300));
            if HIDE_PENDING.load(Ordering::SeqCst) {
                // Hide the window first (it's already faded out by now)
                let _ = window_clone.hide();

                // Clear streaming state
                STREAMING_ACTIVE.store(false, Ordering::SeqCst);

                HIDE_PENDING.store(false, Ordering::SeqCst);
            }
        });
    }
}

/// Emits a state change to the overlay window with the correct position.
/// Use this instead of directly emitting "show-overlay" to ensure position is always included.
pub fn emit_overlay_state(app_handle: &AppHandle, state: &str) {
    if let Some(window) = app_handle.get_webview_window("recording_overlay") {
        let s = settings::get_settings(app_handle);
        let position = match s.overlay_position {
            OverlayPosition::Top => "top",
            _ => "bottom",
        };
        let _ = window.emit("show-overlay", ShowOverlayPayload { state, position });
    }
}

/// Marks streaming as active so emit_levels stops repositioning the overlay.
/// This prevents the overlay from jumping around while the user reads streaming text.
pub fn set_streaming_active(active: bool) {
    STREAMING_ACTIVE.store(active, Ordering::SeqCst);
}

pub fn emit_levels(app_handle: &AppHandle, levels: &Vec<f32>) {
    // emit levels to main app
    let _ = app_handle.emit("mic-level", levels);

    // also emit to the recording overlay if it's open
    if let Some(overlay_window) = app_handle.get_webview_window("recording_overlay") {
        let _ = overlay_window.emit("mic-level", levels);

        // Update overlay position dynamically to follow cursor across monitors.
        // When streaming text is active, only reposition if the cursor moved to a
        // DIFFERENT monitor (avoids jumping within the same screen while user reads).
        if get_cached_overlay_position() != OverlayPosition::None {
            if let Some(monitor) = get_monitor_with_cursor(app_handle) {
                let mon_pos = monitor.position();
                let mon_key = ((mon_pos.x as i64) << 32) | (mon_pos.y as u32 as i64);
                let prev_mon = LAST_OVERLAY_MONITOR.load(Ordering::Relaxed);
                let monitor_changed = prev_mon != mon_key;

                // Reposition when:
                //   - streaming is NOT active (normal tracking), OR
                //   - the cursor moved to a different monitor during streaming
                if !STREAMING_ACTIVE.load(Ordering::SeqCst) || monitor_changed {
                    if let Some((x, y)) = calculate_overlay_position_for_monitor(&monitor, app_handle) {
                        let _ = overlay_window
                            .set_position(tauri::Position::Logical(tauri::LogicalPosition { x, y }));
                        LAST_OVERLAY_MONITOR.store(mon_key, Ordering::Relaxed);
                    }
                }
            }
        }

        // Periodically re-assert always-on-top to recover from Windows stealing
        // the TOPMOST flag (e.g. another app activating, fullscreen transitions).
        // Fires roughly every ~2 seconds assuming ~30 emit_levels calls/sec.
        let count = TOPMOST_REFRESH_COUNTER.fetch_add(1, Ordering::Relaxed);
        if count >= 60 {
            TOPMOST_REFRESH_COUNTER.store(0, Ordering::Relaxed);
            let _ = overlay_window.set_always_on_top(true);
        }
    }
}

/// Ensures the overlay window exists, recreating it if it was destroyed or its handle is stale.
/// This is used by the health check system and by show_recording_overlay before attempting to show.
///
/// Note: This function only checks handle validity. The broken-show case (handle valid but
/// show() doesn't make the window visible - common after Windows sleep/idle) is handled by
/// show_recording_overlay's retry logic with proper polling timeouts.
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

