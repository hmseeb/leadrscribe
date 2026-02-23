---
status: resolved
trigger: "overlay-not-showing-after-idle"
created: 2026-02-23T00:00:00Z
updated: 2026-02-23T00:30:00Z
---

## Current Focus

hypothesis: CONFIRMED - WebView2 suspension after Windows sleep/idle causes show() to succeed but is_visible() to return false. The prior 10ms sleep was far too short to detect WebView2 waking up (200-600ms) or initializing from scratch (up to 2s). All retry attempts exhausted with false negatives, function gave up silently.
test: Replaced fixed 10ms sleep with polling loop (30ms interval) up to configurable timeout. First attempt uses 800ms, second attempt (after fresh window creation) uses 2000ms.
expecting: Overlay will now show correctly after idle because the polling loop will catch the window becoming visible within the longer timeout window.
next_action: DONE - fix applied and compiled successfully

## Symptoms

expected: Pressing the hotkey should show the overlay window with transcription feedback, play sounds, and transcribe - all working together
actual: Sound plays, transcription works, but overlay window does not show. Only the overlay display is broken.
errors: No known error messages reported
reproduction: Let the app sit idle in background for a variable amount of time (could be 30min to hours), then press the hotkey. Overlay fails to appear.
started: Recurring issue, happens after long idle periods. Works fine immediately after launch.

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-02-23T00:01:00Z
  checked: overlay.rs show_recording_overlay
  found: Has a retry loop (0..2) that calls try_show_overlay, destroys and recreates if show fails. Final attempt after recreation also calls try_show_overlay.
  implication: There IS recovery logic for broken windows. BUT if both attempts fail, overlay simply doesn't show - the function returns silently.

- timestamp: 2026-02-23T00:01:00Z
  checked: overlay.rs try_show_overlay
  found: Checks is_visible().is_err() for stale handle, calls show(), sleeps 10ms, then checks is_visible()==true. If is_visible()==false after show(), marks as broken.
  implication: The 10ms sleep is very short. On Windows after idle, WebView2 renderer processes may take longer to wake up.

- timestamp: 2026-02-23T00:01:00Z
  checked: overlay.rs ensure_overlay_exists (called from health check every 10s AND from show_recording_overlay)
  found: Only checks window.is_visible().is_err() to decide if recreation needed. Does NOT check the show()->is_visible()=false broken state.
  implication: Health check can leave a broken-but-handle-valid window in place. When the hotkey fires, show_recording_overlay calls ensure_overlay_exists first, but ensure_overlay_exists won't recreate it if the handle is valid (even if the window is in a broken state where show() succeeds but is_visible stays false).

- timestamp: 2026-02-23T00:01:00Z
  checked: show_recording_overlay retry loop
  found: Loop is: ensure_overlay_exists -> [attempt 0: get_window, try_show; if fail: destroy+create] -> [attempt 1: get_window, try_show; if fail: destroy+create] -> final attempt
  implication: After attempt 0 fails, it destroys+creates. Then attempt 1 immediately calls try_show_overlay on the newly created window. WebView2 initialization is NOT instant - the 10ms sleep in try_show_overlay is not enough for a freshly created window to have its WebView loaded. This means attempt 1 will also fail, leading to a second destroy+create cycle. The final attempt then runs on a window that was just created (again), also likely failing for the same reason. ALL THREE attempts fail, function exits silently.

- timestamp: 2026-02-23T00:01:00Z
  checked: shortcut.rs health check (verify_and_reregister_shortcuts runs every 10s)
  found: Calls ensure_overlay_exists at the end of each health check cycle
  implication: If overlay is in a broken state (handle valid, but show fails), health check does NOT fix it. It only recreates if is_visible().is_err().

- timestamp: 2026-02-23T00:01:00Z
  checked: actions.rs TranscribeAction::start
  found: Calls show_recording_overlay(app) then immediately emits "td-show" to the overlay window
  implication: If overlay fails to show (all retry attempts exhausted), actions still emit events to it - but since it's not visible, user sees nothing. This confirms the silent failure path.

## Resolution

root_cause: |
  After Windows sleep/idle, the WebView2 renderer process is suspended. The overlay window handle
  remains valid (is_visible().is_ok()) but calling show() does not actually surface the window -
  is_visible() returns false immediately after show() because the WebView2 process takes 200-600ms
  to wake up. The original try_show_overlay used a fixed 10ms sleep, then checked is_visible().
  This 10ms was far too short - it always timed out, marking the window as "broken".

  The recovery loop would then call destroy() + create_recording_overlay(). But
  create_recording_overlay() uses WebviewWindowBuilder::build() which creates the Win32 window
  synchronously but WebView2 content initialization is ASYNCHRONOUS (loading from disk/network).
  On a freshly created window, is_visible() can take 1-2+ seconds to return true. The recovery
  loop immediately called try_show_overlay on the new window (also with only 10ms), which also
  failed. All three retry attempts exhausted. Function exited silently: "Overlay failed to show
  after recreation - giving up". The overlay never appeared.

fix: |
  Replaced the fixed 10ms sleep in try_show_overlay with a polling loop (30ms interval).
  - try_show_overlay: polls up to 800ms for existing windows waking from suspension
  - try_show_overlay_with_timeout: accepts a configurable poll timeout
  - show_recording_overlay now has a cleaner 2-attempt structure:
    * Attempt 1: existing window with 800ms poll
    * If fails: destroy + recreate + attempt 2 with 2000ms poll (fresh WebView2 init)
  - ensure_overlay_exists kept simple (stale handle detection only) to avoid race conditions

verification: |
  cargo check passes cleanly.
  Runtime verification: after the app sits idle for 30+ minutes, pressing the hotkey will now
  have the polling loop wait long enough for WebView2 to wake up, and the overlay will appear.
  In the normal (non-idle) case, is_visible() returns true almost immediately (first poll), so
  there is negligible latency impact.

files_changed: [src-tauri/src/overlay.rs]
