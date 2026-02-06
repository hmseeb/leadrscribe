use crate::audio_feedback::{play_feedback_sound, SoundType};
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
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tauri::{AppHandle, Emitter, Listener, Manager};

// Shortcut Action Trait
pub trait ShortcutAction: Send + Sync {
    fn start(&self, app: &AppHandle, binding_id: &str, shortcut_str: &str);
    fn stop(&self, app: &AppHandle, binding_id: &str, shortcut_str: &str);
}

#[derive(Clone)]
struct StreamingState {
    segments: Arc<Mutex<Vec<String>>>,
    segment_count: Arc<Mutex<usize>>,
    pending_segments: Arc<AtomicUsize>,
    is_recording: Arc<Mutex<bool>>,
    audio_buffer: Arc<Mutex<Vec<f32>>>,
}

impl StreamingState {
    fn new() -> Self {
        Self {
            segments: Arc::new(Mutex::new(Vec::new())),
            segment_count: Arc::new(Mutex::new(0)),
            pending_segments: Arc::new(AtomicUsize::new(0)),
            is_recording: Arc::new(Mutex::new(false)),
            audio_buffer: Arc::new(Mutex::new(Vec::new())),
        }
    }

    fn start_recording(&self) {
        *self.is_recording.lock().unwrap() = true;
        self.segments.lock().unwrap().clear();
        *self.segment_count.lock().unwrap() = 0;
        self.pending_segments.store(0, Ordering::Release);
        self.audio_buffer.lock().unwrap().clear();
    }

    fn stop_recording(&self) {
        *self.is_recording.lock().unwrap() = false;
    }

    /// Take any remaining buffered audio (for flushing on stop)
    fn take_buffered_audio(&self) -> Vec<f32> {
        std::mem::take(&mut *self.audio_buffer.lock().unwrap())
    }

    fn next_segment_index(&self) -> usize {
        let mut count = self.segment_count.lock().unwrap();
        let idx = *count;
        *count += 1;
        idx
    }

    fn increment_pending(&self) {
        self.pending_segments.fetch_add(1, Ordering::AcqRel);
    }

    fn decrement_pending(&self) {
        self.pending_segments.fetch_sub(1, Ordering::AcqRel);
    }

    fn pending_count(&self) -> usize {
        self.pending_segments.load(Ordering::Acquire)
    }

    fn add_segment(&self, text: String, index: usize) {
        let mut segments = self.segments.lock().unwrap();
        if segments.len() <= index {
            segments.resize(index + 1, String::new());
        }
        segments[index] = text;
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

        // 3 seconds of audio at 16kHz gives the model enough context for reliable results
        const BATCH_THRESHOLD: usize = 16000 * 3; // 48000 samples = 3 seconds

        app.listen("audio-segment", move |event| {
            if !*STREAMING_STATE.is_recording.lock().unwrap() {
                return;
            }

            if let Ok(segment_event) = serde_json::from_str::<AudioSegmentEvent>(event.payload()) {
                // Accumulate audio samples into shared buffer
                let should_transcribe = {
                    let mut buf = STREAMING_STATE.audio_buffer.lock().unwrap();
                    buf.extend_from_slice(&segment_event.samples);
                    let total = buf.len();
                    println!(
                        "[Streaming] Accumulated {:.1}s / {:.1}s",
                        total as f64 / 16000.0,
                        BATCH_THRESHOLD as f64 / 16000.0
                    );
                    total >= BATCH_THRESHOLD
                };

                if !should_transcribe {
                    return;
                }

                // Take the accumulated audio for transcription
                let batch_samples = STREAMING_STATE.take_buffered_audio();
                let segment_index = STREAMING_STATE.next_segment_index();

                // Backpressure: skip if too many transcriptions pending
                let pending = STREAMING_STATE.pending_count();
                if pending >= 2 {
                    println!("[Streaming] Skipping batch {} - {} pending", segment_index, pending);
                    return;
                }

                println!(
                    "[Streaming] Transcribing batch {} ({:.1}s)...",
                    segment_index,
                    batch_samples.len() as f64 / 16000.0
                );

                STREAMING_STATE.increment_pending();
                let tm = tm_clone.clone();
                let app_for_display = app_clone.clone();

                std::thread::spawn(move || {
                    match tm.transcribe(batch_samples) {
                        Ok(text) if !text.is_empty() => {
                            println!("[Streaming] Batch {} transcribed: '{}'", segment_index, text);
                            STREAMING_STATE.add_segment(text.clone(), segment_index);

                            if let Some(window) = app_for_display.get_webview_window("recording_overlay") {
                                let escaped = text.replace('\\', "\\\\").replace('\'', "\\'").replace('\n', "\\n");
                                let _ = window.eval(&format!(
                                    "document.dispatchEvent(new CustomEvent('td-partial', {{ detail: {{ text: '{}', chunk_index: {} }} }}))",
                                    escaped, segment_index
                                ));
                            }
                        }
                        Ok(_) => println!("[Streaming] Batch {} was empty", segment_index),
                        Err(e) => println!("[Streaming] Batch {} failed: {}", segment_index, e),
                    }
                    STREAMING_STATE.decrement_pending();
                });
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

        // Load model and keep it loaded during recording for streaming
        let tm = app.state::<Arc<TranscriptionManager>>();
        tm.set_suppress_unload(true);
        tm.initiate_model_load();

        let binding_id = binding_id.to_string();
        change_tray_icon(app, TrayIconState::Recording);
        show_recording_overlay(app);

        // Show streaming text in recording overlay
        if let Some(window) = app.get_webview_window("recording_overlay") {
            let _ = window.eval("document.dispatchEvent(new CustomEvent('td-show'))");
        }

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

        // Flush any remaining buffered audio for streaming display
        let remaining_audio = STREAMING_STATE.take_buffered_audio();
        if remaining_audio.len() >= 8000 { // At least 0.5s to avoid hallucinations
            let segment_index = STREAMING_STATE.next_segment_index();
            let tm_flush = app.state::<Arc<TranscriptionManager>>().inner().clone();
            let app_flush = app.clone();
            println!(
                "[Streaming] Flushing remaining {:.1}s of buffered audio...",
                remaining_audio.len() as f64 / 16000.0
            );
            std::thread::spawn(move || {
                match tm_flush.transcribe(remaining_audio) {
                    Ok(text) if !text.is_empty() => {
                        println!("[Streaming] Flush transcribed: '{}'", text);
                        STREAMING_STATE.add_segment(text.clone(), segment_index);
                        if let Some(window) = app_flush.get_webview_window("recording_overlay") {
                            let escaped = text.replace('\\', "\\\\").replace('\'', "\\'").replace('\n', "\\n");
                            let _ = window.eval(&format!(
                                "document.dispatchEvent(new CustomEvent('td-partial', {{ detail: {{ text: '{}', chunk_index: {} }} }}))",
                                escaped, segment_index
                            ));
                        }
                    }
                    Ok(_) => println!("[Streaming] Flush was empty"),
                    Err(e) => println!("[Streaming] Flush failed: {}", e),
                }
            });
        }

        // Allow model unload again (after final transcription completes)
        let tm_for_unload = app.state::<Arc<TranscriptionManager>>();
        tm_for_unload.set_suppress_unload(false);

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

                // Transcribe full audio directly (faster than streaming mode which
                // processes segments sequentially due to engine mutex lock)
                let transcription = match tm.transcribe(samples) {
                    Ok(t) => {
                        debug!("Transcription result: '{}'", t);
                        t
                    }
                    Err(err) => {
                        debug!("Transcription error: {}", err);
                        if let Some(window) = ah.get_webview_window("recording_overlay") {
                            let _ = window.eval("document.dispatchEvent(new CustomEvent('td-hide'))");
                        }
                        utils::hide_recording_overlay(&ah);
                        change_tray_icon(&ah, TrayIconState::Idle);
                        return;
                    }
                };

                if !transcription.is_empty() {
                    // Apply ghostwriting if enabled
                    let settings = get_settings(&ah);
                    debug!(
                        "Output mode: {:?}, Checking if ghostwriting should run",
                        settings.output_mode
                    );
                    let (final_text, ghostwritten_text) = if settings.output_mode
                        == OutputMode::Ghostwriter
                    {
                        debug!("Ghostwriter mode enabled, processing transcription");

                        // Update overlay to show "Ghostwriting..." now that transcription is done
                        if let Some(overlay_window) = ah.get_webview_window("recording_overlay") {
                            let _ = overlay_window.emit("show-overlay", "ghostwriting");
                        }

                        // Get active profile's custom instructions if available
                        // Skip if "None" profile (ID 1) is selected
                        let profile_instructions = if let Some(profile_id) =
                            settings.active_profile_id
                        {
                            if profile_id == 1 {
                                debug!("'None' profile selected - skipping profile instructions");
                                None
                            } else {
                                use crate::managers::profile::ProfileManager;
                                match ProfileManager::new(&ah) {
                                    Ok(pm) => match pm.get_profile(profile_id).await {
                                        Ok(Some(profile)) => {
                                            debug!(
                                                "Using profile '{}' custom instructions",
                                                profile.name
                                            );
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
                                    },
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
                                debug!(
                                    "Ghostwriting successful. Original: '{}', Ghostwritten: '{}'",
                                    transcription, ghostwritten
                                );
                                (ghostwritten.clone(), Some(ghostwritten))
                            }
                            Err(e) => {
                                error!("Ghostwriting failed, using original transcription: {}", e);

                                // Emit error event to overlay for immediate feedback
                                if let Some(overlay_window) =
                                    ah.get_webview_window("recording_overlay")
                                {
                                    let error_message = e.to_string();
                                    let _ = overlay_window.emit("ghostwriter-error", error_message);
                                }

                                // Emit notification event to main window for persistent alert
                                if let Some(main_window) = ah.get_webview_window("main") {
                                    let notification_data = serde_json::json!({
                                        "title": "Ghostwriter Failed",
                                        "message": format!("{}\n\nOriginal transcription was pasted instead.\n\nPlease check your OpenRouter config in settings.", e),
                                        "type": "error"
                                    });
                                    let _ =
                                        main_window.emit("show-notification", notification_data);
                                }

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

                    // Send final result to recording overlay via eval
                    if let Some(window) = ah.get_webview_window("recording_overlay") {
                        let escaped = final_text.replace('\\', "\\\\").replace('\'', "\\'").replace('\n', "\\n");
                        let _ = window.eval(&format!(
                            "document.dispatchEvent(new CustomEvent('td-final', {{ detail: {{ text: '{}' }} }}))",
                            escaped
                        ));
                    }

                    let transcription_clone = final_text.clone();
                    let ah_clone = ah.clone();
                    let paste_time = Instant::now();
                    ah.run_on_main_thread(move || {
                        // Hide the overlay BEFORE pasting to prevent it from stealing focus
                        if let Some(window) = ah_clone.get_webview_window("recording_overlay") {
                            let _ = window.eval("document.dispatchEvent(new CustomEvent('td-hide'))");
                        }
                        utils::hide_recording_overlay(&ah_clone);

                        // Small delay to ensure overlay is fully hidden before pasting
                        std::thread::sleep(std::time::Duration::from_millis(50));

                        debug!("Pasting text on main thread: '{}'", transcription_clone);
                        match utils::paste(transcription_clone, ah_clone.clone()) {
                            Ok(()) => {
                                debug!("Text pasted successfully in {:?}", paste_time.elapsed())
                            }
                            Err(e) => eprintln!("Failed to paste transcription: {}", e),
                        }
                        change_tray_icon(&ah_clone, TrayIconState::Idle);
                    })
                    .unwrap_or_else(|e| {
                        eprintln!("Failed to run paste on main thread: {:?}", e);
                        if let Some(window) = ah.get_webview_window("recording_overlay") {
                            let _ = window.eval("document.dispatchEvent(new CustomEvent('td-hide'))");
                        }
                        utils::hide_recording_overlay(&ah);
                        change_tray_icon(&ah, TrayIconState::Idle);
                    });
                } else {
                    if let Some(window) = ah.get_webview_window("recording_overlay") {
                        let _ = window.eval("document.dispatchEvent(new CustomEvent('td-hide'))");
                    }
                    utils::hide_recording_overlay(&ah);
                    change_tray_icon(&ah, TrayIconState::Idle);
                }
            } else {
                debug!("No samples retrieved from recording stop");
                if let Some(window) = ah.get_webview_window("recording_overlay") {
                    let _ = window.eval("document.dispatchEvent(new CustomEvent('td-hide'))");
                }
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
