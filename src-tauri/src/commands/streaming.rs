use crate::managers::streaming_buffer::StreamingBuffer;
use serde::Serialize;
use std::sync::Mutex;

#[derive(Clone, Serialize)]
#[serde(tag = "type")]
pub enum StreamingTranscriptionEvent {
    Partial { text: String, chunk_index: usize },
    Final { text: String },
    Error { message: String },
}

pub struct StreamingSession {
    pub buffer: Mutex<StreamingBuffer>,
    pub is_active: Mutex<bool>,
    pub partial_texts: Mutex<Vec<String>>,
    pub pending_chunks: std::sync::atomic::AtomicUsize,
}

impl StreamingSession {
    pub fn new() -> Self {
        Self {
            buffer: Mutex::new(StreamingBuffer::new()),
            is_active: Mutex::new(false),
            partial_texts: Mutex::new(Vec::new()),
            pending_chunks: std::sync::atomic::AtomicUsize::new(0),
        }
    }
}
