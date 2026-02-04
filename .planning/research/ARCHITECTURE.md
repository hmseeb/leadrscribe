# Architecture Patterns: Minimal Floating Overlay UI in React/Tauri

**Domain:** Desktop transcription app UI redesign
**Researched:** 2026-02-04
**Overall confidence:** HIGH

## Executive Summary

Minimal floating overlay UIs in React/Tauri follow a multi-window architecture with clear separation of concerns: a persistent overlay window for feedback, an on-demand command palette for navigation/search, and a settings window accessed via tray menu. The architecture prioritizes event-driven communication over shared state, window lifecycle management with health checks, and progressive disclosure of complexity.

## Recommended Architecture

### Three-Window Pattern

```
┌─────────────────────────────────────────────────────┐
│ System Tray (Always Present)                        │
│  └─> Opens: Settings Window (on demand)             │
└─────────────────────────────────────────────────────┘
           │
           │ Controls via Rust Backend (Events)
           ▼
┌─────────────────────────────────────────────────────┐
│ Overlay Window (Persistent, hidden when idle)       │
│  - Recording feedback with animations               │
│  - Transcription status                             │
│  - No user input except ESC to cancel               │
└─────────────────────────────────────────────────────┘
           │
           │ Opened via keyboard shortcut (Cmd/Ctrl+K)
           ▼
┌─────────────────────────────────────────────────────┐
│ Command Palette Window (Modal, on-demand)           │
│  - Navigation to settings sections                  │
│  - Search transcriptions                            │
│  - Quick actions                                    │
└─────────────────────────────────────────────────────┘
```

**Rationale:** This pattern follows 2026 best practices for minimal desktop UIs with spatial UI principles - users only see what they need when they need it. Each window has a single responsibility, reducing coupling and improving performance.

## Component Boundaries

### 1. Overlay Window (Recording Feedback)

**Responsibility:** Visual feedback during recording and transcription operations

**Key characteristics:**
- Always-on-top, transparent, frameless window
- Positioned dynamically based on cursor monitor and user preference (top/bottom)
- No user input except ESC key for cancellation
- Self-contained state (visual animations only)
- Receives events from Rust backend, does not query

**State requirements:**
```typescript
type OverlayState = "recording" | "transcribing" | "ghostwriting" | "error"
```

**Communication pattern:**
- **Inbound:** Tauri events from Rust (`show-overlay`, `hide-overlay`, `mic-level`, `ghostwriter-error`)
- **Outbound:** Single command (`cancel_operation`)

**Why this boundary:** Overlay should be the fastest, most lightweight window. No complex state management, no data fetching, just pure visual feedback. This prevents overlay lag during recording.

### 2. Command Palette (Navigation & Search)

**Responsibility:** Quick navigation, transcription search, and action execution

**Key characteristics:**
- Modal window with backdrop blur
- Opens via global shortcut (Cmd/Ctrl+K) from any context
- Keyboard-first navigation (arrow keys, enter, escape)
- Searches both static commands and dynamic transcription history
- Dismisses after action execution

**State requirements:**
```typescript
interface CommandPaletteState {
  query: string
  results: (CommandItem | HistoryEntry)[]
  selectedIndex: number
}
```

**Communication pattern:**
- **Inbound:** Nothing on open (stateless initialization)
- **Outbound:**
  - Tauri command `search_transcriptions(query, limit)` for search
  - Navigation events to settings window
  - Action invocation commands

**Why this boundary:** Command palette should feel instant. All data is fetched on-demand (search as you type), and results are ephemeral. No persistent state prevents stale data issues.

### 3. Settings Window (Persistent Main Window)

**Responsibility:** Application configuration, transcription history, profile management

**Key characteristics:**
- Hidden on startup (unless opened from tray)
- Sidebar navigation with section-based routing
- Persistent Zustand store for settings
- Bridge between UI and Rust settings system

**State requirements:**
```typescript
interface SettingsStore {
  settings: Settings | null
  isLoading: boolean
  isUpdating: Record<string, boolean>
  audioDevices: AudioDevice[]
  outputDevices: AudioDevice[]
  customSounds: { start: boolean; stop: boolean }
}
```

**Communication pattern:**
- **Inbound:**
  - Tauri events (`show-notification`, `check-for-updates`)
  - Store plugin for settings persistence
- **Outbound:**
  - Multiple Tauri commands for settings updates
  - Device enumeration commands
  - Model management commands

**Why this boundary:** Settings is the only "heavy" window. It loads data once on initialization and maintains reactive state. Separating it from overlay/palette ensures those remain fast.

### 4. System Tray (Entry Point)

**Responsibility:** Application presence indicator and entry point

**Key characteristics:**
- Always visible in system tray
- Right-click menu: Settings, Check Updates, Cancel, Quit
- Dynamic icon based on state (idle, recording, error)
- Implemented entirely in Rust (no React component)

**Communication pattern:**
- **Rust-only:** No direct React communication
- Tray events trigger window show/hide operations
- Icon updates via `update_tray_menu` utility

**Why this boundary:** Tray logic lives in Rust because it requires system-level integration. React components never directly interact with tray - all communication goes through Rust backend events.

## State Management Strategy

### Principle: Right-Size State Scope

Based on current Tauri v2 best practices and production templates, use a three-tier state model:

#### Tier 1: Component State (useState)
**Use for:** Ephemeral UI state that doesn't affect other components

**Examples:**
- Command palette query and selected index
- Overlay animation state
- Form input values during editing

**Implementation:** React `useState`, `useRef`

#### Tier 2: Window State (Zustand)
**Use for:** Global UI state within a single window

**Examples:**
- Settings window: current section, sidebar state
- Command palette: N/A (uses only component state)
- Overlay: N/A (event-driven only)

**Implementation:** Zustand store with selectors

**Pattern for settings:**
```typescript
// Separate stores for different concerns
useSettingsStore    // User preferences
useModelStore       // Model management
useHistoryStore     // Transcription history (if needed)
```

**Why multiple stores:** Unlike Redux, Zustand encourages multiple small stores. If concerns are isolated (settings vs model downloads), separate stores prevent unnecessary re-renders and simplify logic.

#### Tier 3: Backend State (Rust + Events)
**Use for:** Persistent data, system integration, cross-window state

**Examples:**
- Recording state (idle/recording/processing)
- Current transcription progress
- Tray icon state
- All user settings (mirrored in Zustand for reactive UI)

**Implementation:** Rust managers with Tauri events

**Communication pattern:**
```
User Action (React)
  → Tauri Command (invoke)
  → Rust Manager Updates State
  → Emit Event to All Windows
  → React Listeners Update UI
```

**Critical insight:** State lives in Rust. React stores are read-only caches updated via events. Settings updates follow optimistic UI pattern: update Zustand immediately, invoke Rust command, rollback on error.

### Cross-Window State Synchronization

**Problem:** Command palette and settings window both need access to settings, but they're separate windows with separate JavaScript contexts.

**Current pattern (existing codebase):**
- Settings stored in Rust via Tauri store plugin
- Each window loads settings independently on mount
- Settings changes update Rust, which could emit events to sync other windows

**Recommended pattern for redesign:**
- Keep settings in Rust as source of truth
- Windows subscribe to `settings-changed` event
- On settings update: invoke Rust command → Rust persists → Rust emits event → All windows update their Zustand stores

**Implementation:**
```typescript
// In each window's settings hook
useEffect(() => {
  const unlisten = listen('settings-changed', (event) => {
    const updatedSetting = event.payload
    settingsStore.setSettings(updatedSetting)
  })
  return () => { unlisten.then(fn => fn()) }
}, [])
```

**Why NOT use zustand-sync-tabs middleware:**
- Tauri windows are separate processes, not tabs
- BroadcastChannel API doesn't work across Tauri windows
- Tauri events are the native IPC mechanism and are more reliable

### Window Lifecycle Management

#### Window Creation Strategies

**At Startup (Rust `setup` hook):**
```rust
fn initialize_core_logic(app_handle: &AppHandle) {
  create_recording_overlay(app_handle);  // Created but hidden
  // Main settings window already exists from tauri.conf.json
  // Command palette created lazily
}
```

**On Demand:**
```typescript
// Command palette
const openCommandPalette = async () => {
  const existing = await WebviewWindow.getByLabel('command-palette')
  if (existing) {
    await existing.show()
    await existing.setFocus()
  } else {
    const window = new WebviewWindow('command-palette', {
      url: 'command-palette.html',
      center: true,
      width: 600,
      height: 400,
      decorations: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      visible: false
    })
    await window.once('tauri://created', () => window.show())
  }
}
```

**Recommended for redesign:**
- **Overlay:** Pre-create at startup, keep persistent (current pattern is good)
- **Settings:** Pre-create but hidden (current pattern)
- **Command Palette:** Create on first use, keep persistent and reuse (don't destroy/recreate on each open)

**Why keep command palette persistent:** Creating/destroying windows is expensive (100-200ms). For an interaction meant to feel instant, show/hide existing window instead.

#### Health Check Pattern (Anti-Stale Window)

**Problem observed in codebase:** On Windows, after system sleep, overlay window handle becomes stale - `is_visible()` succeeds but window doesn't actually show.

**Solution implemented:**
```rust
fn ensure_overlay_exists(app_handle: &AppHandle) {
  let needs_recreation = if let Some(window) = get_window("overlay") {
    window.is_visible().is_err()  // Handle is stale
  } else {
    true  // Window doesn't exist
  };

  if needs_recreation {
    if let Some(old) = get_window("overlay") { old.destroy(); }
    create_recording_overlay(app_handle);
  }
}
```

**Recommendation:** Apply this pattern to all windows in redesign. Check before show, recreate if needed. This prevents "ghost window" bugs.

#### Window Position Management

**Current overlay pattern (good, keep this):**
```rust
// Position overlay on monitor containing cursor
fn calculate_overlay_position(app_handle: &AppHandle) -> (f64, f64) {
  let monitor = get_monitor_with_cursor(app_handle);
  let work_area = monitor.work_area();
  let x = center_horizontal(work_area, OVERLAY_WIDTH);
  let y = match settings.overlay_position {
    Top => work_area.y + TOP_OFFSET,
    Bottom => work_area.y + work_area.height - BOTTOM_OFFSET,
  };
  (x, y)
}
```

**For command palette:** Always center on primary monitor (don't follow cursor - palette is for navigation, not contextual feedback).

**For settings window:** Remember last position (use `tauri-plugin-window-state`).

## Data Flow Patterns

### Pattern 1: User Action → Rust → Event (Recording)

```
User presses recording shortcut
  ↓
Rust: shortcut.rs detects global hotkey
  ↓
Rust: AudioRecordingManager.start_recording()
  ↓
Rust: overlay::show_recording_overlay()
  ↓
Rust: Emit "show-overlay" event with state "recording"
  ↓
React (Overlay): Listen for event, update visual state
  ↓
Rust: Emit "mic-level" events with audio levels
  ↓
React (Overlay): Animate bars based on levels
  ↓
User releases recording shortcut
  ↓
Rust: AudioRecordingManager.stop_recording()
  ↓
Rust: TranscriptionManager.transcribe()
  ↓
Rust: Emit "show-overlay" event with state "transcribing"
  ↓
Rust: Transcription completes
  ↓
Rust: Emit "hide-overlay" event
  ↓
React (Overlay): Fade out and hide
```

**Key insight:** React overlay is purely reactive. It never queries state, only responds to events. This keeps it lightweight and ensures instant visual feedback.

### Pattern 2: User Action → Command → Update (Settings)

```
User changes setting in Settings UI
  ↓
React: settingsStore.updateSetting(key, value)
  ↓
Zustand: Optimistically update local state
  ↓
React: invoke("change_X_setting", { value })
  ↓
Rust: settings.rs validates and saves to disk
  ↓
Rust: Apply system changes (e.g., change audio device)
  ↓
On success: React continues with new state
On error: Zustand rollback to previous value
```

**Key insight:** Optimistic updates make UI feel instant. Rollback on error prevents drift between UI and actual state.

### Pattern 3: Command Palette Search (On-Demand Query)

```
User types in command palette
  ↓
React: debounce(query) triggers search
  ↓
React: invoke("search_transcriptions", { query, limit: 10 })
  ↓
Rust: HistoryManager.search() queries database
  ↓
Rust: Returns HistoryEntry[]
  ↓
React: Merge with filtered commands, display results
  ↓
User selects result
  ↓
React: Execute action or navigate to settings
  ↓
React: Close palette
```

**Key insight:** No persistent search state. Palette is stateless - query and results are ephemeral. This prevents stale search results and memory leaks.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Shared JavaScript Context Between Windows

**What it is:** Attempting to share React state or stores directly between windows

**Why bad:** Tauri windows run in separate processes. Shared memory doesn't exist. Attempts to share context lead to complex workarounds and race conditions.

**Instead:** Use Tauri events for communication. State lives in Rust, windows subscribe to changes.

**Example violation:**
```typescript
// ❌ BAD: Trying to share Zustand store between windows
// This will create separate instances per window
export const useGlobalStore = create(...)

// ✅ GOOD: Each window has its own store, synced via Rust events
const useSettingsStore = create(...)
listen('settings-changed', (event) => {
  useSettingsStore.setState(event.payload)
})
```

### Anti-Pattern 2: Complex State in Overlay Window

**What it is:** Putting data fetching, business logic, or heavy state management in the overlay component

**Why bad:** Overlay must be fastest window to respond. Complex state causes lag, ruins instant feedback feeling.

**Instead:** Overlay only has visual state (animation, current display mode). All logic lives in Rust, overlay just renders events.

**Example violation:**
```typescript
// ❌ BAD: Overlay fetching transcription progress
useEffect(() => {
  const interval = setInterval(async () => {
    const progress = await invoke("get_transcription_progress")
    setProgress(progress)
  }, 100)
}, [])

// ✅ GOOD: Rust emits progress events, overlay just displays
useEffect(() => {
  listen('transcription-progress', (event) => {
    setProgress(event.payload)
  })
}, [])
```

### Anti-Pattern 3: Destroying/Recreating Windows on Each Use

**What it is:** Creating command palette window every time user presses Cmd+K, destroying on close

**Why bad:** Window creation is expensive (100-200ms), causes visible lag, wastes resources

**Instead:** Create once, show/hide as needed. Only recreate if window becomes invalid.

**Example violation:**
```typescript
// ❌ BAD: Create new window every time
const openPalette = async () => {
  const window = new WebviewWindow('palette', config)
  // ...
}

// ✅ GOOD: Reuse existing window
const openPalette = async () => {
  const window = WebviewWindow.getByLabel('palette')
  if (window) {
    await window.show()
  } else {
    await createNewPaletteWindow()
  }
}
```

### Anti-Pattern 4: Tight Coupling Between UI Components

**What it is:** Command palette directly calling settings component methods, or overlay knowing about command palette

**Why bad:** Creates dependency chains, makes testing hard, prevents independent window development

**Instead:** Each window communicates only via Tauri backend. If command palette needs to open settings, it invokes a Rust command that shows the settings window.

**Example violation:**
```typescript
// ❌ BAD: Command palette directly manipulating settings window
const navigateToSettings = () => {
  const settingsWindow = WebviewWindow.getByLabel('main')
  settingsWindow.emit('navigate', { section: 'general' })
}

// ✅ GOOD: Command palette triggers navigation via Rust
const navigateToSettings = () => {
  invoke('show_settings', { section: 'general' })
  // Rust handles showing window and navigation
}
```

### Anti-Pattern 5: Polling Instead of Events

**What it is:** React components calling `invoke()` on intervals to check backend state

**Why bad:** Wastes resources, increases latency, creates race conditions, causes unnecessary re-renders

**Instead:** Rust emits events when state changes. React listens once and updates.

**Example violation:**
```typescript
// ❌ BAD: Polling for recording state
useEffect(() => {
  const interval = setInterval(async () => {
    const isRecording = await invoke('is_recording')
    setRecording(isRecording)
  }, 100)
}, [])

// ✅ GOOD: Event-driven state updates
useEffect(() => {
  const unlistenStart = listen('recording-started', () => setRecording(true))
  const unlistenStop = listen('recording-stopped', () => setRecording(false))
  return () => { unlistenStart(); unlistenStop(); }
}, [])
```

## Build Order Recommendations

### Phase 1: Window Infrastructure (Foundation)

**Goal:** Establish window lifecycle patterns without touching existing components

**Build order:**
1. **Overlay window isolation** - Extract overlay to standalone HTML entry point
2. **Command palette window creation** - New window with basic shell (no content yet)
3. **Window lifecycle utilities** - Health check, show/hide helpers, position management
4. **Event bridge setup** - TypeScript types for all Rust events

**Deliverable:** Three windows that can be shown/hidden independently, no crashes on system sleep

**Why first:** Window management is the foundation. Get it stable before moving components.

### Phase 2: State Architecture (Data Layer)

**Goal:** Establish state management patterns before migrating components

**Build order:**
1. **Zustand store restructure** - Split monolithic store into domain stores (settings, models, history)
2. **Event synchronization** - Implement settings-changed event listener pattern
3. **Optimistic update pattern** - Add rollback logic to settings updates
4. **Backend event types** - Complete TypeScript definitions for all Rust events

**Deliverable:** Settings store with event sync, working in existing main window

**Why second:** State patterns must be proven before migrating 70+ components. Test in existing window first.

### Phase 3: Command Palette (Minimal Surface Area)

**Goal:** Build smallest new UI surface to validate architecture

**Build order:**
1. **Static commands** - Navigation commands only (no search yet)
2. **Keyboard navigation** - Arrow keys, enter, escape
3. **Global shortcut trigger** - Cmd/Ctrl+K opens palette
4. **Search integration** - Connect to existing `search_transcriptions` command
5. **Navigation actions** - Trigger settings window navigation

**Deliverable:** Working command palette with search and navigation

**Why third:** Palette is new code (no migration), validates window communication patterns, small surface area for testing.

### Phase 4: Tray Menu Simplification

**Goal:** Reduce tray menu, remove settings sections

**Build order:**
1. **Menu reduction** - Settings, Check Updates, Cancel, Quit only
2. **Remove section navigation** - No History, Profiles, etc. in tray
3. **Icon state updates** - Ensure idle/recording/error states work
4. **Show settings action** - Tray → Settings opens to Dashboard

**Deliverable:** Minimal tray menu, command palette is now primary navigation

**Why fourth:** Small, low-risk change that removes code (always safer than adding). Validates tray → window communication.

### Phase 5: Component Migration (Incremental)

**Goal:** Move 70+ components to new structure without breaking functionality

**Migration groups (do in parallel):**
1. **Settings sections** - Keep all settings UI, just remove sidebar navigation chrome
2. **Dashboard** - Simplify to transcription history only
3. **Remove onboarding sidebar** - Onboarding stays, but becomes modal flow

**Build order per section:**
1. Extract component business logic from layout/navigation
2. Remove sidebar/section navigation props
3. Test in existing main window
4. Move to new structure

**Deliverable:** All functionality preserved, no sidebar, command palette as navigation

**Why fifth:** Only migrate after architecture is proven. Incremental migration reduces risk.

### Phase 6: Polish & Edge Cases

**Goal:** Handle failure modes and platform-specific issues

**Build order:**
1. **Window health checks** - Apply overlay recreation pattern to all windows
2. **Multi-monitor support** - Test overlay positioning on all monitors
3. **Startup state** - Ensure correct windows visible/hidden on launch
4. **Error states** - Graceful degradation when windows fail to create

**Deliverable:** Robust system that handles sleep/wake, monitor changes, startup failures

**Why last:** Edge cases become clear after main functionality is built. Premature optimization is wasteful.

## Technology Recommendations

### UI Component Library

**Current:** shadcn/ui components (via Radix UI + Tailwind)

**Recommendation:** Keep it. shadcn/ui is the 2026 standard for minimal desktop UIs because you own the source code (no runtime overhead) and components are accessible by default.

**For command palette specifically:** Consider `cmdk` library (unstyled command palette primitive). It's the standard for command palette UX and is what shadcn/ui uses internally for their command component.

```bash
bun add cmdk
```

**Why cmdk:** Handles keyboard navigation, fuzzy search, command scoring out of the box. You style it with Tailwind to match existing design.

### Animation Library

**Current:** Framer Motion

**Recommendation:** Keep it for overlay, remove from command palette and settings

**Rationale:**
- Overlay needs smooth animations for recording feedback - Framer Motion is perfect
- Command palette should feel instant - CSS transitions are lighter
- Settings doesn't need animations - remove Framer Motion to reduce bundle size

**Impact:** ~40KB reduction in settings window bundle by removing Framer Motion where unnecessary.

### State Management

**Current:** Zustand

**Recommendation:** Keep it, expand to multiple stores

**Pattern:**
```typescript
// src/stores/settings.ts
export const useSettingsStore = create<SettingsStore>(...)

// src/stores/models.ts
export const useModelStore = create<ModelStore>(...)

// src/stores/history.ts
export const useHistoryStore = create<HistoryStore>(...)
```

**Why multiple stores:** Prevents re-renders when unrelated data changes. Settings change shouldn't re-render history list.

### Window State Persistence

**New:** `tauri-plugin-window-state`

**Purpose:** Remember settings window position/size between sessions

```toml
# src-tauri/Cargo.toml
tauri-plugin-window-state = "2.0"
```

**Configuration:**
```rust
fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_window_state::Builder::default().build())
    // ...
}
```

**Why add:** Professional desktop apps remember window positions. Users expect this.

## Platform-Specific Considerations

### macOS

**NSPanel for overlay (already implemented):**
Current code uses native NSPanel for proper fullscreen behavior. Keep this pattern.

**Accessibility activation policy:**
When all windows are hidden, app should use `ActivationPolicy::Accessory` to hide from dock. When settings window opens, switch to `ActivationPolicy::Regular`. This is already implemented - keep it.

**Menu bar icon:**
macOS expects menu bar icon to be template images (monochrome). Current implementation uses `icon_as_template(true)` - correct.

### Windows

**Overlay window recreation after sleep:**
Windows has known issue where window handles become stale after system sleep. Current `ensure_overlay_exists` pattern solves this. Apply same pattern to all windows.

**Taskbar skip:**
All utility windows (overlay, command palette) should have `skip_taskbar: true`. Only settings window appears in taskbar.

### Linux

**X11 vs Wayland:**
Overlay positioning may differ between X11 and Wayland. Test on both. Wayland has more restrictions on window positioning and always-on-top behavior.

**Global shortcuts:**
Global shortcuts may require additional permissions on some Linux distributions. Document this in setup instructions.

## Migration Path from Current to Target

### Current State (70+ components, sidebar navigation)
```
Main Window (always visible)
  ├─ TitleBar
  ├─ Sidebar (navigation chrome)
  │   ├─ Dashboard
  │   ├─ History
  │   ├─ Profiles
  │   ├─ Settings
  │   └─ About
  └─ Content Area (renders selected section)

Overlay Window (separate HTML, working correctly)
```

### Target State (minimal, command palette navigation)
```
System Tray
  └─ Menu: Settings, Check Updates, Cancel, Quit

Settings Window (hidden by default)
  ├─ No sidebar
  ├─ No explicit section navigation
  └─ All content in single scrollable view or routed via command palette

Command Palette (new, Cmd+K)
  ├─ Navigate to setting sections
  ├─ Search transcriptions
  └─ Quick actions

Overlay Window (unchanged)
```

### Migration Strategy

**Option A: Parallel Implementation (Safer)**
1. Build command palette in new window
2. Keep sidebar visible with deprecation notice
3. Test both navigation methods simultaneously
4. Remove sidebar once command palette is proven

**Option B: Feature Flag (Professional)**
1. Add feature flag `USE_MINIMAL_UI` in settings
2. If enabled: hide sidebar, enable command palette
3. If disabled: classic UI
4. Ship both, gather feedback, deprecate classic

**Recommendation:** Option B. Feature flags de-risk UI changes by allowing easy rollback.

## Success Metrics

### Performance
- **Overlay show latency:** < 50ms (currently ~100ms, should improve)
- **Command palette open latency:** < 100ms (target: instant feel)
- **Settings window initial load:** < 500ms (acceptable for infrequent action)

### Code Health
- **Component count:** 70 → 40-50 (reduce by removing navigation chrome)
- **Bundle size:**
  - Settings window: ~800KB → ~750KB (remove unused Framer Motion)
  - Command palette: ~300KB (new, should be lightweight)
  - Overlay: < 200KB (no change, already minimal)

### User Experience
- **Keyboard-first:** 80%+ of actions accessible via command palette
- **Zero-chrome:** Only content visible, no persistent navigation UI
- **Always accessible:** Tray icon always visible, command palette works from anywhere

## Open Questions & Validation Needed

### Question 1: Command Palette as Primary Navigation
**Assumption:** Users will adopt Cmd+K navigation over clicking tray menu

**Validation needed:**
- Do users discover Cmd+K without prompting?
- Is search fast enough for 10,000+ transcriptions?

**Mitigation:** Add tooltip on first launch: "Press Cmd+K to open command palette"

### Question 2: Single Settings Window vs Sections
**Assumption:** Settings can be single scrollable view instead of sidebar sections

**Validation needed:**
- Are settings categories discoverable without sidebar?
- Does single view feel cluttered?

**Mitigation:** Keep section routing via command palette, just remove visible sidebar navigation

### Question 3: Overlay Positioning Preference
**Assumption:** Current top/bottom user preference is sufficient

**Validation needed:**
- Do users want custom positioning (exact coordinates)?
- Should overlay follow cursor or stay on primary monitor?

**Mitigation:** Keep current behavior, add custom positioning in future if requested

## Sources

### Architecture Patterns & Best Practices
- [Tauri multi-window management and system tray implementation](https://www.oreateai.com/blog/tauri-2x-practice-implementing-multiwindow-management-and-system-tray-functionality-based-on-vue3/3983ab1af42b93d3abb0068965b1bae2)
- [Tauri state management official docs](https://v2.tauri.app/develop/state-management/)
- [Tauri production-ready template with React 19](https://github.com/dannysmith/tauri-template)
- [Loosely synchronize Zustand stores in multiple Tauri processes](https://www.gethopp.app/blog/tauri-window-state-sync)
- [Tauri window lifecycle and best practices](https://v2.tauri.app/plugin/window-state/)

### State Management & Component Architecture
- [Zustand architecture patterns at scale](https://brainhub.eu/library/zustand-architecture-patterns-at-scale)
- [Zustand slices pattern](https://zustand.docs.pmnd.rs/guides/slices-pattern)
- [Large-scale React Zustand project structure](https://medium.com/@itsspss/large-scale-react-zustand-nest-js-project-structure-and-best-practices-93397fb473f4)
- [React component architecture anti-patterns](https://itnext.io/6-common-react-anti-patterns-that-are-hurting-your-code-quality-904b9c32e933)
- [7 architectural attributes of reliable React components](https://dmitripavlutin.com/7-architectural-attributes-of-a-reliable-react-component/)

### Command Palette Implementation
- [cmdk - Fast, unstyled command menu React component](https://github.com/dip/cmdk)
- [react-cmdk - Build your dream command palette](https://react-cmdk.com/)
- [Command-K mastery in React](https://reactlibs.dev/articles/command-k-mastery-cmdk-react/)

### Minimal UI Design Patterns (2026)
- [UI/UX design trends that will dominate 2026](https://www.index.dev/blog/ui-ux-design-trends)
- [Why minimalist UI design in 2026 is built for speed and clarity](https://www.anctech.in/blog/explore-how-minimalist-ui-design-in-2026-focuses-on-performance-accessibility-and-content-clarity-learn-how-clean-interfaces-subtle-interactions-and-data-driven-layouts-create-better-user-experie/)
- [Overlay patterns - PIE Design System](https://pie.design/patterns/overlay-patterns/)
- [React Stack Patterns 2026](https://www.patterns.dev/react/react-2026/)

### Window Management
- [Tauri multi-window architecture discussion](https://github.com/orgs/tauri-apps/discussions/14705)
- [Tauri window management best practices](https://github.com/tauri-apps/tauri/discussions/9423)
- [Creating and managing multiple windows in Tauri](https://app.studyraid.com/en/read/8393/231500/creating-and-managing-multiple-windows)
