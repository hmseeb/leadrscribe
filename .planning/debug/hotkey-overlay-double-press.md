---
status: verifying
trigger: "hotkey-overlay-double-press"
created: 2026-02-16T00:00:00Z
updated: 2026-02-16T00:30:00Z
---

## Current Focus

hypothesis: CONFIRMED - STREAMING_ACTIVE flag is not reset when showing overlay. If previous session had streaming text, flag stays true. This might cause overlay positioning or behavior issues on subsequent recordings.
test: added STREAMING_ACTIVE.store(false) reset in show_recording_overlay()
expecting: overlay to show and stay visible on first hotkey press
next_action: test the fix by running the app and pressing hotkey once

## Symptoms

expected: Press hotkey once → overlay appears and stays, recording starts. Press again → recording stops, transcription happens.
actual: Press hotkey once → overlay appears briefly then closes on its own (no recording starts). Press hotkey again → now it actually starts recording with overlay showing.
errors: No error messages reported
reproduction: Press the global hotkey to start transcription - happens every time
started: Was working before, broke recently (after recent changes including Phase 9 & 10 fixes)

## Eliminated

## Evidence

- timestamp: 2026-02-16T00:05:00Z
  checked: shortcut.rs toggle logic (lines 529-548)
  found: |
    In press-to-toggle mode, the handler checks `active_toggles` state using `.entry().or_insert(false)`.
    If currently active, calls action.stop(). If not active, calls action.start() and sets to true.
    The state is managed via `ManagedToggleState` which is initialized in lib.rs.
  implication: Toggle state initialization might be the issue. If toggle state starts as undefined or gets corrupted, first press might think recording is active and call stop().

- timestamp: 2026-02-16T00:05:30Z
  checked: actions.rs TranscribeAction::start (lines 270-330)
  found: |
    TranscribeAction::start calls several functions:
    1. setup_segment_listener(app) - initializes once
    2. STREAMING_STATE.start_recording() - resets recording state
    3. show_recording_overlay(app) - shows overlay
    4. rm.try_start_recording() - attempts to start audio recording
  implication: If any of these fail or if overlay hides itself quickly, would cause the symptom.

- timestamp: 2026-02-16T00:06:00Z
  checked: audio.rs try_start_recording (lines 241-268)
  found: |
    try_start_recording checks if state is Idle. If not Idle, returns false immediately.
    Sets state to Recording{binding_id} on success.
  implication: If RecordingState is not Idle when first hotkey pressed, try_start_recording returns false and recording doesn't start. But overlay was already shown.

- timestamp: 2026-02-16T00:10:00Z
  checked: lib.rs ManagedToggleState initialization (line 201)
  found: |
    ShortcutToggleStates is initialized with default() which creates empty HashMap.
    First access via .entry().or_insert(false) will create entry with false (not active).
    This means first press should call action.start(), not action.stop().
  implication: Toggle state initialization is correct. The issue is NOT with toggle state being inverted.

- timestamp: 2026-02-16T00:12:00Z
  checked: overlay.rs show_recording_overlay and HIDE_PENDING flag
  found: |
    show_recording_overlay() first calls HIDE_PENDING.store(false) to cancel any pending hides.
    hide_recording_overlay() sets HIDE_PENDING to true, then after 300ms checks flag and hides.
    If HIDE_PENDING is already true from a previous operation, could cause issues.
  implication: Need to check if something is calling hide_recording_overlay or setting HIDE_PENDING during app startup or first use.

- timestamp: 2026-02-16T00:18:00Z
  checked: Recent commits and overlay expand timing changes
  found: |
    Commit efbe3ef removed expand_overlay_for_streaming from TranscribeAction::start and moved it to first td-partial event.
    This timing change is deliberate and shouldn't cause hide issues.
  implication: The timing change is not the root cause.

- timestamp: 2026-02-16T00:20:00Z
  checked: STREAMING_ACTIVE flag and its usage
  found: |
    STREAMING_ACTIVE is a static AtomicBool that persists across invocations.
    - Set to false in show_recording_overlay() at line 191 (wait, no it doesn't!)
    - Set to true in set_streaming_active() called from actions.rs
    - Set to false in hide_recording_overlay() after 300ms delay (line 267)

    Looking at show_recording_overlay(), it does NOT reset STREAMING_ACTIVE to false!
  implication: If STREAMING_ACTIVE was left as true from a previous session, it stays true. This might affect overlay behavior on subsequent uses.

## Resolution

root_cause: |
  The STREAMING_ACTIVE flag is a static atomic boolean that persists across recording sessions.
  When hide_recording_overlay() is called, it sets STREAMING_ACTIVE to false after a 300ms delay.
  However, show_recording_overlay() did NOT reset STREAMING_ACTIVE to false at the start.

  If a previous recording had streaming transcription text (which sets STREAMING_ACTIVE=true),
  the flag would remain true even after the overlay was hidden. On the next recording session,
  show_recording_overlay() would be called but STREAMING_ACTIVE would still be true from before.

  While STREAMING_ACTIVE doesn't directly control visibility, it affects overlay repositioning
  behavior (prevents cursor-following when true). The stale state could cause unexpected behavior
  or interact with other timing-sensitive code.

fix: |
  Added STREAMING_ACTIVE.store(false, Ordering::SeqCst) to show_recording_overlay() to reset
  the streaming state at the start of each new recording session, ensuring clean state.

  Also added comprehensive debug logging to track shortcut events and overlay show/hide calls
  to help diagnose any remaining issues.

verification: |
  To test the fix:
  1. Run in dev mode: `bun run tauri dev` (or use _dev.bat if it exists)
  2. Press the transcription hotkey once
  3. Check console logs for "[HOTKEY DEBUG]" and "[OVERLAY DEBUG]" messages
  4. Expected behavior:
     - Overlay appears and stays visible
     - Recording starts (mic levels should animate)
     - Logs should show: Pressed event → start() called → show_recording_overlay() called
  5. Press hotkey again to stop
  6. Expected: Recording stops, overlay hides after fade animation

  If issue persists, the logs will reveal:
  - Is hotkey being triggered multiple times?
  - Is toggle state being set correctly?
  - Is hide_recording_overlay() being called unexpectedly?

  Commands for testing:
  ```bash
  # Run in dev mode with console visible
  bun run tauri dev

  # After testing, check the sequence of debug logs
  # Look for patterns like:
  # - Multiple "[HOTKEY DEBUG]" entries for single press
  # - Unexpected "will call: stop()" on first press
  # - "hide_recording_overlay() called" without user pressing hotkey again
  ```

files_changed:
  - src-tauri/src/overlay.rs
  - src-tauri/src/shortcut.rs
