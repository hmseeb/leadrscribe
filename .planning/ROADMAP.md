# Roadmap: LeadrScribe UI Redesign

**Milestone:** v1.0 - Complete UI Redesign
**Created:** 2026-02-04
**Status:** Planning

## Milestone Overview

Transform LeadrScribe from settings-heavy desktop app to WisprFlow-style minimal interface with floating overlay, command palette, and tray-only presence.

## Phases

### Phase 1: Foundation - Overlay Redesign ✓ COMPLETE
**Goal:** Replace current overlay with minimal floating pill design
**Plans:** 3 plans

**Deliverables:**
- [x] New floating pill component with WisprFlow-style design
- [x] Recording state visualization (pulsing mic, audio bars)
- [x] Configurable position (top/bottom/follow cursor)
- [x] Dark minimal theme applied
- [x] ESC cancellation working
- [x] Smooth show/hide animations

**Entry Criteria:** None (first phase)
**Exit Criteria:** Overlay looks and feels like WisprFlow, replaces old overlay ✓

Plans:
- [x] 01-01-PLAN.md - Frontend UI redesign (React + CSS dark pill styling)
- [x] 01-02-PLAN.md - Backend FollowCursor positioning (Rust settings + overlay)
- [x] 01-03-PLAN.md - Visual verification checkpoint

---

### Phase 2: Command Palette Core
**Goal:** Build command palette as primary settings interface

**Deliverables:**
- [ ] Command palette component (cmdk integration)
- [ ] Global Ctrl+K activation
- [ ] Fuzzy search implementation
- [ ] Keyboard navigation (arrows, enter, esc)
- [ ] Command index with all settings
- [ ] Slide-in animation

**Entry Criteria:** Phase 1 complete (overlay working)
**Exit Criteria:** All settings accessible via command palette

---

### Phase 3: Tray Integration
**Goal:** Move app to tray-only presence, eliminate main window

**Deliverables:**
- [ ] Redesigned tray menu (3-5 items max)
- [ ] Remove main window entirely
- [ ] Tray icon shows recording status
- [ ] Single-instance brings command palette (not window)
- [ ] Quit and basic actions in tray

**Entry Criteria:** Phase 2 complete (command palette working)
**Exit Criteria:** App has no main window, tray + overlay + palette only

---

### Phase 4: History & Profiles in Palette
**Goal:** Integrate history and profile management into command palette

**Deliverables:**
- [ ] History search command
- [ ] History list view in palette
- [ ] Copy transcription action
- [ ] Profile switching command
- [ ] Profile quick-switch (cycling)
- [ ] Create/edit profile flow

**Entry Criteria:** Phase 3 complete (no main window)
**Exit Criteria:** History and profiles fully accessible via command palette

---

### Phase 5: Settings Migration
**Goal:** All settings editable through command palette

**Deliverables:**
- [ ] Shortcut customization commands
- [ ] Microphone selection command
- [ ] Model selection command
- [ ] Language selection command
- [ ] Overlay position command
- [ ] All toggles (autostart, audio feedback, theme)
- [ ] Inline editing for simple values

**Entry Criteria:** Phase 4 complete
**Exit Criteria:** Every setting that existed before is accessible

---

### Phase 6: Polish & Power Features
**Goal:** Learning/ranking, full keyboard customization, animations

**Deliverables:**
- [ ] Command frequency tracking
- [ ] Auto-rank frequent commands
- [ ] Full keyboard mapper
- [ ] Micro-interaction animations
- [ ] Performance optimization (<200ms activation)
- [ ] Error handling as toasts (not modals)

**Entry Criteria:** Phase 5 complete
**Exit Criteria:** App feels polished, fast, professional

---

### Phase 7: Cleanup & Migration
**Goal:** Remove old components, ensure feature parity

**Deliverables:**
- [ ] Remove old settings components
- [ ] Remove old main window code
- [ ] Update any remaining references
- [ ] Document new architecture
- [ ] Final testing all features work

**Entry Criteria:** Phase 6 complete
**Exit Criteria:** Codebase clean, all features working, ready for release

---

### Phase 8: Real-Time Transcription Display
**Goal:** Show live speech-to-text feedback during dictation — WisprFlow-style confidence display
**Plans:** 4 plans

**Deliverables:**
- [ ] Dark translucent bar (85% opacity black, rounded corners) pinned above overlay
- [ ] Chunked Whisper inference (every ~2-3s) for streaming partial results
- [ ] Text appearing word/chunk-by-word with subtle fade-in animation
- [ ] Auto-scroll as new text flows in
- [ ] Pulse/waveform indicator on left showing active listening
- [ ] Tap/click to dismiss or minimize
- [ ] Backend streaming pipeline in transcription.rs
- [ ] Event system for partial transcription results

**Entry Criteria:** Phase 7 complete (clean codebase)
**Exit Criteria:** Users see real-time text during dictation, partial results replace with final output

Plans:
- [ ] 08-01-PLAN.md — Backend streaming buffer and streaming transcription pipeline
- [ ] 08-02-PLAN.md — Frontend transcription display overlay component and styles
- [ ] 08-03-PLAN.md — Wire backend to frontend, integrate into recording flow
- [ ] 08-04-PLAN.md — Visual and functional verification checkpoint

---

## Phase Dependencies

```
Phase 1 (Overlay)
    ↓
Phase 2 (Command Palette)
    ↓
Phase 3 (Tray Integration)
    ↓
Phase 4 (History & Profiles)
    ↓
Phase 5 (Settings Migration)
    ↓
Phase 6 (Polish)
    ↓
Phase 7 (Cleanup)
    ↓
Phase 8 (Real-Time Transcription Display)
```

All phases are sequential - each builds on the previous.

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Feature discovery collapse | Command palette must have excellent search; document keyboard shortcuts |
| Performance regression | Profile overlay rendering; <200ms target |
| User confusion (no window) | Clear tray tooltips; Ctrl+K visible in tray menu |
| Settings too hidden | Top 3 settings in tray menu; rest via palette |

## Success Metrics

1. **Zero main window usage** - All interactions via overlay/palette/tray
2. **<200ms activation** - Shortcut to recording indicator
3. **Feature parity** - Every existing feature accessible
4. **User preference** - Subjective "feels better than before"

---
*Roadmap created: 2026-02-04*
