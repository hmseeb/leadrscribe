---
phase: 09-critical-correctness-fixes
plan: 01
subsystem: transcription-timing-and-tests
tags:
  - bug-fix
  - unit-tests
  - timing-correctness
  - model-lifecycle
dependency_graph:
  requires:
    - TranscriptionManager idle watcher
    - ghostwriter process_text function
  provides:
    - Correct model unload timing behavior
    - Passing unit tests with correct error assertions
  affects:
    - Model unload timeout feature
    - Ghostwriter test suite
tech_stack:
  added: []
  patterns:
    - Consistent time unit usage (milliseconds)
    - Test assertions matching actual behavior
key_files:
  created: []
  modified:
    - src-tauri/src/managers/transcription.rs
    - src-tauri/src/ghostwriter.rs
decisions:
  - summary: Use milliseconds consistently for last_activity timestamps
    rationale: Idle watcher compares milliseconds, storing seconds caused 1000x timing error
    alternatives_considered:
      - Convert to seconds in idle watcher (rejected - less precise)
      - Use Duration type (rejected - AtomicU64 required for thread-safe access)
metrics:
  duration: 3 minutes
  completed_date: 2026-02-13
  tasks_completed: 2
  files_modified: 2
  tests_added: 0
  tests_fixed: 2
---

# Phase 9 Plan 01: Fix Critical Timing Bug and Test Assertions

**One-liner:** Fixed premature model unloading bug (1000x timing error) and corrected ghostwriter test assertions to match actual error behavior

## Summary

Resolved critical timing bug where `TranscriptionManager.last_activity` used inconsistent time units (seconds vs milliseconds), causing models to unload ~1000x earlier than configured. Fixed broken unit tests in ghostwriter that asserted `is_ok()` when the function actually returns `Err` for missing API keys.

## What Was Built

### 1. TranscriptionManager Timing Fix
**File:** `src-tauri/src/managers/transcription.rs`

**Problem:**
- `last_activity` atomic stored timestamps in **seconds** at line 297 (`load_model`)
- Idle watcher compared timestamps expecting **milliseconds** at line 100
- Result: 120-second timeout → unloaded after ~120 milliseconds (1000x faster)

**Solution:**
```rust
// Line 297 - BEFORE (BUG)
.as_secs()

// Line 297 - AFTER (FIXED)
.as_millis() as u64
```

**Impact:** Model unload timeout now respects configured values (2min, 5min, 10min, 30min).

### 2. Ghostwriter Test Assertions Fix
**File:** `src-tauri/src/ghostwriter.rs`

**Problem:**
- Tests expected `process_text()` to return `Ok(original_text)` for missing/empty API keys
- Actual behavior (lines 101-106): Returns `Err("No API key configured...")`
- Tests falsely passed by luck, would break if implementation changed

**Solution:**
```rust
// Lines 506-507 & 520-521 - BEFORE (INCORRECT)
assert!(result.is_ok());
assert_eq!(result.unwrap(), "test text");

// Lines 506-507 & 520-521 - AFTER (CORRECT)
assert!(result.is_err());
assert_eq!(result.unwrap_err().to_string(), "No API key configured. Please add your OpenRouter API key in settings.");
```

**Impact:** Tests now document correct API contract - missing API keys MUST error (security best practice).

## Tasks Completed

| Task | Name                                          | Commit  | Key Changes                          |
| ---- | --------------------------------------------- | ------- | ------------------------------------ |
| 1    | Fix last_activity unit mismatch              | ffec425 | Line 297: as_secs() → as_millis()    |
| 2    | Fix ghostwriter test assertions for errors    | 05fedcf | 2 tests: is_ok() → is_err()          |

## Verification Results

### Build Verification
```bash
cd src-tauri && cargo build
```
**Result:** ✅ Compiled successfully with 0 errors

### Test Suite Results
```bash
cd src-tauri && cargo test
```
**Result:** ✅ All 14 tests passed, 0 failed

**Specific tests fixed:**
- `ghostwriter::tests::test_no_api_key_returns_original` - ✅ PASS
- `ghostwriter::tests::test_empty_api_key_returns_original` - ✅ PASS

### Timestamp Consistency Verification
```bash
grep -n "last_activity" src-tauri/src/managers/transcription.rs | grep -E "(as_millis|as_secs)"
```
**Result:** ✅ No `as_secs()` calls found for `last_activity` field - all use `as_millis() as u64`

## Deviations from Plan

None - plan executed exactly as written.

## Technical Details

### Timing Bug Root Cause
The bug existed since initial implementation. Three locations touch `last_activity`:
1. **Line 62 (init):** `as_millis() as u64` ✅
2. **Line 297 (load_model):** `as_secs()` ❌ (FIXED)
3. **Line 352 (transcribe):** `as_millis() as u64` ✅

Idle watcher at line 100 compares:
```rust
if now_ms.saturating_sub(last) > limit_seconds * 1000
```

When `last` is in seconds but compared as milliseconds:
- 120 seconds stored as `120`
- Compared as milliseconds: treats `120` as 120ms
- Timeout triggers after ~120ms instead of 120,000ms (2 minutes)

### Test Assertion Bug Root Cause
Tests were written before error handling was added to `process_text()`. When API key validation was added (lines 101-106), tests were not updated. Tests documented wrong behavior as "expected" behavior.

## Success Criteria Met

- ✅ All changes to `last_activity` use `as_millis() as u64` consistently
- ✅ No `as_secs()` calls remain for `last_activity` field
- ✅ Both ghostwriter tests assert `is_err()` and verify error message
- ✅ `cargo test` passes with 0 failures (14 passed)
- ✅ Code compiles without warnings in modified files

## Follow-up Items

None. Both issues fully resolved.

## Self-Check: PASSED

### Created Files Verification
No files created in this plan.

### Modified Files Verification
```bash
[ -f "C:/Users/hsbaz/leadrscribe/src-tauri/src/managers/transcription.rs" ] && echo "FOUND"
[ -f "C:/Users/hsbaz/leadrscribe/src-tauri/src/ghostwriter.rs" ] && echo "FOUND"
```
**Result:**
- ✅ FOUND: src-tauri/src/managers/transcription.rs
- ✅ FOUND: src-tauri/src/ghostwriter.rs

### Commits Verification
```bash
git log --oneline --all | grep -E "(ffec425|05fedcf)"
```
**Result:**
- ✅ FOUND: ffec425 (fix last_activity unit mismatch)
- ✅ FOUND: 05fedcf (fix ghostwriter test assertions)

All artifacts verified successfully.
