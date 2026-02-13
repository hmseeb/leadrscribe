use serde::Serialize;

#[derive(Clone, Serialize)]
#[serde(tag = "type")]
pub enum StreamingTranscriptionEvent {
    Partial { text: String, chunk_index: usize },
    Final { text: String },
    Error { message: String },
}
