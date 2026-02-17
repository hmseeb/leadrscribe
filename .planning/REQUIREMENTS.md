# Requirements: LeadrScribe v0.6.0 Audit Fixes

**Defined:** 2026-02-13
**Core Value:** The transcription experience must be invisible and instant.

## v0.6.0 Requirements

### Correctness

- [ ] **CORR-01**: `last_activity` uses consistent time units (millis) across init, load_model, transcribe, and idle watcher
- [ ] **CORR-02**: Ghostwriter tests assert `Err` for missing/empty API key (matching current `process_text` behavior)
- [ ] **CORR-03**: `has_any_models_or_downloads` returns true when downloads are in progress
- [ ] **CORR-04**: `is_model_loading` reflects actual loading state (not "is no model loaded")

### Feature Completeness

- [ ] **FEAT-01**: `FollowCursor` overlay position available in TypeScript types, settings UI, and command handler

### Security

- [ ] **SEC-01**: OpenRouter API key stored in OS keychain instead of plaintext settings file
- [ ] **SEC-02**: Content Security Policy set to restrictive defaults (not null)
- [ ] **SEC-03**: Asset protocol scope narrowed from `**` to required directories only
- [ ] **SEC-04**: SQL queries in history migration use parameterized queries (or documented safety)

### Code Health

- [ ] **HLTH-01**: Dead `StreamingBuffer` and `StreamingSession` code removed
- [ ] **HLTH-02**: Dead ghostwriter streaming types and `process_text_streaming` removed
- [ ] **HLTH-03**: All diagnostic `println!` replaced with `log` crate macros (`debug!`/`info!`)

## Future Requirements

Deferred from v1.0 UI Redesign (phases 2-7):
- **CMD-001**: Command palette with Ctrl+K activation
- **CMD-002**: Fuzzy search across all settings
- **TRAY-001**: Tray-only presence, eliminate main window
- **HIST-001**: History accessible from command palette
- **PROF-001**: Profile switching from command palette

## Out of Scope

| Feature | Reason |
|---------|--------|
| Rewrite streaming architecture | Current cumulative re-transcription works; just remove dead old code |
| Encrypt all settings | Only API key needs secure storage; other settings are non-sensitive |
| Full security audit remediation | CSP + asset scope + SQL are the actionable items; deeper audit later |
| New features | This is strictly a bugfix/quality milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CORR-01 | Phase 9 | Complete |
| CORR-02 | Phase 9 | Complete |
| CORR-03 | Phase 9 | Complete |
| CORR-04 | Phase 9 | Complete |
| FEAT-01 | Phase 9 | Complete |
| SEC-01 | Phase 10 | Complete |
| SEC-02 | Phase 10 | Complete |
| SEC-03 | Phase 10 | Complete |
| SEC-04 | Phase 10 | Complete |
| HLTH-01 | Phase 10 | Complete |
| HLTH-02 | Phase 10 | Complete |
| HLTH-03 | Phase 10 | Complete |

**Coverage:**
- v0.6.0 requirements: 13 total
- Mapped to phases: 13/13 (100%)
- Phase 9 (Critical Correctness Fixes): 5 requirements
- Phase 10 (Security & Code Health): 8 requirements

---
*Requirements defined: 2026-02-13*
*Traceability updated: 2026-02-13 after Phase 10 completion — all requirements complete*
