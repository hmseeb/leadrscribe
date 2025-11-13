use crate::audio_feedback::{SoundType, play_feedback_sound};
use crate::ghostwriter;
use crate::managers::audio::{AudioRecordingManager, AudioSegmentEvent};
use crate::managers::history::HistoryManager;
use crate::managers::transcription::TranscriptionManager;
use crate::overlay::show_recording_overlay;
use crate::settings::{get_settings, OutputMode};
use crate::tray::{change_tray_icon, TrayIconState};
use crate::utils;
use log::{debug, error};
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tauri::{AppHandle, Emitter, Listener, Manager};

// Shortcut Action Trait
pub trait ShortcutAction: Send + Sync {
    fn start(&self, app: &AppHandle, binding_id: &str, shortcut_str: &str);
    fn stop(&self, app: &AppHandle, binding_id: &str, shortcut_str: &str);
}

// Structure to hold streaming transcription state
#[derive(Clone)]
struct StreamingState {
    segments: Arc<Mutex<Vec<String>>>,
    segment_count: Arc<Mutex<usize>>,
    is_recording: Arc<Mutex<bool>>,
}

impl StreamingState {
    fn new() -> Self {
        Self {
            segments: Arc::new(Mutex::new(Vec::new())),
            segment_count: Arc::new(Mutex::new(0)),
            is_recording: Arc::new(Mutex::new(false)),
        }
    }

    fn start_recording(&self) {
        *self.is_recording.lock().unwrap() = true;
        self.segments.lock().unwrap().clear();
        *self.segment_count.lock().unwrap() = 0;
    }

    fn stop_recording(&self) {
        *self.is_recording.lock().unwrap() = false;
    }

    fn add_segment(&self, text: String, index: usize) {
        let mut segments = self.segments.lock().unwrap();
        // Ensure the vector is large enough
        if segments.len() <= index {
            segments.resize(index + 1, String::new());
        }
        segments[index] = text;
        debug!("Segment {} added: '{}'", index, segments[index]);

        // Emit progress update to frontend
    }

    fn get_accumulated_text(&self) -> String {
        let segments = self.segments.lock().unwrap();
        segments.iter()
            .filter(|s| !s.is_empty())
            .cloned()
            .collect::<Vec<_>>()
            .join(" ")
    }
}

// Global streaming state
static STREAMING_STATE: Lazy<StreamingState> = Lazy::new(StreamingState::new);

// Initialize segment listener once globally
pub fn setup_segment_listener(app: &AppHandle) {
    static LISTENER_INITIALIZED: std::sync::Once = std::sync::Once::new();

    LISTENER_INITIALIZED.call_once(|| {
        let app_clone = app.clone();
        let tm_clone = app.state::<Arc<TranscriptionManager>>().inner().clone();

        app.listen("audio-segment", move |event| {
            if !*STREAMING_STATE.is_recording.lock().unwrap() {
                return; // Ignore segments if not recording
            }

            if let Ok(segment_event) = serde_json::from_str::<AudioSegmentEvent>(event.payload()) {
                debug!("Received audio segment with {} samples", segment_event.samples.len());

                let segment_index = {
                    let mut count = STREAMING_STATE.segment_count.lock().unwrap();
                    let idx = *count;
                    *count += 1;
                    idx
                };

                // Transcribe segment asynchronously
                let tm = tm_clone.clone();
                let app_for_emit = app_clone.clone();
                tm.transcribe_segment_async(
                    segment_event.samples,
                    segment_index,
                    move |index, result| {
                        match result {
                            Ok(text) if !text.is_empty() => {
                                debug!("Segment {} transcribed: '{}'", index, text);
                                STREAMING_STATE.add_segment(text.clone(), index);

                                // Emit progress to frontend for overlay update
                                let accumulated = STREAMING_STATE.get_accumulated_text();
                                let _ = app_for_emit.emit("transcription-progress", accumulated);
                            }
                            Ok(_) => debug!("Segment {} was empty", index),
                            Err(e) => error!("Segment {} transcription failed: {}", index, e),
                        }
                    },
                );
            }
        });

        debug!("Segment listener initialized");
    });
}

// Transcribe Action
struct TranscribeAction;

impl ShortcutAction for TranscribeAction {
    fn start(&self, app: &AppHandle, binding_id: &str, _shortcut_str: &str) {
        let start_time = Instant::now();
        debug!("TranscribeAction::start called for binding: {}", binding_id);

        // Ensure segment listener is initialized (only happens once)
        setup_segment_listener(app);

        // Initialize streaming state
        STREAMING_STATE.start_recording();

        // Load model in the background
        let tm = app.state::<Arc<TranscriptionManager>>();
        tm.initiate_model_load();

        let binding_id = binding_id.to_string();
        change_tray_icon(app, TrayIconState::Recording);
        show_recording_overlay(app);

        let rm = app.state::<Arc<AudioRecordingManager>>();

        // Get the microphone mode to determine audio feedback timing
        let settings = get_settings(app);
        let is_always_on = settings.always_on_microphone;
        debug!("Microphone mode - always_on: {}", is_always_on);

        if is_always_on {
            // Always-on mode: Play audio feedback immediately
            debug!("Always-on mode: Playing audio feedback immediately");
            play_feedback_sound(app, SoundType::Start);
            let recording_started = rm.try_start_recording(&binding_id);
            debug!("Recording started: {}", recording_started);
        } else {
            // On-demand mode: Start recording first, then play audio feedback
            // This allows the microphone to be activated before playing the sound
            debug!("On-demand mode: Starting recording first, then audio feedback");
            let recording_start_time = Instant::now();
            if rm.try_start_recording(&binding_id) {
                debug!("Recording started in {:?}", recording_start_time.elapsed());
                // Small delay to ensure microphone stream is active
                let app_clone = app.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(100));
                    debug!("Playing delayed audio feedback");
                    play_feedback_sound(&app_clone, SoundType::Start);
                });
            } else {
                debug!("Failed to start recording");
            }
        }

        debug!(
            "TranscribeAction::start completed in {:?}",
            start_time.elapsed()
        );
    }

    fn stop(&self, app: &AppHandle, binding_id: &str, _shortcut_str: &str) {
        let stop_time = Instant::now();
        debug!("TranscribeAction::stop called for binding: {}", binding_id);

        // Stop accepting new segments
        STREAMING_STATE.stop_recording();

        let ah = app.clone();
        let rm = Arc::clone(&app.state::<Arc<AudioRecordingManager>>());
        let tm = Arc::clone(&app.state::<Arc<TranscriptionManager>>());
        let hm = Arc::clone(&app.state::<Arc<HistoryManager>>());

        change_tray_icon(app, TrayIconState::Transcribing);
        // Always show "Transcribing..." first, we'll update to "Ghostwriting..." if needed
        crate::overlay::show_recording_overlay(app); // Reset to transcribing state
        if let Some(overlay_window) = app.get_webview_window("recording_overlay") {
            let _ = overlay_window.emit("show-overlay", "transcribing");
        }

        // Play audio feedback for recording stop
        play_feedback_sound(app, SoundType::Stop);

        let binding_id = binding_id.to_string(); // Clone binding_id for the async task

        tauri::async_runtime::spawn(async move {
            let binding_id = binding_id.clone(); // Clone for the inner async task
            debug!(
                "Starting async transcription task for binding: {}",
                binding_id
            );

            let stop_recording_time = Instant::now();
            if let Some(samples) = rm.stop_recording(&binding_id) {
                debug!(
                    "Recording stopped and samples retrieved in {:?}, sample count: {}",
                    stop_recording_time.elapsed(),
                    samples.len()
                );

                // Calculate recording duration from samples (16kHz sample rate)
                const WHISPER_SAMPLE_RATE: f64 = 16000.0;
                let duration_seconds = samples.len() as f64 / WHISPER_SAMPLE_RATE;
                debug!("Recording duration: {:.2}s", duration_seconds);

                let samples_clone = samples.clone(); // Clone for history saving

                // Wait a short time for any remaining segments to finish transcribing
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

                // Get accumulated streaming transcriptions
                let accumulated_text = STREAMING_STATE.get_accumulated_text();

                // Use streaming transcription as primary result if available
                // Only fall back to full transcription if streaming failed or produced insufficient results
                let transcription = if !accumulated_text.is_empty() && accumulated_text.len() >= 3 {
                    debug!("Using streaming transcription result: '{}'", accumulated_text);
                    accumulated_text
                } else {
                    // Fallback: transcribe full audio if streaming didn't produce results
                    debug!("Streaming transcription insufficient, falling back to full transcription");
                    match tm.transcribe(samples) {
                        Ok(t) => {
                            debug!("Full transcription result: '{}'", t);
                            t
                        }
                        Err(err) => {
                            debug!("Global Shortcut Transcription error: {}", err);
                            utils::hide_recording_overlay(&ah);
                            change_tray_icon(&ah, TrayIconState::Idle);
                            return;
                        }
                    }
                };

                if !transcription.is_empty() {
                    // Apply ghostwriting if enabled
                            let settings = get_settings(&ah);
                            debug!("Output mode: {:?}, Checking if ghostwriting should run", settings.output_mode);
                            let (final_text, ghostwritten_text) = if settings.output_mode == OutputMode::Ghostwriter {
                                debug!("Ghostwriter mode enabled, processing transcription");

                                // Update overlay to show "Ghostwriting..." now that transcription is done
                                if let Some(overlay_window) = ah.get_webview_window("recording_overlay") {
                                    let _ = overlay_window.emit("show-overlay", "ghostwriting");
                                }

                                // Get active profile's custom instructions if available
                                // Skip if "None" profile (ID 1) is selected
                                let profile_instructions = if let Some(profile_id) = settings.active_profile_id {
                                    if profile_id == 1 {
                                        debug!("'None' profile selected - skipping profile instructions");
                                        None
                                    } else {
                                        use crate::managers::profile::ProfileManager;
                                        match ProfileManager::new(&ah) {
                                            Ok(pm) => {
                                                match pm.get_profile(profile_id).await {
                                                    Ok(Some(profile)) => {
                                                        debug!("Using profile '{}' custom instructions", profile.name);
                                                        profile.custom_instructions
                                                    }
                                                    Ok(None) => {
                                                        debug!("Active profile ID {} not found", profile_id);
                                                        None
                                                    }
                                                    Err(e) => {
                                                        error!("Failed to get profile: {}", e);
                                                        None
                                                    }
                                                }
                                            }
                                            Err(e) => {
                                                error!("Failed to create ProfileManager: {}", e);
                                                None
                                            }
                                        }
                                    }
                                } else {
                                    debug!("No active profile selected");
                                    None
                                };

                                // Combine global and profile-specific instructions
                                let combined_instructions = match (settings.custom_instructions.as_str(), profile_instructions.as_deref()) {
                                    ("", None) => "Improve grammar, clarity, and professionalism while maintaining the original meaning.".to_string(),
                                    ("", Some(profile_inst)) => profile_inst.to_string(),
                                    (global_inst, None) => global_inst.to_string(),
                                    (global_inst, Some(profile_inst)) => {
                                        format!("{}\n\nAdditional context for this profile:\n{}", global_inst, profile_inst)
                                    }
                                };

                                debug!("Using combined instructions: {}", combined_instructions);

                                match ghostwriter::process_text(
                                    &transcription,
                                    &settings.openrouter_api_key,
                                    &settings.openrouter_model,
                                    &combined_instructions,
                                )
                                .await
                                {
                                    Ok(ghostwritten) => {
                                        debug!("Ghostwriting successful. Original: '{}', Ghostwritten: '{}'", transcription, ghostwritten);
                                        (ghostwritten.clone(), Some(ghostwritten))
                                    }
                                    Err(e) => {
                                        error!("Ghostwriting failed, using original transcription: {}", e);
                                        (transcription.clone(), None)
                                    }
                                }
                            } else {
                                (transcription.clone(), None)
                            };

                            // Save to history with both original and ghostwritten text
                            let hm_clone = Arc::clone(&hm);
                            let transcription_for_history = transcription.clone();
                            tauri::async_runtime::spawn(async move {
                                if let Err(e) = hm_clone
                                    .save_transcription(
                                        samples_clone,
                                        transcription_for_history,
                                        ghostwritten_text,
                                        None, // TODO: Get active profile_id from settings
                                        Some(duration_seconds),
                                    )
                                    .await
                                {
                                    error!("Failed to save transcription to history: {}", e);
                                }
                            });

                            let transcription_clone = final_text.clone();
                            let ah_clone = ah.clone();
                            let paste_time = Instant::now();
                            ah.run_on_main_thread(move || {
                                // Hide the overlay BEFORE pasting to prevent it from stealing focus
                                utils::hide_recording_overlay(&ah_clone);

                                // Small delay to ensure overlay is fully hidden before pasting
                                std::thread::sleep(std::time::Duration::from_millis(50));

                                debug!("Pasting text on main thread: '{}'", transcription_clone);
                                match utils::paste(transcription_clone, ah_clone.clone()) {
                                    Ok(()) => debug!(
                                        "Text pasted successfully in {:?}",
                                        paste_time.elapsed()
                                    ),
                                    Err(e) => eprintln!("Failed to paste transcription: {}", e),
                                }
                                change_tray_icon(&ah_clone, TrayIconState::Idle);
                            })
                            .unwrap_or_else(|e| {
                                eprintln!("Failed to run paste on main thread: {:?}", e);
                                utils::hide_recording_overlay(&ah);
                                change_tray_icon(&ah, TrayIconState::Idle);
                            });
                } else {
                    utils::hide_recording_overlay(&ah);
                    change_tray_icon(&ah, TrayIconState::Idle);
                }
            } else {
                debug!("No samples retrieved from recording stop");
                utils::hide_recording_overlay(&ah);
                change_tray_icon(&ah, TrayIconState::Idle);
            }
        });

        debug!(
            "TranscribeAction::stop completed in {:?}",
            stop_time.elapsed()
        );
    }
}

// Test Action
struct TestAction;

impl ShortcutAction for TestAction {
    fn start(&self, app: &AppHandle, binding_id: &str, shortcut_str: &str) {
        println!(
            "Shortcut ID '{}': Started - {} (App: {})", // Changed "Pressed" to "Started" for consistency
            binding_id,
            shortcut_str,
            app.package_info().name
        );
    }

    fn stop(&self, app: &AppHandle, binding_id: &str, shortcut_str: &str) {
        println!(
            "Shortcut ID '{}': Stopped - {} (App: {})", // Changed "Released" to "Stopped" for consistency
            binding_id,
            shortcut_str,
            app.package_info().name
        );
    }
}

// Static Action Map
pub static ACTION_MAP: Lazy<HashMap<String, Arc<dyn ShortcutAction>>> = Lazy::new(|| {
    let mut map = HashMap::new();
    map.insert(
        "transcribe".to_string(),
        Arc::new(TranscribeAction) as Arc<dyn ShortcutAction>,
    );
    map.insert(
        "test".to_string(),
        Arc::new(TestAction) as Arc<dyn ShortcutAction>,
    );
    map
});
