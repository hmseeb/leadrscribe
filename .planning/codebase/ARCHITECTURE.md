# Architecture

**Analysis Date:** 2026-02-04

## Pattern Overview

**Overall:** Tauri Desktop Application with Manager-based Backend Architecture

**Key Characteristics:**
- Cross-platform desktop app (Rust backend + React/TypeScript frontend)
- Manager pattern for core business logic (Audio, Model, Transcription, History, Profile, Tag)
- Command-Event architecture for frontend-backend communication
- Event-driven audio processing pipeline with Voice Activity Detection (VAD)
- Single-instance enforcement with tray menu integration

## Layers

**Presentation Layer (Frontend):**
- Purpose: React-based UI for settings, model selection, history management, and feedback
- Location: `src/`
- Contains: React components, hooks, stores, type definitions
- Depends on: Tauri API plugins for IPC, settings store, Zustand for state
- Used by: End users; interacts with backend via Tauri commands and events

**Command Handler Layer (Tauri Commands):**
- Purpose: Expose Rust functionality to frontend as invokable async commands
- Location: `src-tauri/src/commands/`
- Contains: Audio commands, transcription commands, model commands, history/profile/tag commands
- Depends on: Managers, AppHandle
- Used by: Frontend via `invoke()` from Tauri API

**Manager Layer (Business Logic):**
- Purpose: Core application logic organized into specialized managers
- Location: `src-tauri/src/managers/`
- Contains:
  - `AudioRecordingManager` - Records audio, manages VAD, emits audio segments
  - `ModelManager` - Downloads, loads, manages Whisper/Parakeet models
  - `TranscriptionManager` - Processes audio through loaded models, handles inference
  - `HistoryManager` - SQLite persistence for transcriptions, profiles, tags
  - `ProfileManager` - User profiles with custom instructions
  - `TagManager` - Tags for organizing transcriptions
- Depends on: Audio toolkit, settings, database
- Used by: Commands, setup/initialization logic

**Audio Toolkit Layer (Low-Level Audio):**
- Purpose: Cross-platform audio I/O, resampling, VAD processing
- Location: `src-tauri/src/audio_toolkit/`
- Contains:
  - `audio/` - Device enumeration, audio recording via cpal, resampling
  - `vad/` - Voice Activity Detection (Silero VAD model, smoothed wrapper)
  - `text/` - Text processing utilities (custom word application)
- Depends on: cpal, vad-rs, rubato
- Used by: AudioRecordingManager

**Infrastructure Layer:**
- Purpose: Cross-cutting concerns and system integration
- Location: `src-tauri/src/` (top-level modules)
- Contains:
  - `shortcut.rs` - Global keyboard shortcut registration and health checking
  - `overlay.rs` - Floating overlay window for recording feedback
  - `clipboard.rs` - System clipboard integration for pasting text
  - `audio_feedback.rs` - Sound effects during recording/transcription
  - `tray.rs` - System tray icon and menu
  - `settings.rs` - Settings persistence via Tauri store plugin
  - `utils.rs` - Shared utilities (tray updates, cancellation, overlay creation)
- Depends on: Tauri plugins, system APIs (rdev for global shortcuts, enigo for mouse)
- Used by: lib.rs setup, managers, commands

## Data Flow

**Recording Flow:**

1. Global keyboard shortcut triggers via `shortcut.rs`
2. Shortcut handler calls action from `actions.rs` ACTION_MAP
3. `AudioRecordingManager.start_recording()` begins audio capture
4. Audio device streams samples to `AudioRecorder` with VAD attached
5. `SileroVad` + `SmoothedVad` filter speech from silence
6. Audio segments emitted as events (`audio-segment`) to frontend
7. Frontend or backend displays overlay with recording state
8. User releases shortcut or VAD detects silence
9. `AudioRecordingManager.stop_recording()` returns audio buffer
10. Audio buffer passed to `TranscriptionManager.transcribe()`

**Transcription Flow:**

1. `TranscriptionManager.transcribe()` receives audio samples
2. Checks if model is loaded; if not, loads via `ModelManager`
3. Selects engine (WhisperEngine or ParakeetEngine) based on model type
4. Runs inference with language/translation options
5. Applies text processing (custom words, corrections)
6. Emits transcription events with text and timing data
7. Output mode determines next step:
   - `Transcript`: Paste text to active application via clipboard or direct keystroke
   - `Ghostwriter`: Send to OpenRouter API for enhancement
8. Result displayed in overlay, emitted to frontend via events

**State Management:**

- **Settings**: Stored in Tauri store plugin (JSON file in app data dir)
- **Models**: Cached in `{app_data}/models/` directory
- **History**: SQLite database at `{app_data}/history.db`
- **Runtime State**: Managers held in `AppHandle` managed state (Arc-wrapped, thread-safe)
- **Shortcut Toggle State**: `ShortcutToggleStates` in Mutex for non-push-to-talk mode

## Key Abstractions

**Manager Pattern:**
- Purpose: Encapsulate domain logic and lifecycle management
- Examples: `src-tauri/src/managers/*.rs`
- Pattern: Each manager owns its resources (paths, handles), exposes public methods, uses Arc<Mutex<>> for thread-safe state

**TranscriptionEngine Trait (via transcribe-rs):**
- Purpose: Unified interface for different speech models
- Implementations: WhisperEngine, ParakeetEngine
- Pattern: LoadedEngine enum wraps either implementation; inference calls polymorphic transcribe()

**Audio Processing Pipeline:**
- Purpose: Chain audio transformations and filtering
- Stages: Record → VAD → Resample → Transcribe → TextProcess → Output
- Pattern: AudioRecorder builder pattern with callbacks for segments and levels

**Command Handler Pattern:**
- Purpose: Bridge frontend requests to backend logic
- Examples: `src-tauri/src/commands/*.rs`
- Pattern: Each command is #[tauri::command] async fn; takes manager state, returns Result<T, String>

## Entry Points

**Main Application Entry:**
- Location: `src-tauri/src/lib.rs` - `run()` function
- Triggers: Tauri builder setup, plugin initialization, core logic initialization
- Responsibilities:
  - Initialize all Tauri plugins (shortcuts, store, SQL, updater, etc.)
  - Create and manage all core managers
  - Set up event listeners for frontend communication
  - Register Tauri commands
  - Initialize system tray and overlay window
  - Auto-load selected model on startup

**Frontend Entry:**
- Location: `src/App.tsx`
- Triggers: Vite build output loaded by index.html
- Responsibilities:
  - Check onboarding status
  - Render main settings UI or onboarding
  - Listen for backend events (notifications, model state, etc.)
  - Handle keyboard shortcuts (Cmd/Ctrl+K for command palette, Cmd/Ctrl+Shift+D for debug)
  - Route between settings sections

**Shortcut Handlers:**
- Location: `src-tauri/src/shortcut.rs` - `init_shortcuts()`
- Triggers: Application startup
- Responsibilities:
  - Register all keyboard shortcuts from settings
  - Set up shortcut health check thread (verifies registration every 10 seconds)
  - Re-register shortcuts if Windows sleep/idle breaks them

**Overlay Window:**
- Location: `src-tauri/src/utils.rs` - `create_recording_overlay()`
- Triggers: Application startup
- Responsibilities:
  - Create floating overlay window (frameless, always-on-top)
  - Position overlay based on settings (top, bottom, or hidden)
  - Track overlay visibility and position

## Error Handling

**Strategy:** Result<T, String> return types with anyhow::Error internally, mapped to String for Tauri command boundaries

**Patterns:**
- Manager initialization failures logged but app continues (non-fatal)
- Command handler failures return Err(String) to frontend as toast notifications via `show-notification` event
- Audio recording cancellation centralized in `utils::cancel_current_operation()` for consistent cleanup
- Model loading failures emit `model-load-error` events; fallback to smaller model if CPU incompatible (Parakeet requires AVX2)
- Shortcut registration failures logged; health check thread attempts recovery
- Database/SQL errors logged; operations continue if non-critical

## Cross-Cutting Concerns

**Logging:** `env_logger` + `log` crate; initialized at startup with `env_logger::init()`

**Validation:**
- Settings validated with Zod schemas on frontend (`src/lib/types.ts`)
- Rust types enforce correctness at compile time
- Custom word validation in `CustomWords.tsx`

**Authentication:** macOS permissions handled via `tauri-plugin-macos-permissions`; Linux/Windows use system APIs

**Thread Safety:**
- Managers wrapped in Arc for thread-safe sharing in Tauri state
- Internal state (engine, model info, recording state) behind Mutex<>
- Atomic flags for cancellation signals and load status
- Condition variables for synchronization between threads (model loading wait)

**IPC Communication:**
- Frontend → Backend: `invoke()` Tauri commands (async, returns Result)
- Backend → Frontend: `emit()` events with JSON payloads
- Settings updates trigger reactive store updates in Zustand

---

*Architecture analysis: 2026-02-04*
