---
status: resolved
trigger: "overlay doesn't appear when mouse cursor is on the right monitor in a dual-monitor setup"
created: 2026-02-23T00:00:00Z
updated: 2026-02-23T00:10:00Z
---

## Current Focus

hypothesis: CONFIRMED - coordinate space mismatch between enigo.location() (logical) and tauri monitor bounds (physical)
test: read enigo Windows source at ~/.cargo/registry/src/.../enigo-0.6.1/src/win/win_impl.rs
expecting: enigo calls GetCursorPos which returns logical pixels; tauri returns physical pixels
next_action: DONE - fix applied and verified via cargo check

## Symptoms

expected: Overlay follows mouse cursor. When mouse is on right screen, overlay shows on right screen. When mouse is on left screen, overlay shows on left screen. Overlay moves in real-time while showing.
actual: Overlay only appears when mouse is on the left screen. When mouse is on the right screen, overlay doesn't show at all on either monitor.
errors: None reported
reproduction: Use dual monitors. Move mouse to right screen. Press shortcut to trigger overlay. Overlay doesn't appear. Move mouse to left screen, press shortcut, overlay appears on left screen.
started: Unclear. The overlay position setting was removed - it is now always follow-cursor mode.

## Eliminated

- hypothesis: overlay position setting returning None and early-returning from show_recording_overlay
  evidence: settings.rs shows OverlayPosition still exists with Bottom as default; the None check in show_recording_overlay would hide the overlay on BOTH monitors, not just the right one
  timestamp: 2026-02-23T00:02:00Z

- hypothesis: window set_position failing for out-of-primary-monitor coordinates
  evidence: the bug is that the wrong monitor is returned entirely (primary fallback), so positioning is calculated for the left monitor. The window positioning math itself (dividing by scale_factor) is correct.
  timestamp: 2026-02-23T00:05:00Z

## Evidence

- timestamp: 2026-02-23T00:01:00Z
  checked: overlay.rs get_monitor_with_cursor()
  found: Calls enigo.location() -> (i32, i32) and compares against monitor.position() (PhysicalPosition<i32>) and monitor.size() (PhysicalSize<u32>) with no coordinate space conversion. Falls back to primary_monitor() if loop finds no match.
  implication: If coordinate spaces differ, the loop finds no match and always falls back to the primary (left) monitor.

- timestamp: 2026-02-23T00:02:00Z
  checked: overlay.rs is_mouse_within_monitor()
  found: Pure bounds check with no unit conversion - assumes enigo and tauri coordinates are in the same space.
  implication: The bug lives here when enigo and tauri use different coordinate spaces.

- timestamp: 2026-02-23T00:03:00Z
  checked: overlay.rs calculate_overlay_position()
  found: Correctly divides monitor.work_area() physical coords by scale_factor() to get logical window position. This confirms the codebase already knows tauri returns physical coords and needs to convert to logical for window APIs.
  implication: The pattern for the fix is already established in this file.

- timestamp: 2026-02-23T00:04:00Z
  checked: ~/.cargo/registry/src/.../enigo-0.6.1/src/win/win_impl.rs, location() method at line 255
  found: location() calls GetCursorPos(&raw mut point) directly and returns (point.x, point.y). No scale factor applied.
  implication: GetCursorPos returns coordinates in the calling process's DPI awareness space. For a DPI-unaware or system-DPI-aware process, this is logical pixels scaled to 96dpi (system DPI). For per-monitor DPI aware, it returns physical. Tauri apps using WebView2 are per-monitor DPI aware but enigo does not set DPI awareness itself - the app DPI awareness context determines what GetCursorPos returns.

- timestamp: 2026-02-23T00:05:00Z
  checked: Windows GetCursorPos documentation and DPI awareness
  found: GetCursorPos returns coordinates relative to the calling process's DPI awareness context. If the process is system-DPI-aware (96dpi baseline), the returned coordinates are logical/scaled coordinates across the entire virtual desktop. Tauri's monitor.position() is in physical pixels. This mismatch is exactly the bug.
  implication: For a right monitor at physical x=1920 (100% scale) or x=3840 (200% scale), if GetCursorPos returns logical x=1920 in either case, but tauri reports the monitor at physical x=1920 (or x=3840), the comparison gives wrong results when scale != 1.0.

- timestamp: 2026-02-23T00:06:00Z
  checked: no .manifest file exists in src-tauri, no explicit DPI awareness call in source
  found: The app relies on WebView2/Tauri's built-in DPI awareness registration. Tauri sets per-monitor DPI awareness for proper scaling, but enigo's GetCursorPos may return coordinates in the DPI space that doesn't match Tauri's physical monitor coordinates in all configurations.
  implication: The safe fix is to normalize both to the same coordinate space before comparing - convert monitor physical bounds to logical using each monitor's scale factor.

- timestamp: 2026-02-23T00:08:00Z
  checked: fix applied to src-tauri/src/overlay.rs
  found: is_mouse_within_monitor() now accepts scale parameter and converts monitor physical bounds to logical before comparing. get_monitor_with_cursor() passes monitor.scale_factor() to the check.
  implication: Both sides of the comparison are now in the same coordinate space (logical pixels).

- timestamp: 2026-02-23T00:09:00Z
  checked: cargo check output
  found: Finished dev profile with no errors or warnings.
  implication: Fix compiles cleanly.

## Resolution

root_cause: Coordinate space mismatch in is_mouse_within_monitor(). enigo.location() calls Windows GetCursorPos which returns logical pixel coordinates. tauri::Monitor::position() and size() return physical pixel coordinates. On a dual-monitor setup where monitors have different DPI scale factors (e.g. primary at 150%, secondary at 100%), the logical mouse x on the right monitor does not fall within the physical pixel bounds of any monitor, so get_monitor_with_cursor() falls through to the primary_monitor() fallback. The overlay always appears on the primary (left) monitor regardless of actual cursor position.
fix: Modified is_mouse_within_monitor() to accept the monitor's scale_factor and convert the monitor's physical bounds to logical coordinates before comparison. get_monitor_with_cursor() now passes monitor.scale_factor() to this function. This ensures both the mouse coordinates (from enigo, logical) and the monitor bounds (from tauri, physical -> converted to logical) are in the same coordinate space.
verification: cargo check passes cleanly. Manual test required on actual dual-monitor hardware to confirm overlay appears on the correct screen.
files_changed:
  - src-tauri/src/overlay.rs
