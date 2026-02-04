# LeadrScribe UI Redesign

## What This Is

A complete UI/UX redesign of LeadrScribe, transforming it from a traditional settings-heavy desktop app into a WisprFlow-style minimal interface. The app will live primarily in the system tray with a floating pill overlay for recording status, while maintaining all existing functionality through a command palette and tray menu.

## Core Value

**The transcription experience must be invisible and instant.** Users should think *with* the app, not *about* the app. One hotkey, speak, release, done.

## Requirements

### Validated

<!-- Existing functionality that works and must be preserved -->

- ✓ Speech-to-text transcription via Whisper/Parakeet models — existing
- ✓ Global hotkey trigger (push-to-talk or toggle) — existing
- ✓ Voice Activity Detection (VAD) for smart recording — existing
- ✓ Multiple model support (Small, Medium, Large, Turbo, Parakeet) — existing
- ✓ Model downloading and management — existing
- ✓ Transcription history with persistence — existing
- ✓ Profile/Ghostwriter mode with custom AI instructions — existing
- ✓ Language selection and translation to English — existing
- ✓ Audio device selection (microphone, output) — existing
- ✓ System tray integration — existing
- ✓ Clipboard paste of transcriptions — existing
- ✓ Overlay window for recording feedback — existing
- ✓ Audio feedback sounds — existing
- ✓ Custom words dictionary — existing
- ✓ Autostart on login — existing
- ✓ Theme support (light/dark) — existing

### Active

<!-- New requirements for the redesign -->

- [ ] Floating pill/bar overlay design (replaces current overlay)
- [ ] Dark minimal visual theme (WisprFlow-inspired)
- [ ] Command palette for settings access (Ctrl+K)
- [ ] Tray menu with full settings access
- [ ] Simplified onboarding flow
- [ ] Minimal main window (or no main window at all)
- [ ] Smooth animations and transitions (GSAP or Framer Motion)
- [ ] Recording state indicator in floating pill
- [ ] Transcription preview in floating pill
- [ ] Quick access to history from command palette
- [ ] Quick access to profiles from command palette
- [ ] Model status/switching from command palette

### Out of Scope

- Mobile version — desktop-first, mobile deferred
- Real-time streaming transcription UI — current batch mode sufficient
- Multi-language UI — English only for v1 redesign
- Onboarding wizard redesign — keep minimal, improve later

## Context

**Current State:**
- LeadrScribe is a functional Tauri desktop app (Rust + React/TypeScript)
- Has 70+ React components, mostly settings-related
- Uses Tailwind CSS, Radix UI, Framer Motion, Zustand
- Current design feels like a "settings app" rather than a productivity tool
- Overlay exists but main window dominates the experience

**Design Inspiration:**
- WisprFlow: "Invisible interface" philosophy, dock bar, works IN apps
- Principle: "Users don't think about Flow, they think with it"

**Technical Approach:**
- Keep existing Rust backend intact (managers, commands, audio pipeline)
- Redesign React frontend components
- Focus on overlay and command palette as primary interfaces
- Reduce main window to minimal or eliminate entirely

## Constraints

- **Tech Stack**: Keep Tauri + React + TypeScript + Tailwind — no framework changes
- **Backend**: Rust backend unchanged — only frontend redesign
- **Compatibility**: Must work on Windows, macOS, Linux
- **Performance**: Overlay must be lightweight (<50MB memory impact)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| WisprFlow-style minimal | User prefers invisible interface over settings-heavy app | — Pending |
| Floating pill overlay | Better UX than corner indicator or center modal | — Pending |
| Both tray + command palette | Power users want keyboard access, casual users want click | — Pending |
| Dark minimal theme | Matches WisprFlow aesthetic, modern look | — Pending |
| Keep all features | No functionality loss, just better access patterns | — Pending |

---
*Last updated: 2026-02-04 after initialization*
