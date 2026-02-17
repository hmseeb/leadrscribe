---
phase: 11-fix-all-audit-findings
plan: 02
subsystem: overlay, audio
tags: [performance, hot-path-optimization, settings-caching]
dependency_graph:
  requires: [tauri-store, settings-system]
  provides: [cached-overlay-position, optimized-audio-feedback]
  affects: [overlay-system, audio-callbacks, feedback-sounds]
tech_stack:
  added: [AtomicU8-cache]
  patterns: [hot-path-caching, single-read-pattern]
key_files:
  created: []
  modified:
    - src/overlay/main.tsx
    - src-tauri/src/overlay.rs
    - src-tauri/src/audio_feedback.rs
decisions:
  - Use Tauri store plugin directly in overlay instead of non-existent invoke command
  - Cache overlay position in AtomicU8 to avoid hot-path I/O
  - Pass settings values through function parameters instead of repeated disk reads
metrics:
  duration: 6 min
  completed: 2026-02-17
---

# Phase 11 Plan 02: Overlay Theme & Hot-Path Settings Optimization Summary

**One-liner:** Fixed overlay theme initialization using Tauri store plugin and eliminated hot-path settings reads with atomic caching.

## What Was Built

### Task 1: Overlay Theme Initialization Fix
Fixed completely broken overlay theme by replacing non-existent `invoke("get_settings")` command with direct Tauri store plugin access. The overlay was always falling back to system theme because the command didn't exist.

**Changes:**
- `src/overlay/main.tsx`: Updated `initializeTheme()` and system theme change listener to read from `settings_store.json` using `@tauri-apps/plugin-store`
- Removed all references to non-existent `get_settings` Tauri command
- Theme now correctly initializes from user settings

### Task 2: Hot-Path Settings Caching
Eliminated disk I/O on critical audio paths by caching overlay position in `AtomicU8` and refactoring audio feedback to read settings once per invocation.

**Changes:**
- `src-tauri/src/overlay.rs`:
  - Added `CACHED_OVERLAY_POSITION` static atomic (0=None, 1=Top, 2=Bottom)
  - Added `update_cached_overlay_position()` and `get_cached_overlay_position()` functions
  - Updated cache in `create_recording_overlay()`, `show_recording_overlay()`, and `update_overlay_position()`
  - Replaced settings read in `emit_levels()` with cached position lookup
  - **Impact:** Eliminates JSON deserialization on every audio level callback (called many times per second during recording)

- `src-tauri/src/audio_feedback.rs`:
  - Refactored `play_sound()` to accept `volume` and `selected_output_device` as parameters instead of reading settings
  - Refactored `get_sound_path()` to accept settings reference instead of app handle
  - Updated `play_feedback_sound()` and `play_test_sound()` to read settings once and pass values through
  - **Impact:** Reduced settings reads from 4 to 1 per feedback sound event

## Deviations from Plan

None - plan executed exactly as written.

## Performance Impact

**Before:**
- Overlay theme: Always failed, fell back to system theme
- `emit_levels()`: Deserialized full settings JSON from disk on every call (many times per second)
- `play_feedback_sound()`: Read settings JSON 4 times per sound event

**After:**
- Overlay theme: Correctly reads from settings store
- `emit_levels()`: Single atomic read (no disk I/O, no deserialization)
- `play_feedback_sound()`: Reads settings JSON once per event

**Estimated savings:**
- Audio callbacks during 10-second recording: ~200 disk reads eliminated
- Feedback sound playback: 75% reduction in settings reads

## Verification Results

All verification criteria passed:
- ✅ `cargo check` passes
- ✅ `bun run build` passes (TypeScript compiles)
- ✅ No `invoke("get_settings")` calls in overlay/main.tsx
- ✅ No `settings::get_settings` call in `emit_levels` function body
- ✅ `audio_feedback.rs` has exactly 2 `get_settings` calls (one per public function)

## Technical Details

### Atomic Caching Pattern
The `AtomicU8` cache uses `Ordering::Relaxed` because:
- Overlay position changes are infrequent (user settings update)
- Exact synchronization not critical (worst case: one extra frame with old position)
- Performance-critical path benefits from relaxed ordering

### Tauri Store Plugin Usage
The overlay window uses the same store access pattern as the main window:
```typescript
const { load } = await import("@tauri-apps/plugin-store");
const store = await load("settings_store.json", { autoSave: false });
const settings = await store.get("settings");
```

This is consistent with the existing settings architecture and doesn't require adding new Tauri commands.

## Files Modified

| File | Lines Changed | Purpose |
|------|---------------|---------|
| src/overlay/main.tsx | +6 -2 | Fix theme initialization with store plugin |
| src-tauri/src/overlay.rs | +34 -3 | Add atomic cache and update functions |
| src-tauri/src/audio_feedback.rs | +13 -14 | Refactor to single settings read |

## Commits

- `5e4f996`: fix(11-02): fix overlay theme initialization using Tauri store
- `510c8fb`: fix(11-02): cache overlay position and reduce audio feedback settings reads
- `bbfa23a`: fix(11-03): clippy lint, dead code, and wire profile ID *(includes overlay.rs changes)*

**Note:** Overlay.rs changes ended up in commit bbfa23a due to staging timing, but all 11-02 functionality is complete and verified.

## Self-Check: PASSED

✅ All modified files exist and contain expected changes
✅ All commits exist in git history
✅ TypeScript compiles without errors
✅ Rust compiles without errors
✅ Verification criteria met
