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
**Plans**: TBD

Plans:
- [ ] 09-01: TBD

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
**Plans**: TBD

Plans:
- [ ] 10-01: TBD

## Progress

**Execution Order:** 9 → 10

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Overlay Redesign | v1.0 UI Redesign | 5/5 | Complete | 2026-01-28 |
| 8. Real-Time Transcription Display | v1.0 UI Redesign | 2/2 | Complete | 2026-02-06 |
| 9. Critical Correctness Fixes | v0.6.0 Audit Fixes | 0/? | Not started | - |
| 10. Security & Code Health | v0.6.0 Audit Fixes | 0/? | Not started | - |

---
*Roadmap created: 2026-02-04*
*Updated for v0.6.0 milestone: 2026-02-13*
