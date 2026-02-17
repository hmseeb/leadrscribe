# Roadmap: LeadrScribe

## Milestones

- ✅ **v1.0 UI Redesign** - Phases 1-8 (partial - phases 1 & 8 shipped 2026-02-06)
- 🚧 **v0.6.0 Audit Fixes** - Phases 9-10 (in progress)

## Phases

<details>
<summary>✅ v1.0 UI Redesign (Phases 1-8) - PARTIAL SHIP 2026-02-06</summary>

### Phase 1: Overlay Redesign
**Goal**: Transform overlay from basic indicator to polished minimal interface
**Requirements**: OVL-01, OVL-02, OVL-03
**Plans**: 5 plans

Plans:
- [x] 01-01: Frontend UI redesign (React + CSS dark pill styling)
- [x] 01-02: Backend FollowCursor positioning (Rust settings + overlay)
- [x] 01-03: Visual verification checkpoint
- [x] 01-04: Fix overlay flicker and improve drag behavior
- [x] 01-05: Visual and functional verification

### Phase 8: Real-Time Transcription Display
**Goal**: Show streaming transcription text in overlay during recording
**Requirements**: STREAM-01, STREAM-02
**Plans**: 2 plans

Plans:
- [x] 08-01: Backend streaming + Frontend overlay component
- [x] 08-02: Visual and functional verification

**Note:** Phases 2-7 (Command Palette, Tray Integration, History/Profiles, Settings Migration, Polish, Cleanup) deferred until after v0.6.0 audit fixes.

</details>

### 🚧 v0.6.0 Audit Fixes (In Progress)

**Milestone Goal:** Fix all 13 codebase audit findings (2 critical, 4 high, 5 medium, 2 low) before continuing UI redesign.

#### Phase 9: Critical Correctness Fixes
**Goal**: Fix timing bugs, broken tests, and missing UI features that affect core functionality
**Depends on**: Nothing (first phase of milestone)
**Requirements**: CORR-01, CORR-02, CORR-03, CORR-04, FEAT-01
**Success Criteria** (what must be TRUE):
  1. Model unloading waits the configured timeout (not unloading prematurely due to millis/secs mismatch)
  2. Ghostwriter unit tests pass and correctly validate error handling for missing/empty API keys
  3. Model manager accurately reports download status (onboarding doesn't say "no models" when downloads are in progress)
  4. FollowCursor overlay position is selectable in settings UI and works when chosen
  5. Model loading status command returns accurate state for UI feedback (not inverted semantics)
**Plans**: 3 plans in 1 wave

Plans:
- [x] 09-01-PLAN.md — Fix critical timing bug and broken tests (CORR-01, CORR-02)
- [x] 09-02-PLAN.md — Fix download detection and loading status (CORR-03, CORR-04)
- [x] 09-03-PLAN.md — Add FollowCursor to UI and types (FEAT-01)

#### Phase 10: Security & Code Health
**Goal**: Secure API key storage, harden app permissions, and remove technical debt
**Depends on**: Phase 9
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, HLTH-01, HLTH-02, HLTH-03
**Success Criteria** (what must be TRUE):
  1. OpenRouter API key stored in OS keychain (auto-migrated from settings file on first launch)
  2. Asset protocol can only access required directories (not entire filesystem via `**` glob)
  3. Content Security Policy blocks inline scripts and restricts external resources (not null/permissive)
  4. All dead streaming code removed (StreamingBuffer, StreamingSession, ghostwriter streaming types with `#[allow(dead_code)]`)
  5. No debug println statements remain in codebase (all replaced with proper log macros: debug!, info!, warn!, error!)
**Plans**: 3 plans in 1 wave

Plans:
- [x] 10-01-PLAN.md — Security hardening (SEC-01 through SEC-04)
- [x] 10-02-PLAN.md — Remove dead streaming code (HLTH-01, HLTH-02)
- [x] 10-03-PLAN.md — Replace println! with log macros (HLTH-03)

## Progress

**Execution Order:** 9 → 10

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Overlay Redesign | v1.0 UI Redesign | 5/5 | Complete | 2026-01-28 |
| 8. Real-Time Transcription Display | v1.0 UI Redesign | 2/2 | Complete | 2026-02-06 |
| 9. Critical Correctness Fixes | v0.6.0 Audit Fixes | 3/3 | Complete | 2026-02-13 |
| 10. Security & Code Health | v0.6.0 Audit Fixes | 3/3 | Complete | 2026-02-13 |

### Phase 11: Fix all audit findings
**Goal**: Fix all 13 remaining audit findings: security, correctness, performance, and code health
**Depends on**: Phase 10
**Success Criteria** (what must be TRUE):
  1. API key NOT stored in plaintext settings file when keyring succeeds
  2. Overlay theme initializes correctly from Tauri store (not always falling back to system)
  3. theme_mode field round-trips through Rust AppSettings without being dropped
  4. No deadlock risk from inconsistent lock ordering in AudioRecordingManager
  5. History row mapping defined once and reused (not copy-pasted 7 times)
  6. Settings commands live in commands/settings.rs (not shortcut.rs god-file)
  7. emit_levels uses cached overlay position (no per-callback settings reads)
  8. Frontend/backend defaults are consistent (history_limit, model ID fallback)
  9. Health-check thread has shutdown mechanism
  10. Clippy clean, no dead code, profile ID wired
**Plans**: 4 plans in 2 waves

Plans:
- [ ] 11-01-PLAN.md — Settings correctness and security (findings 1, 3, 9, 13)
- [ ] 11-02-PLAN.md — Overlay theme fix and audio performance (findings 2, 7, 8)
- [ ] 11-03-PLAN.md — Code health: DRY history, clippy, dead code, profile ID (findings 5, 11, 12)
- [ ] 11-04-PLAN.md — Deadlock prevention, thread shutdown, settings refactor (findings 4, 6, 10)

---
*Roadmap created: 2026-02-04*
*Updated for v0.6.0 milestone: 2026-02-13*
