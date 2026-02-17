use crate::audio_toolkit::{list_input_devices, vad::SmoothedVad, AudioRecorder, SileroVad};
use crate::cpu_features;
use crate::settings::get_settings;
use crate::utils;
use log::{debug, error, info};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tauri::{Emitter, Manager};

const WHISPER_SAMPLE_RATE: usize = 16000;

/* ──────────────────────────────────────────────────────────────── */

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AudioSegmentEvent {
    pub samples: Vec<f32>,
}

#[derive(Clone, Debug)]
pub enum RecordingState {
    Idle,
    Recording { binding_id: String },
}

#[derive(Clone, Debug)]
pub enum MicrophoneMode {
    AlwaysOn,
    OnDemand,
}

/* ──────────────────────────────────────────────────────────────── */

struct RecordingInner {
    state: RecordingState,
    mode: MicrophoneMode,
    recorder: Option<AudioRecorder>,
    is_open: bool,
    is_recording: bool,
    initial_volume: Option<u8>,
}

/* ──────────────────────────────────────────────────────────────── */

fn create_audio_recorder(
    vad_path: &str,
    app_handle: &tauri::AppHandle,
) -> Result<AudioRecorder, anyhow::Error> {
    let silero = SileroVad::new(vad_path, 0.3)
        .map_err(|e| anyhow::anyhow!("Failed to create SileroVad: {}", e))?;
    let smoothed_vad = SmoothedVad::new(Box::new(silero), 15, 15, 2);

    // Recorder with VAD plus callbacks for level and segment streaming
    let recorder = AudioRecorder::new()
        .map_err(|e| anyhow::anyhow!("Failed to create AudioRecorder: {}", e))?
        .with_vad(Box::new(smoothed_vad))
        .with_level_callback({
            let app_handle = app_handle.clone();
            move |levels| {
                utils::emit_levels(&app_handle, &levels);
            }
        })
        .with_segment_callback({
            let app_handle = app_handle.clone();
            move |samples| {
                debug!("Audio segment detected: samples={}", samples.len());

                // Emit segment event for processing
                let _ = app_handle.emit("audio-segment", AudioSegmentEvent {
                    samples,
                });
            }
        });

    Ok(recorder)
}

/* ──────────────────────────────────────────────────────────────── */

#[derive(Clone)]
pub struct AudioRecordingManager {
    inner: Arc<Mutex<RecordingInner>>,
    app_handle: tauri::AppHandle,
}

impl AudioRecordingManager {
    /* ---------- construction ------------------------------------------------ */

    pub fn new(app: &tauri::AppHandle) -> Result<Self, anyhow::Error> {
        let settings = get_settings(app);
        let mode = if settings.always_on_microphone {
            MicrophoneMode::AlwaysOn
        } else {
            MicrophoneMode::OnDemand
        };

        let manager = Self {
            inner: Arc::new(Mutex::new(RecordingInner {
                state: RecordingState::Idle,
                mode: mode.clone(),
                recorder: None,
                is_open: false,
                is_recording: false,
                initial_volume: None,
            })),
            app_handle: app.clone(),
        };

        // Always-on?  Open immediately.
        if matches!(mode, MicrophoneMode::AlwaysOn) {
            manager.start_microphone_stream()?;
        }

        Ok(manager)
    }

    /* ---------- microphone life-cycle -------------------------------------- */

    pub fn start_microphone_stream(&self) -> Result<(), anyhow::Error> {
        let mut inner = self.inner.lock().unwrap();
        if inner.is_open {
            debug!("Microphone stream already active");
            return Ok(());
        }

        let start_time = Instant::now();

        let settings = get_settings(&self.app_handle);

        if settings.mute_while_recording {
            inner.initial_volume = Some(cpvc::get_system_volume());
            cpvc::set_system_volume(0);
        } else {
            inner.initial_volume = None;
        }

        // Check CPU capabilities before initializing VAD (which uses ONNX Runtime)
        // ONNX Runtime requires AVX2 instructions - without them, the process crashes
        if !cpu_features::supports_parakeet() {
            let _ = self.app_handle.emit("cpu-incompatible-vad", ());
            return Err(anyhow::anyhow!(
                "Your CPU does not support the required AVX2 instructions for voice activity detection. \
                 LeadrScribe requires a CPU with AVX2 support (most processors from 2013 or later)."
            ));
        }

        let vad_path = self
            .app_handle
            .path()
            .resolve(
                "resources/models/silero_vad_v4.onnx",
                tauri::path::BaseDirectory::Resource,
            )
            .map_err(|e| anyhow::anyhow!("Failed to resolve VAD path: {}", e))?;

        if inner.recorder.is_none() {
            let vad_path_str = vad_path
                .to_str()
                .ok_or_else(|| anyhow::anyhow!("VAD path contains invalid UTF-8 characters"))?;
            inner.recorder = Some(create_audio_recorder(vad_path_str, &self.app_handle)?);
        }

        // Get the selected device from settings
        let settings = get_settings(&self.app_handle);
        let selected_device = if let Some(device_name) = settings.selected_microphone {
            // Find the device by name
            match list_input_devices() {
                Ok(devices) => devices
                    .into_iter()
                    .find(|d| d.name == device_name)
                    .map(|d| d.device),
                Err(e) => {
                    debug!("Failed to list devices, using default: {}", e);
                    None
                }
            }
        } else {
            None
        };

        if let Some(rec) = inner.recorder.as_mut() {
            rec.open(selected_device)
                .map_err(|e| anyhow::anyhow!("Failed to open recorder: {}", e))?;
        }

        inner.is_open = true;
        info!(
            "Microphone stream initialized in {:?}",
            start_time.elapsed()
        );
        Ok(())
    }

    pub fn stop_microphone_stream(&self) {
        let mut inner = self.inner.lock().unwrap();
        if !inner.is_open {
            return;
        }

        if let Some(vol) = inner.initial_volume {
            cpvc::set_system_volume(vol);
        }
        inner.initial_volume = None;

        // Stop recording if active and close the recorder
        let was_recording = inner.is_recording;
        if was_recording {
            if let Some(rec) = inner.recorder.as_mut() {
                let _ = rec.stop();
            }
            inner.is_recording = false;
        }

        if let Some(rec) = inner.recorder.as_mut() {
            let _ = rec.close();
        }

        inner.is_open = false;
        debug!("Microphone stream stopped");
    }

    /* ---------- mode switching --------------------------------------------- */

    pub fn update_mode(&self, new_mode: MicrophoneMode) -> Result<(), anyhow::Error> {
        let inner = self.inner.lock().unwrap();
        let cur_mode = inner.mode.clone();
        let is_idle = matches!(inner.state, RecordingState::Idle);
        drop(inner);

        match (cur_mode, &new_mode) {
            (MicrophoneMode::AlwaysOn, MicrophoneMode::OnDemand) => {
                if is_idle {
                    self.stop_microphone_stream();
                }
            }
            (MicrophoneMode::OnDemand, MicrophoneMode::AlwaysOn) => {
                self.start_microphone_stream()?;
            }
            _ => {}
        }

        self.inner.lock().unwrap().mode = new_mode;
        Ok(())
    }

    /* ---------- recording --------------------------------------------------- */

    pub fn try_start_recording(&self, binding_id: &str) -> bool {
        let mut inner = self.inner.lock().unwrap();

        if !matches!(inner.state, RecordingState::Idle) {
            return false;
        }

        // Ensure microphone is open in on-demand mode
        if matches!(inner.mode, MicrophoneMode::OnDemand) {
            // Need to drop lock before calling start_microphone_stream which also locks
            drop(inner);
            if let Err(e) = self.start_microphone_stream() {
                error!("Failed to open microphone stream: {e}");
                return false;
            }
            inner = self.inner.lock().unwrap();
        }

        if let Some(rec) = inner.recorder.as_ref() {
            if rec.start().is_ok() {
                inner.is_recording = true;
                inner.state = RecordingState::Recording {
                    binding_id: binding_id.to_string(),
                };
                debug!("Recording started for binding {binding_id}");
                return true;
            }
        }
        error!("Recorder not available");
        false
    }

    pub fn update_selected_device(&self) -> Result<(), anyhow::Error> {
        // If currently open, restart the microphone stream to use the new device
        if self.inner.lock().unwrap().is_open {
            self.stop_microphone_stream();
            self.start_microphone_stream()?;
        }
        Ok(())
    }

    pub fn stop_recording(&self, binding_id: &str) -> Option<Vec<f32>> {
        let mut inner = self.inner.lock().unwrap();

        match &inner.state {
            RecordingState::Recording { binding_id: active } if active == binding_id => {
                inner.state = RecordingState::Idle;

                let samples = if let Some(rec) = inner.recorder.as_ref() {
                    match rec.stop() {
                        Ok(buf) => buf,
                        Err(e) => {
                            error!("stop() failed: {e}");
                            Vec::new()
                        }
                    }
                } else {
                    error!("Recorder not available");
                    Vec::new()
                };

                inner.is_recording = false;

                // In on-demand mode turn the mic off again
                let should_close = matches!(inner.mode, MicrophoneMode::OnDemand);
                drop(inner);

                if should_close {
                    self.stop_microphone_stream();
                }

                // Pad if very short
                let s_len = samples.len();
                if s_len < WHISPER_SAMPLE_RATE && s_len > 0 {
                    let mut padded = samples;
                    padded.resize(WHISPER_SAMPLE_RATE * 5 / 4, 0.0);
                    Some(padded)
                } else {
                    Some(samples)
                }
            }
            _ => None,
        }
    }

    /// Cancel any ongoing recording without returning audio samples
    pub fn cancel_recording(&self) {
        let mut inner = self.inner.lock().unwrap();

        if let RecordingState::Recording { .. } = inner.state {
            inner.state = RecordingState::Idle;

            if let Some(rec) = inner.recorder.as_ref() {
                let _ = rec.stop(); // Discard the result
            }

            inner.is_recording = false;

            // In on-demand mode turn the mic off again
            let should_close = matches!(inner.mode, MicrophoneMode::OnDemand);
            drop(inner);

            if should_close {
                self.stop_microphone_stream();
            }
        }
    }
}
