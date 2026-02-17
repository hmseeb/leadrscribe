# Codebase Structure

**Analysis Date:** 2026-02-04

## Directory Layout

```
leadrscribe/
├── src/                              # Frontend TypeScript/React
│   ├── App.tsx                       # Main app component, routing
│   ├── index.css                     # Global styles
│   ├── components/
│   │   ├── AccessibilityPermissions.tsx
│   │   ├── Sidebar.tsx               # Settings sidebar navigation
│   │   ├── TitleBar.tsx              # Window title bar
│   │   ├── command-palette/          # Command palette UI
│   │   ├── dashboard/                # Main dashboard view
│   │   ├── icons/                    # SVG icon components
│   │   ├── model-selector/           # Model download/selection UI
│   │   ├── onboarding/               # First-run onboarding flow
│   │   ├── profile/                  # Profile management UI
│   │   ├── settings/                 # Settings panels (50+ components)
│   │   │   ├── GeneralSettings.tsx   # Core transcription settings
│   │   │   ├── LeadrScribeShortcut.tsx # Keyboard shortcut binding UI
│   │   │   ├── CustomWords.tsx       # Custom word list editor
│   │   │   ├── HistorySettings.tsx   # History management
│   │   │   ├── debug/                # Debug mode settings
│   │   │   └── ...                   # Individual setting toggles
│   │   ├── shared/                   # Shared UI components
│   │   ├── ui/                       # Base UI components (Button, Input, etc.)
│   │   └── update-checker/           # Update check UI
│   ├── hooks/
│   │   ├── useSettings.ts            # Settings store access hook
│   │   ├── useModels.ts              # Model list/status hook
│   │   ├── useTheme.ts               # Theme detection hook
│   │   └── useCpuCapabilities.ts     # CPU feature detection hook
│   ├── lib/
│   │   ├── types.ts                  # Zod schemas and TypeScript types
│   │   ├── constants/                # App constants
│   │   └── utils/                    # Frontend utilities
│   ├── overlay/                      # Overlay window (separate Vite app)
│   │   ├── main.tsx                  # Overlay entry point
│   │   ├── index.html                # Overlay HTML
│   │   └── RecordingOverlay.tsx      # Overlay display component
│   └── stores/
│       └── settingsStore.ts          # Zustand settings state management
├── src-tauri/                        # Backend Rust (Tauri)
│   ├── src/
│   │   ├── lib.rs                    # Main application entry, Tauri setup
│   │   ├── main.rs                   # Binary entry point
│   │   ├── managers/                 # Core business logic
│   │   │   ├── mod.rs                # Manager module exports
│   │   │   ├── audio.rs              # AudioRecordingManager
│   │   │   ├── model.rs              # ModelManager (download, load models)
│   │   │   ├── transcription.rs      # TranscriptionManager (inference)
│   │   │   ├── history.rs            # HistoryManager (SQLite, persistence)
│   │   │   ├── profile.rs            # ProfileManager
│   │   │   └── tag.rs                # TagManager
│   │   ├── commands/                 # Tauri command handlers
│   │   │   ├── mod.rs                # Command module exports
│   │   │   ├── audio.rs              # Audio-related commands
│   │   │   ├── transcription.rs      # Transcription commands
│   │   │   ├── models.rs             # Model management commands
│   │   │   ├── history.rs            # History commands
│   │   │   ├── profile.rs            # Profile commands
│   │   │   └── tag.rs                # Tag commands
│   │   ├── audio_toolkit/            # Low-level audio processing
│   │   │   ├── mod.rs                # Exports for audio module
│   │   │   ├── audio/
│   │   │   │   ├── mod.rs            # AudioRecorder, exports
│   │   │   │   ├── device.rs         # Audio device enumeration (cpal)
│   │   │   │   ├── recorder.rs       # AudioRecorder implementation
│   │   │   │   ├── resampler.rs      # Audio resampling (rubato)
│   │   │   │   ├── visualizer.rs     # Audio level visualization
│   │   │   │   └── utils.rs          # WAV file saving
│   │   │   ├── vad/                  # Voice Activity Detection
│   │   │   │   ├── mod.rs            # VAD trait and exports
│   │   │   │   ├── silero.rs         # Silero VAD model inference
│   │   │   │   └── smoothed.rs       # SmoothedVad wrapper (noise reduction)
│   │   │   ├── text.rs               # Text processing (custom words)
│   │   │   ├── constants.rs          # Audio constants (sample rates, etc.)
│   │   │   ├── utils.rs              # Audio utilities
│   │   │   └── bin/
│   │   │       └── cli.rs            # Unused CLI binary
│   │   ├── shortcut.rs               # Global keyboard shortcut handling
│   │   ├── overlay.rs                # Overlay window creation/management
│   │   ├── clipboard.rs              # Clipboard integration
│   │   ├── audio_feedback.rs         # Recording/transcription sound effects
│   │   ├── tray.rs                   # System tray icon and menu
│   │   ├── settings.rs               # Settings schema and management
│   │   ├── actions.rs                # ACTION_MAP for shortcut handlers
│   │   ├── ghostwriter.rs            # OpenRouter API integration
│   │   ├── cpu_features.rs           # CPU capability detection
│   │   ├── migration.rs              # User data migration from old app
│   │   └── utils.rs                  # Shared utilities
│   ├── Cargo.toml                    # Rust dependencies
│   ├── tauri.conf.json               # Tauri configuration
│   └── resources/                    # Bundled resources
│       ├── tray_*.png                # Tray icons (idle, recording, transcribing)
│       └── models/                   # Downloaded models (runtime)
├── src-tauri/build.rs                # Tauri build script
├── package.json                      # Frontend dependencies
├── vite.config.ts                    # Vite build configuration
├── tsconfig.json                     # TypeScript configuration
├── components.json                   # shadcn component registry
├── index.html                        # Main window HTML
├── .planning/                        # GSD planning documents
│   └── codebase/                     # Architecture/structure docs
├── assets/                           # Icon and image assets
└── .vscode/                          # VS Code settings
```

## Directory Purposes

**`src/`:**
- Purpose: Frontend React application
- Contains: React components, hooks, stores, types, overlay
- Key files: `App.tsx` (routing), `stores/settingsStore.ts` (state), `lib/types.ts` (schemas)

**`src/components/`:**
- Purpose: Reusable React UI components
- Contains: 50+ component files organized by feature (settings, model, onboarding, etc.)
- Key files: `Sidebar.tsx` (navigation), `settings/*.tsx` (individual settings panels)

**`src/components/ui/`:**
- Purpose: Base UI component library (Radix UI + custom)
- Contains: Button, Input, Dialog, Select, Slider, etc.
- Pattern: Styled with Tailwind CSS, exported via barrel file

**`src/hooks/`:**
- Purpose: Reusable React hooks for backend communication
- Contains: useSettings (Zustand store access), useModels (model info), useTheme, useCpuCapabilities
- Pattern: Each hook returns { value, setter? } or async state

**`src/stores/`:**
- Purpose: Zustand state management for frontend
- Contains: `settingsStore.ts` - reactive settings with Tauri command integration

**`src/lib/types.ts`:**
- Purpose: Single source of truth for all TypeScript types and Zod schemas
- Contains: Settings schema, model info schema, shortcut binding schema
- Pattern: Each schema exported as both Zod type and TS type

**`src/overlay/`:**
- Purpose: Separate floating window for recording feedback
- Contains: `RecordingOverlay.tsx` (display), `main.tsx` (entry point)
- Key files: `RecordingOverlay.tsx` - listens for overlay-related events

**`src-tauri/src/lib.rs`:**
- Purpose: Tauri application entry and setup
- Contains: Plugin initialization, manager creation, shortcut initialization, tray creation
- Pattern: `initialize_core_logic()` function called on app setup; all managers created and managed here

**`src-tauri/src/managers/`:**
- Purpose: Core business logic for each domain
- Contains: 6 managers (Audio, Model, Transcription, History, Profile, Tag)
- Pattern: Each manager owns resources, wraps state in Arc<Mutex<>>, exposes public interface

**`src-tauri/src/commands/`:**
- Purpose: Tauri command handlers (RPC endpoints for frontend)
- Contains: 7 modules (one per domain), each with #[tauri::command] functions
- Pattern: Each command takes `AppHandle` and optional manager `State<>`, returns `Result<T, String>`

**`src-tauri/src/audio_toolkit/audio/`:**
- Purpose: Cross-platform audio I/O via cpal
- Contains: Device enumeration, audio recording with callbacks, resampling
- Key files: `recorder.rs` (AudioRecorder with builder pattern), `device.rs` (cpal abstraction)

**`src-tauri/src/audio_toolkit/vad/`:**
- Purpose: Voice Activity Detection pipeline
- Contains: Silero VAD model inference, smoothed wrapper for noise reduction
- Key files: `silero.rs` (Silero ONNX model), `smoothed.rs` (delay and hysteresis)

**`src-tauri/src/shortcut.rs`:**
- Purpose: Global keyboard shortcut registration and management
- Contains: Shortcut registration loop, health check thread (verifies every 10s)
- Pattern: Action handlers called from ACTION_MAP in `actions.rs`

**`src-tauri/src/overlay.rs`:**
- Purpose: Overlay window lifecycle and positioning
- Contains: Overlay creation, positioning based on monitor/cursor, visibility management
- Pattern: Platform-specific offsets (macOS vs Windows/Linux)

## Key File Locations

**Entry Points:**
- `src-tauri/src/lib.rs` - Rust backend entry; `run()` function called by Tauri
- `src-tauri/src/main.rs` - Binary entry point (minimal, delegates to lib.rs)
- `src/App.tsx` - React frontend entry; main routing logic
- `src/overlay/main.tsx` - Overlay window entry; loads RecordingOverlay component

**Configuration:**
- `src-tauri/tauri.conf.json` - Tauri window, bundle, plugin config
- `src-tauri/Cargo.toml` - Rust dependencies
- `package.json` - Frontend dependencies and scripts
- `vite.config.ts` - Vite build configuration
- `tsconfig.json` - TypeScript compiler options

**Core Logic:**
- `src-tauri/src/managers/*.rs` - Business logic (6 files)
- `src-tauri/src/audio_toolkit/` - Audio I/O and VAD (8 files)
- `src-tauri/src/shortcut.rs` - Keyboard shortcut handling
- `src-tauri/src/commands/*.rs` - Command handlers (7 files)

**Testing:**
- No dedicated test files found; testing via manual testing or not in scope

**Frontend State:**
- `src/stores/settingsStore.ts` - Zustand settings store
- `src/lib/types.ts` - Type definitions

## Naming Conventions

**Files:**
- Rust: `snake_case.rs` (e.g., `audio_toolkit.rs`, `model.rs`)
- React: `PascalCase.tsx` for components (e.g., `Dashboard.tsx`), `camelCase.ts` for utilities
- Constants: `SCREAMING_SNAKE_CASE` in Rust, `camelCase` in TypeScript

**Directories:**
- Rust: `snake_case` (e.g., `audio_toolkit`, `src-tauri`)
- React: `kebab-case` (e.g., `model-selector`, `command-palette`)

**Functions:**
- Rust: `snake_case` (e.g., `initialize_core_logic`, `cancel_current_operation`)
- React: `camelCase` for utilities (e.g., `useSettings`, `listInputDevices`)
- React: `PascalCase` for components (e.g., `Dashboard`, `ModelSelector`)

**Types:**
- Rust structs: `PascalCase` (e.g., `TranscriptionManager`, `AudioRecorder`)
- Rust enums: `PascalCase` (e.g., `RecordingState`, `EngineType`)
- TypeScript types: `PascalCase` (e.g., `Settings`, `ModelInfo`)

## Where to Add New Code

**New Feature - Recording/Transcription Enhancement:**
- Primary code: `src-tauri/src/managers/transcription.rs` (logic), `src-tauri/src/commands/transcription.rs` (RPC)
- Frontend: `src/components/settings/GeneralSettings.tsx` or new settings component
- Tests: Add to manager if test structure introduced

**New Component - UI or Settings Panel:**
- Implementation: `src/components/` directory (feature-specific subdirectory)
- Styling: Tailwind CSS classes; use Radix UI primitives from `src/components/ui/`
- State: Add to Zustand store in `src/stores/settingsStore.ts` if new setting
- Types: Add schema to `src/lib/types.ts` if new data structure

**New Manager - New Domain:**
- Implementation: `src-tauri/src/managers/{domain}.rs`
- Commands: `src-tauri/src/commands/{domain}.rs` with #[tauri::command] functions
- Export: Add to `src-tauri/src/managers/mod.rs` and `src-tauri/src/commands/mod.rs`
- Registration: Initialize in `src-tauri/src/lib.rs` `initialize_core_logic()`, add to managed state

**New Utility:**
- Shared backend utilities: `src-tauri/src/utils.rs` or domain-specific module
- Frontend utilities: `src/lib/utils/` directory

**New Audio Processing Stage:**
- Location: `src-tauri/src/audio_toolkit/` (new module or extend `audio/recorder.rs`)
- Integration: Add callback support to `AudioRecorder` or VAD pipeline
- Usage: Integrate in `AudioRecordingManager` audio flow

**Global Shortcut Handler:**
- Location: Add to `ACTION_MAP` in `src-tauri/src/actions.rs`
- Pattern: Implement `Action` trait with `start()` and `stop()` methods
- Registration: Shortcut automatically loaded from settings in `src-tauri/src/shortcut.rs`

## Special Directories

**`assets/`:**
- Purpose: App icons, branding assets
- Generated: No
- Committed: Yes
- Contains: Icon files for tray, window, app packaging

**`src-tauri/resources/`:**
- Purpose: Runtime resources bundled with app
- Generated: Partially (models downloaded at runtime into `models/` subdir)
- Committed: Yes for icons, No for downloaded models
- Contains: Tray icon PNGs, VAD model file location (silero_vad_v4.onnx)

**`.planning/codebase/`:**
- Purpose: GSD codebase documentation
- Generated: Yes (by GSD mapper)
- Committed: Yes
- Contains: ARCHITECTURE.md, STRUCTURE.md, etc.

**`.claude/`:**
- Purpose: Claude-specific configuration
- Generated: Yes
- Committed: Optional
- Contains: Claude Code workspace settings

**`dist/`:**
- Purpose: Built frontend assets (Vite output)
- Generated: Yes
- Committed: No
- Contains: HTML, JS, CSS for web distribution

---

*Structure analysis: 2026-02-04*
