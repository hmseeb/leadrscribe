---
phase: 11-fix-all-audit-findings
plan: 04
subsystem: audio-recording, shortcut-system, commands
tags: [deadlock-prevention, thread-safety, refactoring, separation-of-concerns]
dependency_graph:
  requires: [11-01, 11-03]
  provides: [consolidated-audio-mutex, stoppable-health-check, settings-module]
  affects: [audio-recording, keyboard-shortcuts, settings-management]
tech_stack:
  added: [commands/settings.rs, RecordingInner, HEALTH_CHECK_SHUTDOWN]
  patterns: [consolidated-mutex, atomic-shutdown-flag, module-separation]
key_files:
  created:
    - src-tauri/src/commands/settings.rs
  modified:
    - src-tauri/src/managers/audio.rs
    - src-tauri/src/shortcut.rs
    - src-tauri/src/commands/mod.rs
    - src-tauri/src/lib.rs
decisions:
  - Consolidated 6 separate Arc<Mutex<T>> fields into single Arc<Mutex<RecordingInner>> to eliminate lock ordering issues
  - Used AtomicBool for health-check shutdown signal (Ordering::Relaxed sufficient for termination flag)
  - Created commands/settings.rs to separate settings commands from shortcut logic
  - Drop lock before calling nested methods to avoid self-deadlock
metrics:
  duration: 6 min
  completed: 2026-02-17
  tasks: 2
  files: 5
---

# Phase 11 Plan 04: Fix Deadlock Risk & Refactor Settings Summary

Eliminated deadlock risk in AudioRecordingManager, added clean shutdown for health-check thread, and separated settings commands into proper module.

## Objective

Fix the deadlock risk in AudioRecordingManager from inconsistent lock ordering, add shutdown mechanism for the health-check thread, and move misplaced settings commands out of shortcut.rs into their proper home.

## Tasks Completed

### Task 1: Consolidate AudioRecordingManager mutexes to prevent deadlock

**Changes:**
- Created `RecordingInner` struct consolidating: state, mode, recorder, is_open, is_recording, initial_volume
- Replaced 6 separate `Arc<Mutex<T>>` fields with single `Arc<Mutex<RecordingInner>>`
- Refactored all methods to lock `inner` once at the top and access fields through single guard
- Added explicit lock dropping before nested method calls to avoid self-deadlock

**Critical pattern:**
```rust
pub fn try_start_recording(&self, binding_id: &str) -> bool {
    let mut inner = self.inner.lock().unwrap();

    if matches!(inner.mode, MicrophoneMode::OnDemand) {
        // Drop lock before calling start_microphone_stream which also locks
        drop(inner);
        if let Err(e) = self.start_microphone_stream() {
            error!("Failed to open microphone stream: {e}");
            return false;
        }
        inner = self.inner.lock().unwrap();
    }
    // ... rest of method
}
```

**Files modified:**
- `src-tauri/src/managers/audio.rs`

**Commit:** c2cd86d

### Task 2: Add thread shutdown + refactor settings commands out of shortcut.rs

**Changes:**

1. **Health-check thread shutdown:**
   - Added `static HEALTH_CHECK_SHUTDOWN: AtomicBool` flag
   - Modified thread loop to check flag every 10 seconds and break on shutdown signal
   - Added `shutdown_health_check()` public function to trigger shutdown

2. **Settings module separation:**
   - Created `src-tauri/src/commands/settings.rs` with all settings commands
   - Moved 20 functions from shortcut.rs to settings.rs:
     - change_ptt_setting
     - change_audio_feedback_setting
     - change_audio_feedback_volume_setting
     - change_sound_theme_setting
     - change_translate_to_english_setting
     - change_selected_language_setting
     - change_overlay_position_setting
     - change_debug_mode_setting
     - change_start_hidden_setting
     - change_autostart_setting
     - update_custom_words
     - change_word_correction_threshold_setting
     - change_paste_method_setting
     - change_clipboard_handling_setting
     - change_mute_while_recording_setting
     - change_output_mode_setting
     - get_openrouter_api_key_setting
     - change_openrouter_api_key_setting
     - change_openrouter_model_setting
     - change_custom_instructions_setting

3. **Updated references:**
   - Added `pub mod settings;` to commands/mod.rs
   - Updated lib.rs invoke_handler to reference `commands::settings::*`
   - Removed unused imports from shortcut.rs (ClipboardHandling, OverlayPosition, PasteMethod, SoundTheme, ManagerExt, Emitter)

**Files modified:**
- `src-tauri/src/shortcut.rs`
- `src-tauri/src/commands/settings.rs` (created)
- `src-tauri/src/commands/mod.rs`
- `src-tauri/src/lib.rs`

**Commit:** 769f6d7

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

1. ✅ `cargo check` passes with only expected dead_code warning for shutdown_health_check
2. ✅ `bun run build` passes (frontend unchanged)
3. ✅ AudioRecordingManager has single consolidated mutex (RecordingInner)
4. ✅ shortcut.rs has no `change_*_setting` functions
5. ✅ commands/settings.rs exists with all 20 settings commands
6. ✅ Health-check thread checks HEALTH_CHECK_SHUTDOWN flag every 10 seconds

## Technical Details

### Mutex Consolidation Benefits

**Before:** 6 separate mutexes with potential lock ordering issues
```rust
state: Arc<Mutex<RecordingState>>,
mode: Arc<Mutex<MicrophoneMode>>,
recorder: Arc<Mutex<Option<AudioRecorder>>>,
is_open: Arc<Mutex<bool>>,
is_recording: Arc<Mutex<bool>>,
initial_volume: Arc<Mutex<Option<u8>>>,
```

**After:** Single mutex with consolidated state
```rust
inner: Arc<Mutex<RecordingInner>>,

struct RecordingInner {
    state: RecordingState,
    mode: MicrophoneMode,
    recorder: Option<AudioRecorder>,
    is_open: bool,
    is_recording: bool,
    initial_volume: Option<u8>,
}
```

**Result:** No risk of inconsistent lock ordering, simpler reasoning about thread safety.

### Thread Shutdown Pattern

```rust
static HEALTH_CHECK_SHUTDOWN: AtomicBool = AtomicBool::new(false);

// In thread loop:
if HEALTH_CHECK_SHUTDOWN.load(Ordering::Relaxed) {
    debug!("Health check thread shutting down");
    break;
}

// Public shutdown function:
pub fn shutdown_health_check() {
    HEALTH_CHECK_SHUTDOWN.store(true, Ordering::Relaxed);
}
```

Ordering::Relaxed is sufficient for a termination flag - no need for stricter ordering guarantees.

### Module Separation Pattern

**Before:** shortcut.rs was a 623-line god-file mixing shortcut logic with settings management

**After:**
- `shortcut.rs` (309 lines): Only shortcut-related functions
- `commands/settings.rs` (314 lines): All settings commands

**Benefits:**
- Clear module boundaries
- Easier to locate settings-related code
- Follows single responsibility principle

## Self-Check: PASSED

**Created files exist:**
```
FOUND: src-tauri/src/commands/settings.rs
```

**Commits exist:**
```
FOUND: c2cd86d
FOUND: 769f6d7
```

**Modified files verified:**
- AudioRecordingManager uses consolidated RecordingInner mutex
- Health-check thread has shutdown signal
- shortcut.rs contains only shortcut functions
- commands/settings.rs contains all settings commands
- lib.rs references commands::settings::* for settings commands

## Impact

**Safety improvements:**
- Eliminated potential deadlock in AudioRecordingManager
- Added clean shutdown mechanism for background thread

**Code quality improvements:**
- Clearer module boundaries
- Better separation of concerns
- Easier to reason about audio recording state

**No breaking changes:**
- Frontend calls same Tauri commands (namespace change is transparent)
- Audio recording behavior unchanged
- Settings management behavior unchanged

## Next Steps

This was the final plan in Phase 11 (Fix All Audit Findings). All audit findings from v0.6.0-MILESTONE-AUDIT.md have been addressed across plans 11-01 through 11-04.
