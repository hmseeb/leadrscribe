use crate::audio_feedback::{play_feedback_sound, SoundType};
use crate::ghostwriter;
use crate::managers::audio::{AudioRecordingManager, AudioSegmentEvent};
use crate::managers::history::HistoryManager;
use crate::managers::transcription::TranscriptionManager;
use crate::overlay::show_recording_overlay;
use crate::settings::{get_openrouter_api_key, get_settings, OutputMode};
use crate::tray::{change_tray_icon, TrayIconState};
use crate::utils;
use log::{debug, error, info};
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tauri::{AppHandle, Emitter, Listener, Manager};

/// Merges two overlapping text segments by detecting shared suffix/prefix.
/// Requires at least 2 matching words to trigger dedup (avoids false positives
/// on common single words like "the", "a", "and").
fn merge_overlapping_text(committed: &str, new_text: &str) -> String {
    if committed.is_empty() {
        return new_text.to_string();
    }
    if new_text.is_empty() {
        return committed.to_string();
    }

    let committed_words: Vec<&str> = committed.split_whitespace().collect();
    let new_words: Vec<&str> = new_text.split_whitespace().collect();

    let max_overlap = committed_words.len().min(new_words.len());
    let mut best_overlap = 0;

    // Find longest suffix of committed that matches prefix of new (case-insensitive)
    // Require at least 2 words to avoid false positives on common words
    for overlap_len in (2..=max_overlap).rev() {
        let committed_suffix = &committed_words[committed_words.len() - overlap_len..];
        let new_prefix = &new_words[..overlap_len];

        let matches = committed_suffix
            .iter()
            .zip(new_prefix.iter())
            .all(|(a, b)| a.to_lowercase() == b.to_lowercase());

        if matches {
            best_overlap = overlap_len;
            break; // Longest match found (iterating from largest to smallest)
        }
    }

    if best_overlap > 0 {
        let remaining = &new_words[best_overlap..];
        if remaining.is_empty() {
            committed.to_string()
        } else {
            format!("{} {}", committed, remaining.join(" "))
        }
    } else {
        format!("{} {}", committed, new_text)
    }
}

// Shortcut Action Trait
pub trait ShortcutAction: Send + Sync {
    fn start(&self, app: &AppHandle, binding_id: &str, shortcut_str: &str);
    fn stop(&self, app: &AppHandle, binding_id: &str, shortcut_str: &str);
}

#[derive(Clone)]
struct StreamingState {
    /// Latest cumulative transcription text
    latest_text: Arc<Mutex<String>>,
    /// Text from audio before the current streaming window (context for initial_prompt)
    committed_text: Arc<Mutex<String>>,
    /// Generation counter - increments with each transcription request
    generation: Arc<AtomicUsize>,
    /// Whether a transcription is currently running
    is_transcribing: Arc<AtomicBool>,
    is_recording: Arc<Mutex<bool>>,
    /// Accumulated audio buffer (never emptied during recording)
    audio_buffer: Arc<Mutex<Vec<f32>>>,
    /// Audio length at last transcription trigger
    last_transcribed_len: Arc<AtomicUsize>,
}

impl StreamingState {
    fn new() -> Self {
        Self {
            latest_text: Arc::new(Mutex::new(String::new())),
            committed_text: Arc::new(Mutex::new(String::new())),
            generation: Arc::new(AtomicUsize::new(0)),
            is_transcribing: Arc::new(AtomicBool::new(false)),
            is_recording: Arc::new(Mutex::new(false)),
            audio_buffer: Arc::new(Mutex::new(Vec::new())),
            last_transcribed_len: Arc::new(AtomicUsize::new(0)),
        }
    }

    fn start_recording(&self) {
        *self.is_recording.lock().unwrap() = true;
        *self.latest_text.lock().unwrap() = String::new();
        *self.committed_text.lock().unwrap() = String::new();
        self.generation.store(0, Ordering::Release);
        self.is_transcribing.store(false, Ordering::Release);
        self.audio_buffer.lock().unwrap().clear();
        self.last_transcribed_len.store(0, Ordering::Release);
    }

    fn stop_recording(&self) {
        *self.is_recording.lock().unwrap() = false;
    }

    /// Get latest cumulative text for fallback when final transcription is empty
    fn get_latest_text(&self) -> String {
        self.latest_text.lock().unwrap().clone()
    }

    /// Clone a window of accumulated audio for transcription (up to max_seconds).
    /// Returns (samples, is_windowed) — is_windowed is true when audio exceeds the window.
    fn clone_audio_window(&self, max_seconds: f64) -> (Vec<f32>, bool) {
        let buf = self.audio_buffer.lock().unwrap();
        let max_samples = (max_seconds * 16000.0) as usize;
        if buf.len() > max_samples {
            (buf[buf.len() - max_samples..].to_vec(), true)
        } else {
            (buf.clone(), false)
        }
    }

    /// Trims the audio buffer to keep only recent audio, preventing unbounded growth.
    /// Adjusts `last_transcribed_len` to account for removed samples.
    fn trim_buffer(&self, max_seconds: f64) {
        let max_samples = (max_seconds * 16000.0) as usize;
        let margin = (2.0 * 16000.0) as usize; // 2s margin to avoid boundary issues
        let limit = max_samples + margin;

        let mut buf = self.audio_buffer.lock().unwrap();
        if buf.len() > limit {
            let trim_amount = buf.len() - limit;
            buf.drain(..trim_amount);

            // Adjust last_transcribed_len to stay consistent with trimmed buffer
            let old_len = self.last_transcribed_len.load(Ordering::Acquire);
            self.last_transcribed_len.store(
                old_len.saturating_sub(trim_amount),
                Ordering::Release,
            );
        }
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

        // Cumulative streaming: every 1s of new audio, re-transcribe the full window
        // (up to 10s) for accurate, self-correcting real-time display
        const NEW_AUDIO_TRIGGER: usize = 16000; // Trigger every 1.0s of new audio
        const MAX_WINDOW_SECONDS: f64 = 10.0;   // Max audio window for transcription

        app.listen("audio-segment", move |event| {
            if !*STREAMING_STATE.is_recording.lock().unwrap() {
                return;
            }

            if let Ok(segment_event) = serde_json::from_str::<AudioSegmentEvent>(event.payload()) {
                // Accumulate audio samples (buffer grows during entire recording)
                let should_transcribe = {
                    let mut buf = STREAMING_STATE.audio_buffer.lock().unwrap();
                    buf.extend_from_slice(&segment_event.samples);
                    let total = buf.len();
                    let last = STREAMING_STATE.last_transcribed_len.load(Ordering::Acquire);
                    let new_samples = total.saturating_sub(last);
                    new_samples >= NEW_AUDIO_TRIGGER
                };

                if !should_transcribe {
                    return;
                }

                // Skip if a transcription is already running (backpressure)
                if STREAMING_STATE.is_transcribing.swap(true, Ordering::AcqRel) {
                    return;
                }

                // Mark current buffer length as "transcribed up to here"
                let buf_len = STREAMING_STATE.audio_buffer.lock().unwrap().len();
                STREAMING_STATE.last_transcribed_len.store(buf_len, Ordering::Release);

                // Trim buffer to prevent unbounded memory growth
                STREAMING_STATE.trim_buffer(MAX_WINDOW_SECONDS);

                // Clone a window of accumulated audio (up to MAX_WINDOW_SECONDS)
                let (window_samples, is_windowed) = STREAMING_STATE.clone_audio_window(MAX_WINDOW_SECONDS);
                let gen = STREAMING_STATE.generation.fetch_add(1, Ordering::AcqRel);

                // When windowed, use committed text as initial_prompt for context
                let prompt = if is_windowed {
                    let ct = STREAMING_STATE.committed_text.lock().unwrap();
                    if ct.is_empty() { None } else { Some(ct.clone()) }
                } else {
                    None
                };

                debug!(
                    "[Streaming] Transcribing {:.1}s window (gen {}, windowed={}, prompt={}chars)...",
                    window_samples.len() as f64 / 16000.0, gen, is_windowed,
                    prompt.as_ref().map_or(0, |p| p.len())
                );

                let tm = tm_clone.clone();
                let app_for_display = app_clone.clone();

                std::thread::spawn(move || {
                    match tm.transcribe_with_prompt(window_samples, prompt) {
                        Ok(text) if !text.is_empty() => {
                            // Only apply if this is still the latest generation
                            let current_gen = STREAMING_STATE.generation.load(Ordering::Acquire);
                            if gen + 1 >= current_gen {
                                debug!("[Streaming] Gen {} result: '{}'", gen, text);

                                // Build display text: committed prefix + window result
                                let display_text = if is_windowed {
                                    let committed = STREAMING_STATE.committed_text.lock().unwrap().clone();
                                    // Update committed_text to the prior full result for next window
                                    let prev_latest = STREAMING_STATE.latest_text.lock().unwrap().clone();
                                    if !prev_latest.is_empty() {
                                        *STREAMING_STATE.committed_text.lock().unwrap() = prev_latest;
                                    }
                                    merge_overlapping_text(&committed, &text)
                                } else {
                                    text.clone()
                                };

                                *STREAMING_STATE.latest_text.lock().unwrap() = display_text.clone();

                                if let Some(window) = app_for_display.get_webview_window("recording_overlay") {
                                    // Stop repositioning once streaming text appears
                                    crate::overlay::set_streaming_active(true);
                                    let _ = window.emit("td-partial", &display_text);
                                }
                            } else {
                                debug!("[Streaming] Gen {} stale (current {}), discarding", gen, current_gen);
                            }
                        }
                        Ok(_) => debug!("[Streaming] Gen {} was empty", gen),
                        Err(e) => debug!("[Streaming] Gen {} failed: {}", gen, e),
                    }
                    STREAMING_STATE.is_transcribing.store(false, Ordering::Release);
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

        // Notify overlay that streaming is starting (but don't expand yet)
        if let Some(window) = app.get_webview_window("recording_overlay") {
            let _ = window.emit("td-show", ());
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

        // Stop accepting new segments (no flush needed - final transcription uses full audio)
        STREAMING_STATE.stop_recording();

        // Allow model unload again (after final transcription completes)
        let tm_for_unload = app.state::<Arc<TranscriptionManager>>();
        tm_for_unload.set_suppress_unload(false);

        let ah = app.clone();
        let rm = Arc::clone(&app.state::<Arc<AudioRecordingManager>>());
        let tm = Arc::clone(&app.state::<Arc<TranscriptionManager>>());
        let hm = Arc::clone(&app.state::<Arc<HistoryManager>>());

        change_tray_icon(app, TrayIconState::Idle);

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

                // Use streaming result directly — no re-transcription needed
                let mut transcription = STREAMING_STATE.get_latest_text();
                info!("[Final] Using streaming text ({}chars): '{}'", transcription.len(), transcription);

                // Fallback: if streaming text is empty (very short recording), do one quick transcription
                if transcription.is_empty() {
                    debug!("Streaming text empty, falling back to full transcription");
                    match tm.transcribe(samples) {
                        Ok(t) => {
                            info!("[Final] Fallback transcription ({}chars): '{}'", t.len(), t);
                            transcription = t;
                        }
                        Err(err) => {
                            debug!("Fallback transcription error: {}", err);
                            if let Some(window) = ah.get_webview_window("recording_overlay") {
                                let _ = window.emit("td-hide", ());
                            }
                            utils::hide_recording_overlay(&ah);
                            change_tray_icon(&ah, TrayIconState::Idle);
                            return;
                        }
                    }
                }

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
                        utils::emit_overlay_state(&ah, "ghostwriting");

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
                                let pm = ah.state::<Arc<ProfileManager>>();
                                match pm.get_profile(profile_id).await {
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

                        // Get API key from OS keychain, fall back to settings file
                        let api_key = get_openrouter_api_key()
                            .or_else(|| settings.openrouter_api_key.clone());

                        match ghostwriter::process_text(
                            &transcription,
                            &api_key,
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

                    // Send final result to recording overlay
                    if let Some(window) = ah.get_webview_window("recording_overlay") {
                        let _ = window.emit("td-final", &final_text);
                    }

                    let transcription_clone = final_text.clone();
                    let ah_clone = ah.clone();
                    let paste_time = Instant::now();
                    ah.run_on_main_thread(move || {
                        // Hide the overlay BEFORE pasting to prevent it from stealing focus
                        if let Some(window) = ah_clone.get_webview_window("recording_overlay") {
                            let _ = window.emit("td-hide", ());
                        }
                        utils::hide_recording_overlay(&ah_clone);

                        // Small delay to ensure overlay is fully hidden before pasting
                        std::thread::sleep(std::time::Duration::from_millis(50));

                        debug!("Pasting text on main thread: '{}'", transcription_clone);
                        match utils::paste(transcription_clone, ah_clone.clone()) {
                            Ok(()) => {
                                debug!("Text pasted successfully in {:?}", paste_time.elapsed())
                            }
                            Err(e) => error!("Failed to paste transcription: {}", e),
                        }
                        change_tray_icon(&ah_clone, TrayIconState::Idle);
                    })
                    .unwrap_or_else(|e| {
                        error!("Failed to run paste on main thread: {:?}", e);
                        if let Some(window) = ah.get_webview_window("recording_overlay") {
                            let _ = window.emit("td-hide", ());
                        }
                        utils::hide_recording_overlay(&ah);
                        change_tray_icon(&ah, TrayIconState::Idle);
                    });
                } else {
                    if let Some(window) = ah.get_webview_window("recording_overlay") {
                        let _ = window.emit("td-hide", ());
                    }
                    utils::hide_recording_overlay(&ah);
                    change_tray_icon(&ah, TrayIconState::Idle);
                }
            } else {
                debug!("No samples retrieved from recording stop");
                if let Some(window) = ah.get_webview_window("recording_overlay") {
                    let _ = window.emit("td-hide", ());
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
        info!(
            "Shortcut ID '{}': Started - {} (App: {})", // Changed "Pressed" to "Started" for consistency
            binding_id,
            shortcut_str,
            app.package_info().name
        );
    }

    fn stop(&self, app: &AppHandle, binding_id: &str, shortcut_str: &str) {
        info!(
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

#[cfg(test)]
mod tests {
    use super::merge_overlapping_text;

    #[test]
    fn test_merge_no_overlap() {
        let result = merge_overlapping_text("hello world", "foo bar");
        assert_eq!(result, "hello world foo bar");
    }

    #[test]
    fn test_merge_with_overlap() {
        let result = merge_overlapping_text(
            "the quick brown fox jumps",
            "brown fox jumps over the lazy dog",
        );
        assert_eq!(result, "the quick brown fox jumps over the lazy dog");
    }

    #[test]
    fn test_merge_full_overlap() {
        let result = merge_overlapping_text("hello world foo", "hello world foo");
        assert_eq!(result, "hello world foo");
    }

    #[test]
    fn test_merge_empty_committed() {
        let result = merge_overlapping_text("", "hello world");
        assert_eq!(result, "hello world");
    }

    #[test]
    fn test_merge_empty_new() {
        let result = merge_overlapping_text("hello world", "");
        assert_eq!(result, "hello world");
    }

    #[test]
    fn test_merge_single_word_overlap_ignored() {
        // Single common words like "the" should not trigger dedup
        let result = merge_overlapping_text("I saw the", "the cat");
        assert_eq!(result, "I saw the the cat");
    }

    #[test]
    fn test_merge_case_insensitive() {
        let result = merge_overlapping_text(
            "Hello World Foo",
            "hello world foo bar baz",
        );
        assert_eq!(result, "Hello World Foo bar baz");
    }
}
