use std::{
    sync::{mpsc, Arc, Mutex},
    time::Duration,
};

use cpal::{
    traits::{DeviceTrait, HostTrait, StreamTrait},
    Device, Sample, SizedSample,
};
use log::{error, info};

use crate::audio_toolkit::{
    audio::{AudioVisualiser, FrameResampler},
    constants,
    vad::{self, VadFrame, VadSegmentEvent},
    VoiceActivityDetector,
};

enum Cmd {
    Start,
    Stop(mpsc::Sender<Vec<f32>>),
    Shutdown,
}

/// Error type for audio recorder operations
#[derive(Debug)]
pub enum RecorderError {
    NoInputDevice,
    ConfigError(String),
    StreamError(String),
    UnsupportedFormat(String),
    Other(String),
}

impl std::fmt::Display for RecorderError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RecorderError::NoInputDevice => write!(f, "No input device found"),
            RecorderError::ConfigError(msg) => write!(f, "Audio config error: {}", msg),
            RecorderError::StreamError(msg) => write!(f, "Audio stream error: {}", msg),
            RecorderError::UnsupportedFormat(fmt) => {
                write!(f, "Unsupported audio sample format: {}", fmt)
            }
            RecorderError::Other(msg) => write!(f, "Audio error: {}", msg),
        }
    }
}

impl std::error::Error for RecorderError {}

pub struct AudioRecorder {
    device: Option<Device>,
    cmd_tx: Option<mpsc::Sender<Cmd>>,
    worker_handle: Option<std::thread::JoinHandle<()>>,
    vad: Option<Arc<Mutex<Box<dyn vad::VoiceActivityDetector>>>>,
    level_cb: Option<Arc<dyn Fn(Vec<f32>) + Send + Sync + 'static>>,
    segment_cb: Option<Arc<dyn Fn(Vec<f32>) + Send + Sync + 'static>>,
}

impl AudioRecorder {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        Ok(AudioRecorder {
            device: None,
            cmd_tx: None,
            worker_handle: None,
            vad: None,
            level_cb: None,
            segment_cb: None,
        })
    }

    pub fn with_vad(mut self, vad: Box<dyn VoiceActivityDetector>) -> Self {
        self.vad = Some(Arc::new(Mutex::new(vad)));
        self
    }

    pub fn with_level_callback<F>(mut self, cb: F) -> Self
    where
        F: Fn(Vec<f32>) + Send + Sync + 'static,
    {
        self.level_cb = Some(Arc::new(cb));
        self
    }

    pub fn with_segment_callback<F>(mut self, cb: F) -> Self
    where
        F: Fn(Vec<f32>) + Send + Sync + 'static,
    {
        self.segment_cb = Some(Arc::new(cb));
        self
    }

    pub fn open(&mut self, device: Option<Device>) -> Result<(), Box<dyn std::error::Error>> {
        if self.worker_handle.is_some() {
            return Ok(()); // already open
        }

        let (sample_tx, sample_rx) = mpsc::channel::<Vec<f32>>();
        let (cmd_tx, cmd_rx) = mpsc::channel::<Cmd>();
        // Channel for worker thread to report initialization errors
        let (init_tx, init_rx) = mpsc::channel::<Result<(), RecorderError>>();

        let host = crate::audio_toolkit::get_cpal_host();
        let device = match device {
            Some(dev) => dev,
            None => host
                .default_input_device()
                .ok_or_else(|| RecorderError::NoInputDevice)?,
        };

        let thread_device = device.clone();
        let vad = self.vad.clone();
        // Move the optional callbacks into the worker thread
        let level_cb = self.level_cb.clone();
        let segment_cb = self.segment_cb.clone();

        let worker = std::thread::spawn(move || {
            // Get preferred config, report error if it fails
            let config = match AudioRecorder::get_preferred_config(&thread_device) {
                Ok(c) => c,
                Err(e) => {
                    let _ = init_tx.send(Err(RecorderError::ConfigError(e.to_string())));
                    return;
                }
            };

            let sample_rate = config.sample_rate().0;
            let channels = config.channels() as usize;

            info!(
                "Using device: {:?}\nSample rate: {}\nChannels: {}\nFormat: {:?}",
                thread_device.name(),
                sample_rate,
                channels,
                config.sample_format()
            );

            // Build stream with proper error handling for all formats
            let stream_result = match config.sample_format() {
                cpal::SampleFormat::U8 => {
                    AudioRecorder::build_stream::<u8>(&thread_device, &config, sample_tx, channels)
                }
                cpal::SampleFormat::I8 => {
                    AudioRecorder::build_stream::<i8>(&thread_device, &config, sample_tx, channels)
                }
                cpal::SampleFormat::I16 => {
                    AudioRecorder::build_stream::<i16>(&thread_device, &config, sample_tx, channels)
                }
                cpal::SampleFormat::I32 => {
                    AudioRecorder::build_stream::<i32>(&thread_device, &config, sample_tx, channels)
                }
                cpal::SampleFormat::F32 => {
                    AudioRecorder::build_stream::<f32>(&thread_device, &config, sample_tx, channels)
                }
                other => {
                    let _ = init_tx.send(Err(RecorderError::UnsupportedFormat(format!(
                        "{:?}",
                        other
                    ))));
                    return;
                }
            };

            let stream = match stream_result {
                Ok(s) => s,
                Err(e) => {
                    let _ = init_tx.send(Err(RecorderError::StreamError(e.to_string())));
                    return;
                }
            };

            // Start playing the stream
            if let Err(e) = stream.play() {
                let _ = init_tx.send(Err(RecorderError::StreamError(e.to_string())));
                return;
            }

            // Signal successful initialization
            let _ = init_tx.send(Ok(()));

            // keep the stream alive while we process samples
            run_consumer(sample_rate, vad, sample_rx, cmd_rx, level_cb, segment_cb);
            // stream is dropped here, after run_consumer returns
        });

        // Wait for initialization result from worker thread (with timeout)
        match init_rx.recv_timeout(Duration::from_secs(5)) {
            Ok(Ok(())) => {
                // Initialization succeeded
                self.device = Some(device);
                self.cmd_tx = Some(cmd_tx);
                self.worker_handle = Some(worker);
                Ok(())
            }
            Ok(Err(e)) => {
                // Initialization failed with a known error
                let _ = worker.join();
                Err(Box::new(e))
            }
            Err(_) => {
                // Timeout or channel closed unexpectedly
                let _ = worker.join();
                Err(Box::new(RecorderError::Other(
                    "Audio initialization timed out or failed unexpectedly".to_string(),
                )))
            }
        }
    }

    pub fn start(&self) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(tx) = &self.cmd_tx {
            tx.send(Cmd::Start)?;
        }
        Ok(())
    }

    pub fn stop(&self) -> Result<Vec<f32>, Box<dyn std::error::Error>> {
        let (resp_tx, resp_rx) = mpsc::channel();
        if let Some(tx) = &self.cmd_tx {
            tx.send(Cmd::Stop(resp_tx))?;
        }
        Ok(resp_rx.recv()?) // wait for the samples
    }

    pub fn close(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(tx) = self.cmd_tx.take() {
            let _ = tx.send(Cmd::Shutdown);
        }
        if let Some(h) = self.worker_handle.take() {
            let _ = h.join();
        }
        self.device = None;
        Ok(())
    }

    fn build_stream<T>(
        device: &cpal::Device,
        config: &cpal::SupportedStreamConfig,
        sample_tx: mpsc::Sender<Vec<f32>>,
        channels: usize,
    ) -> Result<cpal::Stream, cpal::BuildStreamError>
    where
        T: Sample + SizedSample + Send + 'static,
        f32: cpal::FromSample<T>,
    {
        let mut output_buffer = Vec::new();

        let stream_cb = move |data: &[T], _: &cpal::InputCallbackInfo| {
            output_buffer.clear();

            if channels == 1 {
                // Direct conversion without intermediate Vec
                output_buffer.extend(data.iter().map(|&sample| sample.to_sample::<f32>()));
            } else {
                // Convert to mono directly
                let frame_count = data.len() / channels;
                output_buffer.reserve(frame_count);

                for frame in data.chunks_exact(channels) {
                    let mono_sample = frame
                        .iter()
                        .map(|&sample| sample.to_sample::<f32>())
                        .sum::<f32>()
                        / channels as f32;
                    output_buffer.push(mono_sample);
                }
            }

            if sample_tx.send(output_buffer.clone()).is_err() {
                error!("Failed to send samples");
            }
        };

        device.build_input_stream(
            &config.clone().into(),
            stream_cb,
            |err| error!("Stream error: {}", err),
            None,
        )
    }

    fn get_preferred_config(
        device: &cpal::Device,
    ) -> Result<cpal::SupportedStreamConfig, Box<dyn std::error::Error>> {
        let supported_configs = device.supported_input_configs()?;

        // Try to find a config that supports 16kHz
        for config_range in supported_configs {
            if config_range.min_sample_rate().0 <= constants::WHISPER_SAMPLE_RATE
                && config_range.max_sample_rate().0 >= constants::WHISPER_SAMPLE_RATE
            {
                // Found a config that supports 16kHz, use it
                return Ok(
                    config_range.with_sample_rate(cpal::SampleRate(constants::WHISPER_SAMPLE_RATE))
                );
            }
        }

        // If no config supports 16kHz, fall back to default
        Ok(device.default_input_config()?)
    }
}

fn run_consumer(
    in_sample_rate: u32,
    vad: Option<Arc<Mutex<Box<dyn vad::VoiceActivityDetector>>>>,
    sample_rx: mpsc::Receiver<Vec<f32>>,
    cmd_rx: mpsc::Receiver<Cmd>,
    level_cb: Option<Arc<dyn Fn(Vec<f32>) + Send + Sync + 'static>>,
    segment_cb: Option<Arc<dyn Fn(Vec<f32>) + Send + Sync + 'static>>,
) {
    let mut frame_resampler = FrameResampler::new(
        in_sample_rate as usize,
        constants::WHISPER_SAMPLE_RATE as usize,
        Duration::from_millis(30),
    );

    let mut processed_samples = Vec::<f32>::new();
    let mut segment_buffer = Vec::<f32>::new(); // Buffer for current segment
    let mut recording = false;

    // Periodic streaming: emit chunks every ~1s of speech audio for real-time display
    const STREAMING_CHUNK_SAMPLES: usize = 16000; // 1 second at 16kHz

    // ---------- spectrum visualisation setup ---------------------------- //
    const BUCKETS: usize = 16;
    const WINDOW_SIZE: usize = 512;
    let mut visualizer = AudioVisualiser::new(
        in_sample_rate,
        WINDOW_SIZE,
        BUCKETS,
        400.0,  // vocal_min_hz
        4000.0, // vocal_max_hz
    );

    fn handle_frame(
        samples: &[f32],
        recording: bool,
        vad: &Option<Arc<Mutex<Box<dyn vad::VoiceActivityDetector>>>>,
        out_buf: &mut Vec<f32>,
        segment_buf: &mut Vec<f32>,
        segment_cb: &Option<Arc<dyn Fn(Vec<f32>) + Send + Sync + 'static>>,
    ) -> bool {
        if !recording {
            return false;
        }

        let mut should_emit_segment = false;

        if let Some(vad_arc) = vad {
            let mut det = vad_arc.lock().unwrap();
            match det.push_frame(samples).unwrap_or(VadFrame::Speech(samples)) {
                VadFrame::Speech(buf) => {
                    out_buf.extend_from_slice(buf);
                    segment_buf.extend_from_slice(buf);
                }
                VadFrame::Noise => {}
            }

            // Check for segment boundary
            if segment_cb.is_some() {
                if let Some(VadSegmentEvent::SegmentComplete) = det.check_segment_boundary() {
                    should_emit_segment = true;
                }
            }
        } else {
            out_buf.extend_from_slice(samples);
            segment_buf.extend_from_slice(samples);
        }

        should_emit_segment
    }

    loop {
        let raw = match sample_rx.recv() {
            Ok(s) => s,
            Err(_) => break, // stream closed
        };

        // ---------- spectrum processing ---------------------------------- //
        if let Some(buckets) = visualizer.feed(&raw) {
            if let Some(cb) = &level_cb {
                cb(buckets);
            }
        }

        // ---------- existing pipeline ------------------------------------ //
        frame_resampler.push(&raw, &mut |frame: &[f32]| {
            let should_emit = handle_frame(
                frame,
                recording,
                &vad,
                &mut processed_samples,
                &mut segment_buffer,
                &segment_cb,
            );

            // Emit segment if boundary detected and we have data
            if should_emit && !segment_buffer.is_empty() {
                if let Some(cb) = &segment_cb {
                    cb(std::mem::take(&mut segment_buffer));
                }
            }

            // Periodic streaming: emit a chunk when enough speech audio accumulates
            // This enables real-time transcription display during continuous speech
            if !should_emit && segment_buffer.len() >= STREAMING_CHUNK_SAMPLES {
                if let Some(cb) = &segment_cb {
                    cb(std::mem::take(&mut segment_buffer));
                }
            }
        });

        // non-blocking check for a command
        while let Ok(cmd) = cmd_rx.try_recv() {
            match cmd {
                Cmd::Start => {
                    processed_samples.clear();
                    segment_buffer.clear();
                    recording = true;
                    visualizer.reset(); // Reset visualization buffer
                    if let Some(v) = &vad {
                        v.lock().unwrap().reset();
                    }
                }
                Cmd::Stop(reply_tx) => {
                    recording = false;

                    frame_resampler.finish(&mut |frame: &[f32]| {
                        // we still want to process the last few frames
                        handle_frame(
                            frame,
                            true,
                            &vad,
                            &mut processed_samples,
                            &mut segment_buffer,
                            &segment_cb,
                        );
                    });

                    // Emit any remaining segment data
                    if !segment_buffer.is_empty() {
                        if let Some(cb) = &segment_cb {
                            cb(std::mem::take(&mut segment_buffer));
                        }
                    }

                    let _ = reply_tx.send(std::mem::take(&mut processed_samples));
                }
                Cmd::Shutdown => return,
            }
        }
    }
}
