---
phase: 11-fix-all-audit-findings
plan: 01
subsystem: settings
tags: [security, correctness, data-integrity]
dependencies:
  requires: []
  provides: [secure-api-key-storage, theme-mode-persistence, consistent-defaults, valid-model-fallback]
  affects: [settings-persistence, keyring-integration, model-loading, frontend-defaults]
tech-stack:
  added: []
  patterns: [secure-credential-storage, serde-round-trip-safety, registry-based-fallback]
key-files:
  created: []
  modified:
    - src-tauri/src/shortcut.rs
    - src-tauri/src/settings.rs
    - src/stores/settingsStore.ts
    - src-tauri/src/lib.rs
decisions:
  - "API key security: Clear plaintext from settings when keyring works, rely on read-time fallback for reliability"
  - "theme_mode persistence: Add field to Rust AppSettings to prevent serde dropping frontend values"
  - "Default alignment: Frontend history_limit must match backend default of 10000"
  - "Model registry consistency: CPU fallback must use 'small' not 'whisper-small' to match registry IDs"
metrics:
  duration: 3 minutes
  tasks: 2
  files: 4
  commits: 2
  completed: 2026-02-17
---

# Phase 11 Plan 01: Settings Model Correctness & Security Summary

Fixed four critical settings-related audit findings: API key plaintext storage, theme_mode round-trip failure, frontend default mismatch, and invalid model ID fallback.

## What Was Done

### Task 1: API Key Security & Theme Mode Round-Trip (c6363e2)

**API Key Storage (Finding 1):**
- Changed `change_openrouter_api_key_setting` to clear plaintext API key from settings file when keyring succeeds
- Previously kept fallback in settings file "in case keyring becomes unreliable later"
- Security flaw: API key stored in plaintext JSON even when keyring working
- Solution: Set `s.openrouter_api_key = None` when `keyring_works == true`
- Safe because `get_openrouter_api_key_setting` already implements auto-migration from settings to keyring on read

**Theme Mode Persistence (Finding 3):**
- Added `theme_mode: String` field to `AppSettings` struct in `settings.rs`
- Added `default_theme_mode()` function returning `"system"`
- Added field to `get_default_settings()` return value
- Problem: Frontend sets `theme_mode`, backend reads/writes settings, field gets dropped by serde
- Solution: Include field in Rust struct so serde preserves it during round-trip

**Files modified:**
- `src-tauri/src/shortcut.rs` - API key storage logic
- `src-tauri/src/settings.rs` - AppSettings struct definition

### Task 2: Frontend Default & Model ID Fallback (f19aafe)

**Frontend Default Mismatch (Finding 9):**
- Changed `history_limit` in `settingsStore.ts` from `5` to `10000`
- Backend default in `settings.rs` is `10000` (effectively unlimited)
- Frontend default of `5` caused confusion when users hit limit quickly
- Now both frontend and backend default to same value

**Model ID Fallback (Finding 13):**
- Changed Parakeet CPU fallback from `"whisper-small"` to `"small"` in `lib.rs` line 230
- Changed notification JSON `fallback_model` from `"whisper-small"` to `"small"` in line 243
- Model registry uses ID `"small"` not `"whisper-small"` (see `managers/model.rs:72`)
- Previous fallback would fail to load because model ID didn't exist in registry
- Now fallback uses actual registry ID so model can be found and loaded

**Files modified:**
- `src/stores/settingsStore.ts` - Frontend default values
- `src-tauri/src/lib.rs` - Parakeet CPU fallback logic

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

1. **Cargo check:** Passed - Rust code compiles without errors
2. **Bun run build:** Passed - Frontend TypeScript compiles and builds successfully
3. **No whisper-small references:** Confirmed - grep found no matches in lib.rs fallback code
4. **theme_mode field present:** Confirmed - field exists in AppSettings with serde default
5. **API key security:** Confirmed - `s.openrouter_api_key = None` inside `if keyring_works` branch

## Impact

**Security:**
- API keys no longer stored in plaintext when keyring works
- Reduces exposure window for credential leakage
- Maintains fallback behavior for keyring unreliability

**Data Integrity:**
- theme_mode settings persist correctly through backend round-trips
- Frontend settings no longer mysteriously reset after backend writes

**User Experience:**
- Consistent history limit prevents confusion about why history is truncated
- Parakeet CPU fallback actually works instead of silently failing

## Self-Check

Verifying all claimed modifications exist on disk and in git history.

**Files exist:**
```
FOUND: src-tauri/src/shortcut.rs
FOUND: src-tauri/src/settings.rs
FOUND: src/stores/settingsStore.ts
FOUND: src-tauri/src/lib.rs
```

**Commits exist:**
```
FOUND: c6363e2 (fix(11-01): restore API key security and theme_mode round-trip)
FOUND: f19aafe (fix(11-01): fix frontend default and model ID fallback)
```

**Key changes verified:**
- `theme_mode` field in AppSettings struct: CONFIRMED
- `s.openrouter_api_key = None` in keyring_works branch: CONFIRMED
- `history_limit: 10000` in settingsStore.ts: CONFIRMED
- No "whisper-small" in lib.rs fallback: CONFIRMED
- `selected_model = "small"` in CPU fallback: CONFIRMED

## Self-Check: PASSED

All files modified, all commits recorded, all changes verified on disk.
