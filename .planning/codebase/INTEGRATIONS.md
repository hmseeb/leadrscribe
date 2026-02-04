# External Integrations

**Analysis Date:** 2026-02-04

## APIs & External Services

**Model Downloads:**
- Service: blob.handy.computer (custom model server)
- What it's used for: Downloading Whisper and Parakeet speech recognition models
- Models available:
  - `https://blob.handy.computer/ggml-small.bin` (487 MB)
  - `https://blob.handy.computer/whisper-medium-q4_1.bin` (492 MB)
  - `https://blob.handy.computer/ggml-large-v3-turbo.bin` (1600 MB)
  - `https://blob.handy.computer/ggml-large-v3-q5_0.bin` (1100 MB)
  - `https://blob.handy.computer/parakeet-v2-int8.tar.gz`
  - `https://blob.handy.computer/parakeet-v3-int8.tar.gz`
- SDK/Client: `reqwest` 0.11.27 with streaming and range request support
- Implementation: `src-tauri/src/managers/model.rs` - Downloads with resumable progress tracking
- Authentication: None (public downloads)

## Data Storage

**Databases:**
- Type: SQLite
- Provider: Bundled SQLite via `rusqlite` with `tauri-plugin-sql`
- Location: `{app_data}/history.db`
- Connection: Direct via SQLite bindings
- Client: `rusqlite` 0.32.1 (Rust) + `@tauri-apps/plugin-sql` 2.3.1 (Frontend IPC)
- Schema: Managed via migrations in `src-tauri/src/managers/history.rs`
  - `transcription_history` - Transcription records with full-text search (FTS5)
  - `profiles` - User-defined profiles for organization
  - `tags` - Tags for categorization
  - Relationships: History entries reference profiles via foreign key

**File Storage:**
- Recordings: Local filesystem at `{app_data}/recordings/`
- Models: Local filesystem at `{app_data}/models/`
- Architecture: All data stored locally; no cloud storage integration

**Key-Value Store:**
- Service: Local store (Tauri plugin-store)
- Purpose: Persistent application settings
- Location: `{app_data}/settings.json` (managed by @tauri-apps/plugin-store)
- What's stored:
  - Keyboard shortcuts and their bindings
  - Audio device selections (microphone/output)
  - Model preferences (selected Whisper/Parakeet variant)
  - Audio feedback toggle
  - Translation settings
  - Model unload timeout
  - Paste method (Ctrl+V vs direct input)
  - Clipboard handling behavior
  - Overlay position configuration
  - Custom words for text post-processing
  - Microphone mode settings
  - History limit
- Implementation: `src-tauri/src/settings.rs` - Reactive updates via IPC

**Caching:**
- Model caching: Loaded models stay in memory with configurable idle timeout (2-60 minutes)
- Mechanism: `src-tauri/src/managers/transcription.rs` - Background thread monitors last activity time
- Purpose: Reduce model reload latency on repeated transcriptions

## Authentication & Identity

**Auth Provider:**
- Type: Custom application identity only
- App ID: `com.leadr.leadrscribe`
- No user authentication system
- Single-instance enforcement via `tauri-plugin-single-instance`

## System Integration

**Global Keyboard Shortcuts:**
- Provider: rdev (global input listening) + enigo (virtual input)
- Implementation: `src-tauri/src/shortcut.rs`
- Features:
  - Configurable push-to-talk activation
  - Global transcription trigger
  - Debug mode toggle (Ctrl+Shift+D / Cmd+Shift+D)
  - Custom shortcut bindings

**System Clipboard:**
- Provider: `@tauri-apps/plugin-clipboard-manager` + native clipboard APIs
- Implementation: `src-tauri/src/clipboard.rs`
- Operations:
  - Read existing clipboard content before pasting
  - Write transcribed text to clipboard
  - Restore previous content after paste (configurable)
- Paste methods:
  - Ctrl+V/Cmd+V simulation via keyboard events
  - Direct text input via enigo for non-English keyboards

**Virtual Input Simulation:**
- Provider: enigo 0.6.1
- Purpose: Keyboard event injection for paste operations and global shortcuts
- Platform support: Windows (VK codes), macOS (Key codes), Linux (Unicode input)

**System Tray:**
- Provider: Tauri 2.9.1 built-in tray-icon feature
- Implementation: `src-tauri/src/tray.rs`
- Functions: Show/hide main window, access settings, check for updates, exit application
- Start behavior: Application launches hidden to tray (configurable)

**Audio System Integration:**
- Provider: cpal 0.16.0 (cross-platform audio I/O)
- Implementation: `src-tauri/src/audio_toolkit/audio/`
- Features:
  - Enumerate input devices (microphones)
  - Enumerate output devices (speakers)
  - Record audio from selected microphone
  - Play feedback sounds via rodio
- Device enumeration: `src-tauri/src/audio_toolkit/audio/device.rs`
- Recording: `src-tauri/src/audio_toolkit/audio/recorder.rs`
- Resampling: `src-tauri/src/audio_toolkit/audio/resampler.rs` - Convert between sample rates

**Overlay Window:**
- Type: Transparent semi-transparent window showing transcription in progress
- Implementation: `src-tauri/src/overlay.rs`
- Frontend: `src/overlay/`
- Renderer: Separate Vite entry point building to `overlay/index.html`
- Purpose: Real-time visual feedback during recording/transcription

**Accessibility Permissions (macOS):**
- Provider: `tauri-plugin-macos-permissions-api` 2.3.0
- Requirements: User must grant accessibility permissions for global shortcuts and input simulation
- Implementation: Permission requests at startup if needed

**Auto-Start on System Boot:**
- Provider: `@tauri-apps/plugin-autostart`
- Implementation: Configurable via settings
- Platform-specific launcher: MacOS uses `MacosLauncher` for proper integration

## Monitoring & Observability

**Error Tracking:**
- Type: Local application logging only
- Framework: `env_logger` 0.11.6 (environment-based configuration)
- Logging facade: `log` 0.4.25
- Level control: Via `RUST_LOG` environment variable
- No remote error reporting or crash analytics

**Logs:**
- Method: Console and standard output logging
- Scope: Audio operations, model loading, transcription pipeline, database operations
- Retention: Transient (in-memory); not persisted to files
- Debug features: Debug mode can be toggled at runtime to enable additional logging

## CI/CD & Deployment

**Hosting/Distribution:**
- Method: GitHub Releases (self-hosted distribution)
- Repository: https://github.com/hmseeb/leadrscribe

**Auto-Update System:**
- Provider: `@tauri-apps/plugin-updater` 2.9.0
- Update endpoint: `https://github.com/hmseeb/leadrscribe/releases/latest/download/latest.json`
- Signature verification: Public key configured in `src-tauri/tauri.conf.json`
- Key format: minisign format (base64 encoded)
- Artifacts: Updater creates and verifies signed release bundles

**CI Pipeline:**
- Type: None detected in codebase
- Build process: Manual via `bun run tauri build` and GitHub CLI

**Package Distribution:**
- Formats: Configured for all platforms (Windows, macOS, Linux)
- Windows: `.msi` and portable executable
- macOS: `.dmg` with code signing (identity: "-" for self-signed in development)
- Linux: AppImage and RPM with bundled media frameworks

## Environment Configuration

**Required Environment Variables:**
- `TAURI_DEV_HOST` (optional) - Remote dev server hostname for HMR
- `RUST_LOG` (optional) - Logging level configuration
- Build-time: No external secrets or API keys required

**Secrets Location:**
- Application secrets: No remote API keys or credentials in codebase
- Model downloads: Public URLs (no authentication)
- Clipboard operations: System-level access only
- Updater key: Public minisign key in config (not sensitive)

**Configuration Files:**
- `src-tauri/tauri.conf.json` - App identity, updater endpoints, security policies
- Settings persistence: Handled via Tauri store plugin
- No external configuration servers or remote config services

## Webhooks & Callbacks

**Incoming:**
- Type: None (application is not a server)
- Single-instance enforcement prevents multiple processes handling requests

**Outgoing:**
- Type: None to external services
- Local: IPC events between Tauri backend and React frontend
  - Event: `check-for-updates` (update check trigger)
  - Event: `show-notification` (toast notifications from backend)
  - Event: `transcription-complete` (transcription results)
  - Event: `model-loading` (model state changes)

## Model Downloads & Versioning

**Model Management:**
- Hosted on: blob.handy.computer
- Download method: HTTP with range request support for resumable downloads
- Progress tracking: `DownloadProgress` events sent to frontend
- Storage: `{app_data}/models/` with version metadata
- Supported engines:
  - Whisper (Small, Medium, Turbo, Large)
  - Parakeet (V2, V3)
- Model format: GGML binary files or tar.gz archives

**Required Model Files:**
- VAD model: `silero_vad_v4.onnx` (bundled in `src-tauri/resources/models/`)
- Must be downloaded manually on first setup via CLI command (documented in CLAUDE.md)

---

*Integration audit: 2026-02-04*
