use super::{VadFrame, VadSegmentEvent, VoiceActivityDetector};
use anyhow::Result;
use std::collections::VecDeque;

pub struct SmoothedVad {
    inner_vad: Box<dyn VoiceActivityDetector>,
    prefill_frames: usize,
    hangover_frames: usize,
    onset_frames: usize,

    frame_buffer: VecDeque<Vec<f32>>,
    hangover_counter: usize,
    onset_counter: usize,
    in_speech: bool,

    temp_out: Vec<f32>,

    // Segment boundary detection
    silence_frames: usize,
    segment_boundary_threshold: usize, // Number of consecutive silence frames to trigger segment
    speech_frames_since_segment: usize, // Track speech duration to enforce minimum segment length
    min_segment_frames: usize, // Minimum frames before allowing a segment boundary
}

impl SmoothedVad {
    pub fn new(
        inner_vad: Box<dyn VoiceActivityDetector>,
        prefill_frames: usize,
        hangover_frames: usize,
        onset_frames: usize,
    ) -> Self {
        // Default: 1.5 seconds of silence at 30ms per frame = 50 frames
        let segment_boundary_threshold = 50;
        // Minimum 2 seconds of speech at 30ms per frame = ~67 frames
        let min_segment_frames = 67;

        Self {
            inner_vad,
            prefill_frames,
            hangover_frames,
            onset_frames,
            frame_buffer: VecDeque::new(),
            hangover_counter: 0,
            onset_counter: 0,
            in_speech: false,
            temp_out: Vec::new(),
            silence_frames: 0,
            segment_boundary_threshold,
            speech_frames_since_segment: 0,
            min_segment_frames,
        }
    }

}

impl VoiceActivityDetector for SmoothedVad {
    fn push_frame<'a>(&'a mut self, frame: &'a [f32]) -> Result<VadFrame<'a>> {
        // 1. Buffer every incoming frame for possible pre-roll
        self.frame_buffer.push_back(frame.to_vec());
        while self.frame_buffer.len() > self.prefill_frames + 1 {
            self.frame_buffer.pop_front();
        }

        // 2. Delegate to the wrapped boolean VAD
        let is_voice = self.inner_vad.is_voice(frame)?;
        // println!("Is Voice: {}", is_voice);

        let result = match (self.in_speech, is_voice) {
            // Potential start of speech - need to accumulate onset frames
            (false, true) => {
                self.onset_counter += 1;
                if self.onset_counter >= self.onset_frames {
                    // We have enough consecutive voice frames to trigger speech
                    self.in_speech = true;
                    self.hangover_counter = self.hangover_frames;
                    self.onset_counter = 0; // Reset for next time
                    self.silence_frames = 0; // Reset silence counter

                    // Collect prefill + current frame
                    self.temp_out.clear();
                    for buf in &self.frame_buffer {
                        self.temp_out.extend(buf);
                    }
                    Ok(VadFrame::Speech(&self.temp_out))
                } else {
                    // Not enough frames yet, still silence
                    self.silence_frames += 1;
                    Ok(VadFrame::Noise)
                }
            }

            // Ongoing Speech
            (true, true) => {
                self.hangover_counter = self.hangover_frames;
                self.silence_frames = 0; // Reset silence counter on speech
                self.speech_frames_since_segment += 1; // Track speech duration
                Ok(VadFrame::Speech(frame))
            }

            // End of Speech or interruption during onset phase
            (true, false) => {
                if self.hangover_counter > 0 {
                    self.hangover_counter -= 1;
                    self.speech_frames_since_segment += 1; // Still counting as speech during hangover
                    Ok(VadFrame::Speech(frame))
                } else {
                    self.in_speech = false;
                    self.silence_frames += 1;
                    Ok(VadFrame::Noise)
                }
            }

            // Silence or broken onset sequence
            (false, false) => {
                self.onset_counter = 0; // Reset onset counter on silence
                self.silence_frames += 1;
                Ok(VadFrame::Noise)
            }
        };

        result
    }

    fn reset(&mut self) {
        self.frame_buffer.clear();
        self.hangover_counter = 0;
        self.onset_counter = 0;
        self.in_speech = false;
        self.temp_out.clear();
        self.silence_frames = 0;
        self.speech_frames_since_segment = 0;
    }

    /// Check if a segment boundary has been detected
    /// Returns Some(SegmentComplete) if a long pause was detected after sufficient speech
    fn check_segment_boundary(&mut self) -> Option<VadSegmentEvent> {
        if self.silence_frames >= self.segment_boundary_threshold
            && self.speech_frames_since_segment >= self.min_segment_frames
        {
            // Reset counters for next segment
            self.speech_frames_since_segment = 0;
            self.silence_frames = 0;
            Some(VadSegmentEvent::SegmentComplete)
        } else if self.in_speech {
            Some(VadSegmentEvent::SpeechContinue)
        } else {
            Some(VadSegmentEvent::Silence)
        }
    }
}
