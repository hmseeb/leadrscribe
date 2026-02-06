const SAMPLE_RATE: usize = 16000;
const CHUNK_DURATION_MS: usize = 2500; // 2.5 second chunks
const OVERLAP_MS: usize = 300; // 300ms overlap
const MIN_CHUNK_SAMPLES: usize = (CHUNK_DURATION_MS * SAMPLE_RATE) / 1000; // 40000
const OVERLAP_SAMPLES: usize = (OVERLAP_MS * SAMPLE_RATE) / 1000; // 4800
const MIN_FLUSH_SAMPLES: usize = (500 * SAMPLE_RATE) / 1000; // 8000 (0.5s minimum for flush)

pub struct StreamingBuffer {
    buffer: Vec<f32>,
    overlap: Vec<f32>,
    chunk_index: usize,
}

impl StreamingBuffer {
    pub fn new() -> Self {
        Self {
            buffer: Vec::new(),
            overlap: Vec::new(),
            chunk_index: 0,
        }
    }

    /// Add audio segment samples. Returns Some((chunk, chunk_index)) if threshold reached.
    pub fn add_segment(&mut self, samples: Vec<f32>) -> Option<(Vec<f32>, usize)> {
        self.buffer.extend(samples);

        if self.buffer.len() >= MIN_CHUNK_SAMPLES {
            // Build chunk: overlap from previous + current buffer
            let mut chunk = Vec::with_capacity(self.overlap.len() + self.buffer.len());
            chunk.extend_from_slice(&self.overlap);
            chunk.extend_from_slice(&self.buffer);

            // Save new overlap from the tail of current buffer
            let overlap_start = if self.buffer.len() > OVERLAP_SAMPLES {
                self.buffer.len() - OVERLAP_SAMPLES
            } else {
                0
            };
            self.overlap = self.buffer[overlap_start..].to_vec();

            let index = self.chunk_index;
            self.chunk_index += 1;
            self.buffer.clear();

            Some((chunk, index))
        } else {
            None
        }
    }

    /// Flush any remaining samples as a final chunk (called when recording stops).
    /// Returns None if remaining buffer is too short (< 0.5s) to avoid hallucinations.
    pub fn flush(&mut self) -> Option<(Vec<f32>, usize)> {
        if self.buffer.len() < MIN_FLUSH_SAMPLES {
            return None;
        }

        let mut chunk = Vec::with_capacity(self.overlap.len() + self.buffer.len());
        chunk.extend_from_slice(&self.overlap);
        chunk.extend_from_slice(&self.buffer);

        let index = self.chunk_index;
        self.chunk_index += 1;
        self.buffer.clear();
        self.overlap.clear();

        Some((chunk, index))
    }

    /// Reset for new recording session.
    pub fn reset(&mut self) {
        self.buffer.clear();
        self.overlap.clear();
        self.chunk_index = 0;
    }

    pub fn current_chunk_index(&self) -> usize {
        self.chunk_index
    }
}
