# Technology Stack

**Analysis Date:** 2026-02-04

## Languages

**Primary:**
- Rust 2021 edition - Backend application (speech recognition, audio processing, system integration)
- TypeScript ~5.6.3 - Frontend UI and Tauri IPC communication
- HTML5/CSS - UI templates and styling

**Secondary:**
- JavaScript - Build scripts and configuration

## Runtime

**Environment:**
- Tauri 2.9.1 - Cross-platform desktop application framework (Rust backend + Web frontend)
- Node.js (via Bun) - Frontend build and development

**Package Manager:**
- Bun - Primary package manager for npm dependencies
- Cargo - Rust package manager
- Lockfile: `package-lock.json` and `Cargo.lock` (both present)

## Frameworks

**Desktop Application:**
- Tauri 2.9.1 - Desktop app framework with system tray, IPC, and native bindings

**Frontend UI:**
- React 18.3.1 - Component framework
- Vite 6.4.1 - Build tool and dev server (port 1420)
- Tailwind CSS 4.1.16 - Utility-first CSS framework
- Radix UI (collection of headless components):
  - Dialog, Dropdown Menu, Label, Popover, Progress, Scroll Area, Select, Separator, Slider, Slot, Switch, Tabs, Tooltip

**UI Libraries:**
- Framer Motion 12.23.24 - Animation library
- Lucide React 0.542.0 - Icon library
- Sonner 2.0.7 - Toast notification system
- Zod 3.25.76 - TypeScript-first schema validation

**State Management:**
- Zustand 5.0.8 - Lightweight state management store

**Styling Utilities:**
- Tailwind Merge 3.4.0 - Merge Tailwind classes
- Class Variance Authority 0.7.1 - CSS-in-JS variant handling
- Clsx 2.1.1 - Utility for constructing className strings

**Tauri Plugins (Frontend):**
- @tauri-apps/api 2.9.0 - Core API for IPC and system integration
- @tauri-apps/plugin-autostart ~2.5.1 - Auto-start application on system boot
- @tauri-apps/plugin-clipboard-manager ~2.3.2 - Clipboard read/write operations
- @tauri-apps/plugin-fs ~2.4.4 - File system operations
- @tauri-apps/plugin-global-shortcut ~2.3.1 - Global keyboard shortcuts
- @tauri-apps/plugin-opener ^2.5.2 - Open files and URLs
- @tauri-apps/plugin-os ~2.3.2 - OS information and utilities
- @tauri-apps/plugin-process ~2.3.1 - Process management
- @tauri-apps/plugin-sql ~2.3.1 - SQLite database
- @tauri-apps/plugin-store ~2.4.1 - Persistent key-value store (settings)
- @tauri-apps/plugin-updater ~2.9.0 - Application auto-updater

**macOS-Specific:**
- tauri-plugin-macos-permissions-api 2.3.0 - Accessibility permissions (required for global shortcuts and input simulation)

## Key Dependencies

**Critical (Rust Backend):**
- `transcribe-rs` 0.1.4 - CPU-optimized speech recognition engine (Whisper and Parakeet models)
- `cpal` 0.16.0 - Cross-platform audio input/output (audio recording and device enumeration)
- `vad-rs` (git: rustdesk-org/vad-rs) - Voice Activity Detection using Silero VAD model
- `reqwest` 0.11.27 - HTTP client for model downloads with streaming support
- `rodio` (git: cjpais/rodio.git) - Audio playback for feedback sounds
- `rdev` (git: rustdesk-org/rdev) - Global keyboard shortcuts
- `enigo` 0.6.1 - Virtual input simulation (text input, keyboard keys)
- `rubato` 0.16.2 - Audio resampling engine

**Data & Storage:**
- `rusqlite` 0.32.1 (bundled) - SQLite bindings for history database
- `tauri-plugin-sql` 2.3.1 - Tauri's SQLite integration
- `tauri-plugin-store` 2.4.1 - Key-value store for settings persistence

**Serialization & Configuration:**
- `serde` 1.0 (with derive) - Serialization framework
- `serde_json` 1.0 - JSON serialization
- `chrono` 0.4 - Date and time handling

**Audio Processing:**
- `hound` 3.5.1 - WAV file reading/writing
- `tar` 0.4.44 - TAR archive extraction (for Parakeet models)
- `flate2` 1.0 - GZIP compression
- `rustfft` 6.4.0 - FFT audio analysis
- `cpvc` 0.4.1 - Codec utilities

**Text Processing:**
- `strsim` 0.11.0 - String similarity algorithms
- `natural` 0.5.0 - Natural language processing

**Tauri Plugins (Rust Backend):**
- `tauri-plugin-opener` 2.5.2 - Open files/URLs
- `tauri-plugin-clipboard-manager` 2.3.2 - Clipboard operations
- `tauri-plugin-os` 2.3.2 - OS information
- `tauri-plugin-process` 2.3.1 - Process management
- `tauri-plugin-macos-permissions` 2.3.0 - macOS accessibility permissions
- `tauri-plugin-autostart` 2.5.1 - System autostart
- `tauri-plugin-global-shortcut` 2.3.1 - Global keyboard shortcuts
- `tauri-plugin-single-instance` 2.3.2 - Single instance enforcement
- `tauri-plugin-updater` 2.9.0 - Auto-update mechanism

**macOS Integration:**
- `tauri` 2.9.1 features: macos-private-api (system tray and activation policy control)

**Utilities:**
- `log` 0.4.25 - Logging facade
- `env_logger` 0.11.6 - Environment-based logging configuration
- `tokio` 1.43.0 - Async runtime
- `anyhow` 1.0.95 - Error handling
- `futures-util` 0.3 - Async utilities
- `once_cell` 1.0 - Lazy static initialization

## Configuration

**Frontend (TypeScript):**
- `tsconfig.json`: ES2020 target, strict mode enabled, module resolution via bundler
- `vite.config.ts`: Multiple entry points (main + overlay window), Tailwind CSS integration, fixed port 1420
- Environment variable: `TAURI_DEV_HOST` for remote development HMR

**Backend (Rust):**
- `Cargo.toml`: Edition 2021, release profile with LTO and code generation optimization
- Platform-specific dependencies using `cfg(target_os)` for macOS/Windows/Linux features

**Build System:**
- `beforeDevCommand`: `bun run dev` (Vite dev server)
- `beforeBuildCommand`: `bun run build` (TypeScript + Vite build)
- `frontendDist`: Points to `../dist` directory

**Application Identity:**
- Product Name: LeadrScribe
- Identifier: com.leadr.leadrscribe
- Version: 0.5.16 (synchronized across package.json, Cargo.toml, tauri.conf.json)

## Build & Development

**Development Server:**
- Vite dev server on port 1420 with strict port enforcement
- HMR (Hot Module Replacement) with WebSocket when remote development is needed

**Build Output:**
- Frontend: Built to `dist/` directory
- Tauri bundles: All platforms (macOS, Windows, Linux)

**Build Optimization (Release):**
- Link-Time Optimization (LTO): enabled
- Code generation units: 1 (slower compile, smaller/faster binary)
- Strip: enabled (remove debug symbols)
- Panic strategy: abort (smaller binary)

## Platform Requirements

**Development:**
- Rust: Latest stable (2021 edition)
- Bun: Latest version
- CMake: 3.5+ (for macOS Whisper compilation)
- Node.js: Compatible with Bun
- ONNX Runtime: For Silero VAD model inference

**macOS:**
- Minimum system version: 10.13
- Accessibility permissions required (for global shortcuts and input simulation)
- Metal GPU acceleration available (through whisper-rs)
- Hardened runtime enabled

**Windows:**
- Vulkan support for GPU acceleration (optional)
- Code signing capability required for distribution

**Linux:**
- OpenBLAS support (optional for CPU optimization)
- Vulkan support (optional for GPU acceleration)
- Media frameworks for audio

**Runtime Models:**
- Silero VAD model: `silero_vad_v4.onnx` (bundled in `src-tauri/resources/models/`)
- Whisper models: Downloaded on-demand to `{app_data}/models/` (Small, Medium, Turbo, Large variants)
- Parakeet models: Downloaded on-demand as tar.gz archives

---

*Stack analysis: 2026-02-04*
