# Requirements: LeadrScribe UI Redesign v1

**Version:** 1.0
**Scoped:** 2026-02-04
**Scope:** All 3 phases - complete redesign

## v1 Requirements

### Core UI Architecture

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| UI-001 | Eliminate main window entirely | P0 | All settings via command palette + tray |
| UI-002 | Floating pill/bar overlay for recording | P0 | WisprFlow-style minimal design |
| UI-003 | Dark minimal visual theme | P0 | Consistent with WisprFlow aesthetic |
| UI-004 | User-configurable overlay position | P1 | Top, bottom, or follow cursor options |
| UI-005 | Single overlay at a time | P0 | Clear state transitions, no overlap |

### Recording Experience

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| REC-001 | Global keyboard shortcut activation | P0 | Single keypress, works system-wide |
| REC-002 | Push-to-talk interface | P0 | Hold to record, release to transcribe |
| REC-003 | Visual recording indicator | P0 | Pulsing mic icon, audio level bars |
| REC-004 | Auto-paste on completion | P0 | Works in any text field |
| REC-005 | ESC key cancels recording | P0 | Immediate cancellation, no wait |
| REC-006 | Audio feedback sounds | P1 | Start/stop recording sounds |

### Command Palette (Ctrl+K)

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| CMD-001 | Global Ctrl+K activation | P0 | Opens command palette from anywhere |
| CMD-002 | Fuzzy search | P0 | Match partial text, abbreviations |
| CMD-003 | Keyboard navigation | P0 | Arrow keys, Enter to select, ESC to dismiss |
| CMD-004 | Command index | P0 | All settings accessible as commands |
| CMD-005 | History search integration | P1 | Search past transcriptions |
| CMD-006 | Profile quick-switch | P1 | Fast profile cycling |
| CMD-007 | Model status/switching | P1 | View and change model from palette |
| CMD-008 | Learning/ranking | P2 | Prioritize frequently-used commands |

### Tray Menu

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| TRAY-001 | System tray icon | P0 | Lives in tray, not taskbar |
| TRAY-002 | Recording status indicator | P1 | Visual state in tray icon |
| TRAY-003 | Quick access menu | P0 | 3-5 top actions max |
| TRAY-004 | Settings access | P0 | Opens command palette or direct to setting |
| TRAY-005 | Quit option | P0 | Clean app exit |

### Settings Access

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| SET-001 | Shortcut customization | P0 | Change global shortcuts |
| SET-002 | Microphone selection | P0 | Choose audio input device |
| SET-003 | Model selection | P0 | Choose Whisper/Parakeet variant |
| SET-004 | Language selection | P1 | Set transcription language |
| SET-005 | Overlay position setting | P1 | Top/bottom/follow cursor |
| SET-006 | Theme toggle | P2 | Dark/light mode (dark default) |
| SET-007 | Autostart toggle | P1 | Start on system boot |
| SET-008 | Audio feedback toggle | P2 | Enable/disable sounds |

### History Panel

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| HIST-001 | History accessible from command palette | P1 | Type "history" to see transcriptions |
| HIST-002 | Search past transcriptions | P1 | Full-text search |
| HIST-003 | Copy past transcription | P1 | One-click copy to clipboard |
| HIST-004 | Delete transcription | P2 | Remove from history |

### Profiles/Ghostwriter

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| PROF-001 | Profile switching from command palette | P1 | Quick profile change |
| PROF-002 | Profile hotkey cycling | P2 | Keyboard shortcut to cycle profiles |
| PROF-003 | Create/edit profiles | P1 | Via command palette flow |
| PROF-004 | Custom AI instructions per profile | P1 | Ghostwriter mode configuration |

### Animation & Polish

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| ANIM-001 | Smooth overlay transitions | P1 | Fade in/out, scale animations |
| ANIM-002 | Command palette animations | P1 | Slide in, spring physics |
| ANIM-003 | Recording state animations | P1 | Pulsing indicator, audio bars |
| ANIM-004 | Micro-interactions | P2 | Button hover states, feedback |

### Workflow Automation (Phase 3)

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| WORK-001 | Full keyboard shortcut customization | P2 | Remap all shortcuts |
| WORK-002 | Workflow chaining (stretch) | P3 | Chain actions together |
| WORK-003 | Context-aware profiles (stretch) | P3 | Auto-switch based on active app |

## Out of Scope for v1

- Mobile version
- Multi-language UI (English only)
- Real-time streaming transcription display
- Cloud sync
- Extension/plugin system
- Team features
- Analytics dashboard

## Anti-Requirements (Explicitly Avoid)

| Anti-Requirement | Reason |
|------------------|--------|
| Full-window settings interface | Breaks minimal promise |
| Multi-step onboarding | Friction before value |
| Streaming transcription display | Flickering, errors visible |
| Multiple overlays simultaneously | Confusing state |
| Tray menu with 20+ items | Analysis paralysis |
| Modal dialogs for errors | Blocks workflow |
| Startup splash screen | Perceived latency |
| Main window (eliminated) | Settings-app feel |

## Priority Legend

- **P0**: Must have for v1 launch - blocking
- **P1**: Should have - important for user experience
- **P2**: Nice to have - polish and refinement
- **P3**: Stretch goals - if time permits

## Success Criteria

1. **Invisible until needed**: App lives in tray, zero visual footprint when idle
2. **Instant activation**: <200ms from shortcut to recording indicator visible
3. **Keyboard-first**: All actions accessible without mouse
4. **Feature parity**: All existing functionality accessible (different UX, same capabilities)
5. **Modern aesthetic**: Dark minimal theme matching WisprFlow quality

---
*Requirements scoped: 2026-02-04*
