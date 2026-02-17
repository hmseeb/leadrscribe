---
phase: 09-critical-correctness-fixes
plan: 02
subsystem: model-commands
tags: [bug-fix, onboarding, ui-feedback]
dependency_graph:
  requires:
    - ModelManager.get_available_models()
    - TranscriptionManager.is_loading field
  provides:
    - Accurate download detection for onboarding
    - Correct model loading state for UI
  affects:
    - Onboarding flow
    - Model status UI
    - Loading indicators
tech_stack:
  added: []
  patterns:
    - Exposing internal state via getter methods
    - Matching implementation to documented behavior
key_files:
  created: []
  modified:
    - src-tauri/src/commands/models.rs
    - src-tauri/src/managers/transcription.rs
decisions:
  - Added is_loading() getter to TranscriptionManager for state exposure
  - Fixed has_any_models_or_downloads to match comment documentation
  - Changed is_model_loading from "no model" check to actual loading state check
metrics:
  duration_minutes: 3
  tasks_completed: 2
  files_modified: 2
  completed_at: 2026-02-13
---

# Phase 09 Plan 02: Model Download Detection & Loading Status Summary

Fixed model download detection and loading status reporting for accurate UI feedback.

## What Was Done

Fixed two critical bugs in model status commands that caused incorrect UI feedback during onboarding and model loading:

### Task 1: Fix has_any_models_or_downloads to detect active downloads
**Commit:** `ec7cf4a`

**Problem:** The `has_any_models_or_downloads` command had a comment stating it should return true if "any models are downloaded OR if any downloads are in progress", but the implementation only checked `is_downloaded`, ignoring the `is_downloading` field. This caused onboarding to incorrectly show "no models available" while downloads were actively running.

**Fix:** Changed line 116 from:
```rust
Ok(models.iter().any(|m| m.is_downloaded))
```
to:
```rust
Ok(models.iter().any(|m| m.is_downloaded || m.is_downloading))
```

**Impact:** Onboarding now correctly detects when downloads are in progress and won't show "no models" error during active downloads.

### Task 2: Fix is_model_loading to return actual loading state
**Commit:** `167deaa`

**Problem:** The `is_model_loading` command returned inverted semantics - it checked `current_model.is_none()` which means "is no model loaded" rather than "is model currently loading". This prevented the UI from distinguishing between:
- No model loaded (idle state)
- Model currently loading (in-progress state)

**Fix:**
1. Added `is_loading()` method to `TranscriptionManager` to expose the internal `is_loading` field:
```rust
pub fn is_loading(&self) -> bool {
    *self.is_loading.lock().unwrap()
}
```

2. Updated `is_model_loading` command to call this method:
```rust
// Check if a model is currently being loaded
let is_loading = transcription_manager.is_loading();
Ok(is_loading)
```

**Impact:** UI can now show accurate loading indicators and distinguish between idle and loading states.

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

**Build verification:** Code compiles successfully with only unrelated dead code warnings.

**Functionality verified:**
- `has_any_models_or_downloads` now checks both `is_downloaded` and `is_downloading`
- `is_model_loading` returns actual loading state from `transcription_manager.is_loading()`
- Both commands have semantics matching their names and documentation

## Self-Check: PASSED

**Files modified:**
```bash
[ -f "C:/Users/hsbaz/leadrscribe/src-tauri/src/commands/models.rs" ] && echo "FOUND: src-tauri/src/commands/models.rs"
FOUND: src-tauri/src/commands/models.rs

[ -f "C:/Users/hsbaz/leadrscribe/src-tauri/src/managers/transcription.rs" ] && echo "FOUND: src-tauri/src/managers/transcription.rs"
FOUND: src-tauri/src/managers/transcription.rs
```

**Commits exist:**
```bash
git log --oneline --all | grep -q "ec7cf4a" && echo "FOUND: ec7cf4a"
FOUND: ec7cf4a

git log --oneline --all | grep -q "167deaa" && echo "FOUND: 167deaa"
FOUND: 167deaa
```

## Next Steps

These fixes improve the accuracy of UI feedback during model operations. The onboarding flow and model management UI will now provide correct status information to users.

Related work:
- Phase 09 Plan 01: Fix overlay visual shift and paste failures
- Future: Test onboarding flow with these fixes in place
