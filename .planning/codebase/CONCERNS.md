# Codebase Concerns

**Analysis Date:** 2026-02-04

## Tech Debt

**Hardcoded Model Configuration:**
- Issue: Model metadata (names, descriptions, URLs, sizes) is hardcoded in `ModelInfo` initialization rather than loaded from a configuration file
- Files: `src-tauri/src/managers/model.rs:67`
- Impact: Adding or updating models requires code changes and recompilation; cannot manage models via configuration
- Fix approach: Migrate to JSON-based model registry (e.g., `models.json`) loaded at initialization, allowing runtime updates without redeployment

**Debug Println Statements in Production Code:**
- Issue: Multiple `println!("DEBUG: ...")` statements remain in release build paths
- Files:
  - `src-tauri/src/commands/models.rs:82, 91`
  - `src-tauri/src/settings.rs:352, 356, 361, 367, 378`
  - `src/components/model-selector/ModelSelector.tsx:253, 261-263`
- Impact: Performance degradation (stdout writes block), information leakage, console noise
- Fix approach: Replace `println!` with proper `log` crate usage and remove before release; use `#[cfg(debug_assertions)]` for debug-only logging

**Unused Streaming State Code:**
- Issue: `StreamingState` and segment listener infrastructure is marked `#[allow(dead_code)]` but still initialized and maintained
- Files: `src-tauri/src/actions.rs:25-150`
- Impact: Code maintenance burden, potential memory leaks from unused Arc/Mutex allocations, increased binary size
- Fix approach: Either fully remove streaming code or properly re-enable and test it; document decision

## Known Bugs

**Overlay Window Race Condition After Sleep:**
- Symptoms: Recording overlay becomes unresponsive after Windows sleep/idle; shows visually but doesn't receive input or updates
- Files: `src-tauri/src/overlay.rs`, `src-tauri/src/shortcut.rs:21-30`
- Trigger: Windows sleep with app running, then resume
- Current mitigation: Health check loop every 10 seconds that verifies overlay and shortcuts; recreates if broken (imperfect solution)
- Workaround: User must restart the app to recover fully
- Root cause: Windows invalidates window handles on sleep; health check detects but recovery is slow (10-second delay)

**Push-to-Talk Setting Doesn't Cancel Ongoing Recording:**
- Issue: Disabling push-to-talk while recording doesn't stop the current recording
- Files: `src-tauri/src/shortcut.rs:144-145`
- Impact: User expects toggle to immediately stop recording but it continues
- Fix approach: Implement recording cancellation in `change_ptt_setting()`; emit event to trigger immediate stop action

**Model Selection Type Mismatch Debug Issue:**
- Symptoms: Type comparison failures between `current` and `transcriptionStatus` in model selector
- Files: `src/components/model-selector/ModelSelector.tsx:253-263`
- Trigger: Model state changes or rapid status updates
- Impact: Model status may display incorrectly; debug logs suggest type coercion issues
- Fix approach: Ensure consistent string types from backend; add TypeScript strict null checks in model comparisons

## Error Handling Issues

**Heavy Use of unwrap() in Critical Paths:**
- Issue: 169 occurrences of `unwrap()`, `expect()`, and similar panic-inducing operations across codebase
- Files: Multiple critical areas including:
  - `src-tauri/src/lib.rs:70, 73, 76, 79, 81, 83, 116, 118, 142, 267, 268` (initialization and window management)
  - `src-tauri/src/managers/audio.rs:114, 123, 150, 191, 202, 204, 206, 218, 223` (audio recording state)
  - `src-tauri/src/actions.rs:48, 49, 50, 55, 71, 83, 105, 116` (shortcut action processing)
  - `src-tauri/src/settings.rs:326, 336, 372, 391` (settings persistence)
- Impact: Any lock contention, serialization failure, or invalid state causes app crash rather than graceful error handling
- Critical: Initialization failures (`expect()` on manager creation) crash entire app before startup completes
- Fix approach: Replace `expect()` with proper error propagation and user-facing error messages; use `Result<T, E>` returns; add connection pool recovery

**Clipboard Content Not Validated:**
- Issue: `paste_via_clipboard()` reads and restores clipboard without size validation
- Files: `src-tauri/src/clipboard.rs:59, 75-76`
- Impact: Very large clipboard contents could cause performance issues or memory spikes
- Fix approach: Add size limit check before reading/restoring; warn user or skip restoration if content exceeds threshold

**HTTP Client Panic on Creation:**
- Issue: Global HTTP client uses `expect()` which panics if build fails
- Files: `src-tauri/src/ghostwriter.rs:10-16`
- Impact: Any TLS/network initialization failure crashes entire app
- Fix approach: Lazy-initialize with proper error handling; return error to user if client creation fails

## Security Considerations

**OpenRouter API Key in Settings:**
- Risk: API keys stored in plaintext in Tauri store (typically SQLite database)
- Files: `src-tauri/src/managers/model.rs` (settings usage)
- Current mitigation: Relies on OS file permissions; no encryption at rest
- Recommendations:
  - Use system keychain (Keyring, Credential Manager) for sensitive credentials
  - Add encryption for settings database
  - Document security implications in UI

**Clipboard Text Injection Risk:**
- Risk: Direct text input via clipboard/paste could contain malicious formatting or exploit vulnerable applications
- Files: `src-tauri/src/clipboard.rs:81-102`
- Current mitigation: Text is passed as-is; no content filtering
- Recommendations:
  - Consider escaping special characters for targeted applications
  - Document that pasted content is unfiltered
  - Add optional "plain text only" mode

**Global Shortcuts Not Validated:**
- Risk: Users can set conflicting or dangerous keyboard shortcuts
- Files: `src-tauri/src/shortcut.rs:99, 135-137`
- Current mitigation: Basic parsing validation with error messages
- Recommendations:
  - Maintain blocklist of dangerous shortcuts (Ctrl+Alt+Del, etc.)
  - Warn users about system-reserved shortcuts
  - Add preview of current conflicts before confirming

**VAD Model File Not Verified:**
- Risk: VAD model downloaded from external source without integrity checks
- Files: `src-tauri/src/managers/audio.rs:142-149` (references bundled model)
- CLAUDE.md indicates model must be downloaded separately
- Current mitigation: Model path is hardcoded; assumes downloaded correctly
- Recommendations:
  - Add SHA256 verification for downloaded models
  - Document trusted download sources
  - Cache verification results

## Performance Bottlenecks

**Health Check Thread Spin Loop:**
- Problem: Shortcut health check spawns dedicated thread that sleeps 10 seconds in infinite loop
- Files: `src-tauri/src/shortcut.rs:24-29`
- Impact: Unnecessary thread overhead; 10-second delay to recover from sleep (user-visible lag)
- Cause: No event-driven recovery; relies on periodic polling
- Improvement path: Use Windows WM_POWERBROADCAST or equivalent to detect sleep/resume and trigger immediate re-registration

**Overlay Window Verification Delay:**
- Problem: `show_recording_overlay()` sleeps 10ms between show and visibility check; hides use 300ms sleep for animation
- Files: `src-tauri/src/overlay.rs:135, 223`
- Impact: Minimum 310ms latency for overlay visibility after recording starts
- Improvement path: Use window event callbacks instead of timed sleeps; emit animation complete event from frontend

**Mutex Lock Contention in Audio Recording:**
- Problem: Audio state uses multiple `Arc<Mutex<_>>` fields accessed in tight loops
- Files: `src-tauri/src/managers/audio.rs:71-79` (7 separate mutexes)
- Impact: Lock acquisition overhead on every audio callback; potential thread blocking
- Improvement path: Consider combining related fields into single struct locked together; use RwLock for read-heavy operations

**Model Initialization Chains:**
- Problem: Manager initialization follows sequential chain with 6 `.expect()` blocks; any failure blocks entire startup
- Files: `src-tauri/src/lib.rs:61-91`
- Impact: Startup blocked by slowest manager; no parallelization of independent managers
- Improvement path: Use tokio::spawn_blocking for parallel manager initialization; implement graceful degradation

## Fragile Areas

**Audio Recorder VAD Initialization:**
- Files: `src-tauri/src/managers/audio.rs:34-65`
- Why fragile:
  - Silero VAD requires AVX2 CPU support detected at runtime but checked inline
  - CPU check only happens during microphone start, not app init (late discovery)
  - Fails silently with cryptic ONNX Runtime error if AVX2 missing
- Safe modification: Add comprehensive CPU capability check at app startup; pre-cache in settings; add detailed error messages
- Test coverage: CPU feature test exists (`cpu_features.rs`) but not integrated into onboarding

**Clipboard Restoration Logic:**
- Files: `src-tauri/src/clipboard.rs:54-79`
- Why fragile:
  - Assumes system clipboard accessible during paste operation
  - 150ms sleep is empirically determined; may fail on slow systems
  - No retry mechanism if restoration fails
  - Race condition if user manually changes clipboard during paste
- Safe modification: Add timeout instead of fixed sleep; implement retry with exponential backoff; log restoration failures
- Test coverage: No tests for clipboard edge cases

**Shortcut Binding Storage:**
- Files: `src-tauri/src/shortcut.rs:15-18, 79-90`
- Why fragile:
  - Settings loaded fresh every call to `change_binding()`; concurrent changes could cause data loss
  - No transaction semantics; unregister can fail but registration continues
  - Binding lookup returns None without checking if ID truly doesn't exist vs. corrupted settings
- Safe modification: Implement settings versioning; add transaction-like rollback on partial failure; validate all bindings on load
- Test coverage: No integration tests for shortcut changes

**Ghostwriter API Integration:**
- Files: `src-tauri/src/ghostwriter.rs:92-200`
- Why fragile:
  - Hardcoded 30-second timeout insufficient for slow networks or large texts
  - No retry logic for transient failures
  - Error response body read with `unwrap_or_default()` loses important error info
  - API key validation happens in function, not at settings change
- Safe modification: Make timeout configurable; add exponential backoff retries; properly deserialize error responses; validate API key early
- Test coverage: Mock tests exist but don't cover network failures

## Scaling Limits

**History Database Growth:**
- Current capacity: SQLite with no documented limits or pagination
- Files: `src-tauri/src/managers/history.rs:48-200+`
- Limit: SQLite performs poorly with >1M rows; unbounded history growth will eventually cause UI lag
- Scaling path: Implement pagination in history UI; add history archiving/cleanup; consider moving to better DB for large deployments

**Model File Storage:**
- Current capacity: Models stored in `app_data_dir/models/`; no size management
- Files: `src-tauri/src/managers/model.rs:53-63`
- Limit: Downloading large models (1.6GB Turbo) to limited storage devices; no quota checking
- Scaling path: Add pre-download disk space validation; implement selective model downloading; add cleanup for unused models

**Memory Usage During Transcription:**
- Current: Full audio loaded into memory before Whisper inference
- Files: `src-tauri/src/managers/transcription.rs`
- Limit: No streaming support; 60+ minute recordings could exhaust RAM
- Scaling path: Implement chunked transcription with overlap handling; use streaming Whisper if available

## Dependencies at Risk

**Custom Git Dependencies:**
- Risk: Using custom forks instead of stable versions increases maintenance burden
- Packages:
  - `rdev` - GitHub fork (rustdesk-org) instead of crates.io
  - `rodio` - Custom fork (cjpais)
  - `vad-rs` - Custom fork (cjpais)
- Impact: No automatic updates; must monitor forks for critical security patches
- Migration plan:
  - Monitor upstream projects for feature parity
  - Document why custom forks are needed
  - Plan migration path back to upstream when possible

**Pinned Tauri Version:**
- Risk: Using Tauri 2.9.1; each point release may have security fixes
- Files: `src-tauri/Cargo.toml:31`
- Impact: Missing critical security patches if not explicitly updated
- Migration plan: Establish version update cadence (monthly?); test each release; use dependabot for automated detection

**ONNX Runtime Implicit Dependency:**
- Risk: VAD uses ONNX Runtime (via vad-rs) but not explicitly in Cargo.toml; version determined by vad-rs
- Files: `src-tauri/src/managers/audio.rs:132-139`
- Impact: ONNX upgrades could break VAD; no version control over this critical dependency
- Migration plan: Document ONNX version requirement; consider explicit feature-gating

## Missing Critical Features

**No Error Recovery UI:**
- Problem: When initialization fails (e.g., model download fails), app shows crash dialog with no path to recovery
- Impact: User cannot retry or change settings; must manually delete app data and restart
- Blocks: Basic usability on first run with network issues
- Fix: Implement initialization error screen with retry button and settings access

**No Conflict Detection for Shortcuts:**
- Problem: Users can accidentally set the same shortcut for multiple actions; unclear which action triggers
- Impact: User confusion; unpredictable behavior
- Blocks: Advanced users managing complex shortcut layouts
- Fix: Add shortcut uniqueness validation and conflict warnings during binding change

**No Model Download Resume:**
- Problem: If model download interrupted, must restart from scratch
- Impact: Frustrating on slow/unstable connections; wasted bandwidth
- Blocks: Users on metered connections
- Fix: Implement partial download tracking and resume capability

## Test Coverage Gaps

**Audio Recording State Machine:**
- What's not tested: Transitions between Idle, Recording, and error states under concurrent access
- Files: `src-tauri/src/managers/audio.rs:20-30` (enum definition)
- Risk: Race conditions in state changes could cause undefined behavior (e.g., double-start)
- Priority: High

**Clipboard Restoration Under Failure:**
- What's not tested: Behavior when clipboard restoration fails after successful paste
- Files: `src-tauri/src/clipboard.rs:54-79`
- Risk: User loses original clipboard content; silent failure
- Priority: High

**Settings Persistence Concurrent Updates:**
- What's not tested: What happens when settings are written while being read by multiple managers
- Files: `src-tauri/src/settings.rs:320-380`
- Risk: Data loss; inconsistent state across components
- Priority: Medium

**Shortcut Re-registration Health Check:**
- What's not tested: Actual recovery from Windows sleep/idle scenarios
- Files: `src-tauri/src/shortcut.rs:32-61`
- Risk: Health check may not actually fix the broken state; false sense of security
- Priority: Medium

**Model Unload Timeout Edge Cases:**
- What's not tested: Behavior with Immediately timeout (0 seconds) during rapid successive transcriptions
- Files: `src-tauri/src/managers/transcription.rs:86-88`
- Risk: Model thrashing (load/unload every call) could degrade performance significantly
- Priority: Medium

**Frontend Type Safety (TypeScript):**
- What's not tested: Type mismatches between Rust command returns and TypeScript expectations
- Files: `src/components/model-selector/ModelSelector.tsx` (multiple invokes)
- Risk: Runtime type errors; incorrect error handling
- Priority: Low (should use stricter tsconfig)

---

*Concerns audit: 2026-02-04*
