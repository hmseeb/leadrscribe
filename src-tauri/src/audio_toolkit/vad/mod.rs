use anyhow::Result;

pub enum VadFrame<'a> {
    /// Speech – may aggregate several frames (prefill + current + hangover)
    Speech(&'a [f32]),
    /// Non-speech (silence, noise). Down-stream code can ignore it.
    Noise,
}

impl<'a> VadFrame<'a> {
    #[inline]
    pub fn is_speech(&self) -> bool {
        matches!(self, VadFrame::Speech(_))
    }
}

/// Events emitted by the streaming VAD for sentence boundary detection
pub enum VadSegmentEvent {
    /// Speech is continuing (no action needed)
    SpeechContinue,
    /// A sentence/segment boundary was detected (long pause)
    /// The accumulated audio segment is ready for transcription
    SegmentComplete,
    /// Silence/noise (no speech detected)
    Silence,
}

pub trait VoiceActivityDetector: Send + Sync {
    /// Primary streaming API: feed one 30-ms frame, get keep/drop decision.
    fn push_frame<'a>(&'a mut self, frame: &'a [f32]) -> Result<VadFrame<'a>>;

    fn is_voice(&mut self, frame: &[f32]) -> Result<bool> {
        Ok(self.push_frame(frame)?.is_speech())
    }

    fn reset(&mut self) {}

    /// Check if a segment boundary has been detected (for streaming transcription)
    /// Default implementation returns None (no segment boundary detection)
    fn check_segment_boundary(&mut self) -> Option<VadSegmentEvent> {
        None
    }
}

mod silero;
mod smoothed;

pub use silero::SileroVad;
pub use smoothed::SmoothedVad;
