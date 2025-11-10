# LeadrScribe

**A free, open source, and extensible speech-to-text application that works completely offline.**

LeadrScribe is a cross-platform desktop application built with Tauri (Rust + React/TypeScript) that provides simple, privacy-focused speech transcription. Press a shortcut, speak, and have your words appear in any text field—all without sending your voice to the cloud.

## Why LeadrScribe?

LeadrScribe was created to fill the gap for a truly open source, extensible speech-to-text tool. As stated on [leadrscribe.vercel.app](https://leadrscribe.vercel.app):

- **Free**: Accessibility tooling belongs in everyone's hands, not behind a paywall
- **Open Source**: Together we can build further. Extend LeadrScribe for yourself and contribute to something bigger
- **Private**: Your voice stays on your computer. Get transcriptions without sending audio to the cloud
- **Simple**: One tool, one job. Transcribe what you say and put it into a text box

LeadrScribe isn't trying to be the best speech-to-text app—it's trying to be the most forkable one.

## How It Works

1. **Press** a configurable keyboard shortcut to start/stop recording (or use push-to-talk mode)
2. **Speak** your words while the shortcut is active
3. **Release** and LeadrScribe processes your speech using Whisper
4. **Get** your transcribed text pasted directly into whatever app you're using

The process is entirely local:
- Silence is filtered using VAD (Voice Activity Detection) with Silero
- Transcription uses your choice of models:
  - **Whisper models** (Small/Medium/Turbo/Large) with GPU acceleration when available
  - **Parakeet V3** - CPU-optimized model with excellent performance and automatic language detection
- Works on Windows, macOS, and Linux

## Quick Start

### Installation

1. Download the latest release from the [releases page](https://github.com/hmseeb/leadrscribe/releases) or the [website](https://leadrscribe.vercel.app)
2. Install the application following platform-specific instructions
3. Launch LeadrScribe and grant necessary system permissions (microphone, accessibility)
4. Configure your preferred keyboard shortcuts in Settings
5. Start transcribing!

### Development Setup

For detailed build instructions including platform-specific requirements, see [BUILD.md](BUILD.md).

## Architecture

LeadrScribe is built as a Tauri application combining:

- **Frontend**: React + TypeScript with Tailwind CSS for the settings UI
- **Backend**: Rust for system integration, audio processing, and ML inference
- **Core Libraries**:
  - `whisper-rs`: Local speech recognition with Whisper models
  - `transcription-rs`: CPU-optimized speech recognition with Parakeet models
  - `cpal`: Cross-platform audio I/O
  - `vad-rs`: Voice Activity Detection
  - `rdev`: Global keyboard shortcuts and system events
  - `rubato`: Audio resampling

### Debug Mode

LeadrScribe includes an advanced debug mode for development and troubleshooting. Access it by pressing:
- **macOS**: `Cmd+Shift+D`
- **Windows/Linux**: `Ctrl+Shift+D`

## Known Issues & Current Limitations

This project is actively being developed and has some [known issues](https://github.com/hmseeb/leadrscribe/issues). We believe in transparency about the current state:

### Platform Support
- **macOS (both Intel and Apple Silicon)**
- **x64 Windows**
- **x64 Linux**

### System Requirements/Recommendations

The following are recommendations for running LeadrScribe on your own machine. If you don't meet the system requirements, the performance of the application may be degraded. We are working on improving the performance across all kinds of computers and hardware.

**For Whisper Models:**
- **macOS**: M series Mac, Intel Mac
- **Windows**: Intel, AMD, or NVIDIA GPU
- **Linux**: Intel, AMD, or NVIDIA GPU
  * Ubuntu 22.04, 24.04

**For Parakeet V3 Model:**
- **CPU-only operation** - runs on a wide variety of hardware
- **Minimum**: Intel Skylake (6th gen) or equivalent AMD processors
- **Performance**: ~5x real-time speed on mid-range hardware (tested on i5)
- **Automatic language detection** - no manual language selection required

### How to Contribute

1. **Check existing issues** at [github.com/hmseeb/leadrscribe/issues](https://github.com/hmseeb/leadrscribe/issues)
2. **Fork the repository** and create a feature branch
3. **Test thoroughly** on your target platform
4. **Submit a pull request** with clear description of changes
5. **Join the discussion** - reach out at [contact@leadrscribe.vercel.app](mailto:contact@leadrscribe.vercel.app)

The goal is to create both a useful tool and a foundation for others to build upon—a well-patterned, simple codebase that serves the community.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- **Whisper** by OpenAI for the speech recognition model
- **whisper.cpp and ggml** for amazing cross-platform whisper inference/acceleration
- **Silero** for great lightweight VAD
- **Tauri** team for the excellent Rust-based app framework
- **Community contributors** helping make LeadrScribe better

---

*"Your search for the right speech-to-text tool can end here—not because LeadrScribe is perfect, but because you can make it perfect for you."*
