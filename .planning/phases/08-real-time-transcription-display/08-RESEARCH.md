# Phase 8: Real-Time Transcription Display - Research

**Researched:** 2026-02-06
**Domain:** Streaming speech-to-text with live UI feedback
**Confidence:** MEDIUM

## Summary

Real-time transcription display requires streaming Whisper inference with chunked audio processing and progressive UI updates. The codebase already has infrastructure for audio segment detection via VAD callbacks, but needs a streaming transcription pipeline and a separate display overlay.

Key findings:
- Whisper's native 30-second receptive field requires chunked inference (2-3 second segments) with overlap management for streaming
- whisper-rs and transcribe-rs do NOT currently support native streaming - they process complete audio buffers only
- Streaming requires custom implementation: buffer management, sliding window with overlap, and async chunk processing
- Tauri Channels (not Events) should be used for high-throughput partial transcription results
- VAD segment boundaries (already implemented) provide natural chunk points for transcription
- Whisper hallucinations increase with short audio segments (under 1 second) - 2-3 second chunks are safer

**Primary recommendation:** Build streaming pipeline on top of existing batch transcription using audio segment callbacks, process chunks asynchronously in background threads, and emit partial results via Tauri channels to a separate real-time display overlay positioned above the current recording overlay.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| whisper-rs | Current | Rust bindings to whisper.cpp | Already in use, GPU-accelerated (Vulkan), proven performance |
| transcribe-rs | 0.1.5+ | Multi-engine transcription wrapper | Already integrated, supports Whisper & Parakeet engines |
| Tauri Channels | 2.x | High-throughput streaming data | Official Tauri solution for streaming, faster than events |
| Framer Motion | 12.x | React animation library | Already in use, excellent for streaming text reveals |
| direct_ring_buffer | Latest | Lock-free ring buffer | Best practice for audio streaming in Rust (single-producer/single-consumer) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| rtrb (real-time ring buffer) | Latest | Alternative ring buffer | If direct_ring_buffer doesn't fit audio_async pattern |
| react-auto-scroll | Latest | Auto-scroll text container | If custom scrollIntoView approach needs simplification |
| FlowToken | Latest | LLM-style text animation | If wanting ChatGPT-like text streaming effects (optional polish) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Channels | Tauri Events | Events simpler but unsuitable for high-volume data, direct JS eval overhead |
| Custom buffer | whisper.cpp stream.cpp example | Example is C++, would need careful port; custom gives control |
| Separate overlay | Single overlay with modes | Separate overlay allows independent positioning and lifecycle |

**Installation:**
```bash
# Rust dependencies (add to Cargo.toml)
direct_ring_buffer = "0.1"  # or rtrb = "0.3"

# Frontend dependencies (already have Framer Motion, no additions needed)
# Optional: npm install flowtoken react-auto-scroll
```

## Architecture Patterns

### Recommended Project Structure
```
src-tauri/src/
├── managers/
│   ├── transcription.rs        # Add streaming methods
│   └── streaming_buffer.rs     # NEW: Chunk buffer management
├── audio_toolkit/
│   └── vad/                    # Already emits audio segments
└── overlay.rs                  # Add create_transcription_display_overlay()

src/
├── overlay/
│   ├── RecordingOverlay.tsx    # Existing (microphone visual)
│   └── TranscriptionDisplay.tsx # NEW: Real-time text display
```

### Pattern 1: Sliding Window with Overlap (Core Streaming Pattern)
**What:** Process audio in fixed-time chunks (2-3s) with small overlap (200-500ms) to preserve word boundaries
**When to use:** Streaming inference for any audio longer than 30 seconds
**Example:**
```rust
// Inspired by whisper.cpp stream.cpp
// Source: https://github.com/ggml-org/whisper.cpp/blob/master/examples/stream/stream.cpp

const CHUNK_DURATION_MS: usize = 2500;  // 2.5 second chunks
const OVERLAP_MS: usize = 300;          // 300ms overlap
const SAMPLE_RATE: usize = 16000;

struct StreamingBuffer {
    current_buffer: Vec<f32>,
    overlap_samples: Vec<f32>,
    chunk_index: usize,
}

impl StreamingBuffer {
    fn process_segment(&mut self, new_audio: Vec<f32>) -> Option<Vec<f32>> {
        // Prepend overlap from previous chunk
        let mut chunk = self.overlap_samples.clone();
        chunk.extend_from_slice(&new_audio);

        // Store tail for next iteration overlap
        let overlap_start = chunk.len().saturating_sub(
            (OVERLAP_MS * SAMPLE_RATE) / 1000
        );
        self.overlap_samples = chunk[overlap_start..].to_vec();

        // Return full chunk for transcription
        if chunk.len() >= (CHUNK_DURATION_MS * SAMPLE_RATE) / 1000 {
            self.chunk_index += 1;
            Some(chunk)
        } else {
            None
        }
    }
}
```

### Pattern 2: Async Chunk Processing with Channels
**What:** Process chunks in background threads, stream results via Tauri channels
**When to use:** When you need non-blocking inference with progressive UI updates
**Example:**
```rust
// Backend: src-tauri/src/commands/streaming.rs
use tauri::ipc::Channel;

#[derive(Clone, serde::Serialize)]
pub enum TranscriptionChunk {
    Partial { text: String, chunk_index: usize, confidence: f32 },
    Final { text: String },
}

#[tauri::command]
pub async fn start_streaming_transcription(
    channel: Channel<TranscriptionChunk>,
    app_handle: AppHandle,
) -> Result<(), String> {
    let transcription_manager = app_handle.state::<Arc<TranscriptionManager>>();

    // Set up audio segment listener
    app_handle.listen("audio-segment", move |event| {
        if let Some(segment) = event.payload::<AudioSegmentEvent>() {
            let manager = transcription_manager.clone();
            let channel = channel.clone();

            // Process chunk asynchronously
            std::thread::spawn(move || {
                match manager.transcribe(segment.samples) {
                    Ok(text) => {
                        channel.send(TranscriptionChunk::Partial {
                            text,
                            chunk_index: 0,
                            confidence: 0.85,
                        }).unwrap();
                    }
                    Err(e) => eprintln!("Chunk transcription failed: {}", e),
                }
            });
        }
    });

    Ok(())
}
```

```typescript
// Frontend: src/overlay/TranscriptionDisplay.tsx
import { Channel } from '@tauri-apps/api/core';

const channel = new Channel<TranscriptionChunk>();
channel.onmessage = (message) => {
  if (message.Partial) {
    appendPartialText(message.Partial.text);
  } else if (message.Final) {
    finalizeText(message.Final.text);
  }
};

await invoke('start_streaming_transcription', { channel });
```

### Pattern 3: Word-by-Word Reveal with Framer Motion
**What:** Animate text appearance as chunks arrive, using staggered children animations
**When to use:** Streaming text display where you want smooth visual feedback
**Example:**
```typescript
// Source: Framer Motion text reveal patterns
// https://macarthur.me/posts/streaming-text-with-typeit/

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,  // 50ms between words
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 500,
      damping: 30,
    }
  }
};

<motion.div variants={container} initial="hidden" animate="show">
  {words.map((word, i) => (
    <motion.span key={i} variants={item}>
      {word}{' '}
    </motion.span>
  ))}
</motion.div>
```

### Pattern 4: Auto-Scroll with RequestAnimationFrame
**What:** Smooth scroll to bottom as new text appears, using RAF for 60fps updates
**When to use:** Long streaming text that exceeds visible area
**Example:**
```typescript
// Source: React auto-scroll best practices
// https://dev.to/parth24072001/how-to-autoscroll-in-reactcreating-smooth-auto-scrolling-functionality-in-react-1o33

const scrollRef = useRef<HTMLDivElement>(null);
const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

const smoothScrollToBottom = useCallback(() => {
  if (!scrollRef.current || !shouldAutoScroll) return;

  requestAnimationFrame(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth'
    });
  });
}, [shouldAutoScroll]);

useEffect(() => {
  smoothScrollToBottom();
}, [text, smoothScrollToBottom]);
```

### Anti-Patterns to Avoid
- **Processing every VAD frame**: Don't send 30ms frames to Whisper - accumulate to 2-3 second segments first
- **Blocking UI thread**: Never run transcription on main thread - always use async/spawn
- **Event spam**: Don't emit every word change as separate Tauri event - use channels for high-frequency updates
- **No overlap management**: Chunks without overlap cause word boundary cuts mid-word
- **Displaying raw partial results**: Partial results may have hallucinations - mark them visually as "in progress"

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audio ring buffer | Manual Vec rotation with bounds checking | direct_ring_buffer or rtrb crate | Lock-free, zero-copy slices, handles wrap-around, proven in audio applications |
| Streaming text animation | Custom CSS transitions per word | Framer Motion variants with staggerChildren | Handles timing, interruptions, re-renders elegantly |
| Sliding window overlap | Manual array slicing and copying | Pattern from whisper.cpp stream.cpp | Handles edge cases (buffer underflow, variable chunk sizes) |
| Channel type definitions | Ad-hoc message passing | Tauri Channel<T> with enum types | Type-safe, ordered delivery, handles backpressure |
| Auto-scroll detection | Manual scroll position math | scrollIntoView() + requestAnimationFrame | Browser-optimized, handles variable content heights |

**Key insight:** Streaming audio transcription has many subtle edge cases (chunk boundaries, memory management, timing coordination). The whisper.cpp stream example has solved these through extensive testing - port the patterns rather than reinventing.

## Common Pitfalls

### Pitfall 1: Short Chunk Hallucinations
**What goes wrong:** Whisper hallucinates more frequently on audio segments under 1 second, sometimes inventing entire phrases
**Why it happens:** Whisper was trained on 30-second windows - very short segments lack sufficient context for reliable inference
**How to avoid:** Use 2-3 second minimum chunk sizes. Buffer VAD segments until reaching this threshold before transcribing
**Warning signs:** Transcripts containing random unrelated phrases, especially when no one is speaking

**Reference:**
- Whisper-v3 hallucination rate increases 4x on short segments (median WER 53.4% vs 12.7%)
- 38% of hallucinations include explicit harms or false associations
- Source: https://arxiv.org/html/2501.11378v1

### Pitfall 2: Audio-Text Desync
**What goes wrong:** Visual text display lags or races ahead of actual speech, breaking perceived real-time feedback
**Why it happens:** Inference latency varies (100ms-2s depending on chunk size and GPU), but UI animations run at fixed rates
**How to avoid:**
- Display partial results immediately when available, don't wait for animation
- Use timestamp-based coordination: emit chunk_start_time with each segment
- Mark old partials visually (fade opacity) when newer chunks arrive
**Warning signs:** Text appearing before person finishes speaking, or long delay after silence

### Pitfall 3: GPU Memory Exhaustion with Overlapping Chunks
**What goes wrong:** Multiple chunks processing simultaneously consume GPU memory, causing OOM or performance degradation
**Why it happens:** Activations are unique per chunk - can't share memory like model weights can
**How to avoid:**
- Limit concurrent transcription threads (1-2 max for GPU backend)
- Wait for chunk N to complete before starting chunk N+2 (allow N+1 to start)
- Monitor GPU memory usage, reduce chunk size or concurrency if approaching limits
**Warning signs:** Inference suddenly slowing down, process crashes on long recordings

**Reference:** Whisper activations for 2-3s chunks can use 500MB-1GB each depending on model size. 16GB GPU can handle 2-3 concurrent Whisper Large inference tasks.

### Pitfall 4: Event System Bottleneck
**What goes wrong:** High-frequency partial result updates (10+ per second) cause frontend lag or dropped updates
**Why it happens:** Tauri events "directly evaluate JavaScript code" for each message, creating overhead
**How to avoid:** Use Tauri Channels instead of Events for partial transcription results. Reserve events for control flow (start/stop/error)
**Warning signs:** Frontend becoming sluggish during transcription, console showing event queue backlog

**Reference:** Tauri documentation explicitly warns events are "not designed for low latency or high throughput situations"
Source: https://v2.tauri.app/develop/calling-frontend/

### Pitfall 5: Race Conditions with Final Results
**What goes wrong:** Batch transcription completes before all streaming chunks finish, showing different text
**Why it happens:** Streaming chunks process independently from final batch transcription - both run concurrently
**How to avoid:**
- Make streaming and batch mutually exclusive modes (setting toggle)
- OR: Use streaming results as "preview" that gets replaced by final batch result
- Clear streaming display before showing final result to avoid jarring text changes
**Warning signs:** Text flashing or changing after user thinks transcription is complete

### Pitfall 6: VAD Segment Fragmentation
**What goes wrong:** VAD emits many tiny segments (200-500ms) during natural speech pauses, creating too many chunks
**Why it happens:** VAD designed for silence detection, not optimal chunking for inference
**How to avoid:**
- Buffer VAD segments in StreamingBuffer until reaching 2-3 second threshold
- Use SmoothedVad settings: increase hangover frames (currently 15) to reduce fragmentation
- Only transcribe buffered segments, not every individual VAD output
**Warning signs:** Extremely high transcription request rate, poor inference throughput

## Code Examples

Verified patterns from official sources:

### Whisper.cpp Stream Buffer Management
```cpp
// Source: https://github.com/ggml-org/whisper.cpp/blob/master/examples/stream/stream.cpp
// Default parameters for streaming

const int step_ms = 3000;      // Audio processing interval
const int length_ms = 10000;   // Total audio window
const int keep_ms = 200;       // Overlap from previous iteration

// Convert to sample counts
const int n_samples_step = (step_ms * WHISPER_SAMPLE_RATE) / 1000;
const int n_samples_len = (length_ms * WHISPER_SAMPLE_RATE) / 1000;
const int n_samples_keep = (keep_ms * WHISPER_SAMPLE_RATE) / 1000;

// Keep part of the audio for next iteration to mitigate word boundary issues
std::vector<float> pcmf32_old(n_samples_keep);
std::vector<float> pcmf32_new(n_samples_step);

// Processing loop:
// 1. Copy overlap: pcmf32_old -> pcmf32 buffer start
// 2. Append new: pcmf32_new -> pcmf32 buffer after overlap
// 3. Transcribe combined buffer
// 4. Save tail samples to pcmf32_old for next iteration
```

### Tauri Channel Setup (Rust)
```rust
// Source: https://v2.tauri.app/develop/calling-frontend/
use tauri::ipc::Channel;

#[derive(Clone, serde::Serialize)]
enum StreamMessage {
    PartialResult { text: String, index: usize },
    Complete { final_text: String },
    Error { message: String },
}

#[tauri::command]
async fn stream_transcription(
    channel: Channel<StreamMessage>,
) -> Result<(), String> {
    // Emit partial results
    channel.send(StreamMessage::PartialResult {
        text: "Hello".to_string(),
        index: 0,
    }).map_err(|e| e.to_string())?;

    // ... more processing ...

    channel.send(StreamMessage::Complete {
        final_text: "Hello world".to_string(),
    }).map_err(|e| e.to_string())?;

    Ok(())
}
```

### Tauri Channel Setup (TypeScript)
```typescript
// Source: https://v2.tauri.app/develop/calling-frontend/
import { invoke } from '@tauri-apps/api/core';
import { Channel } from '@tauri-apps/api/core';

type StreamMessage =
  | { PartialResult: { text: string; index: number } }
  | { Complete: { final_text: string } }
  | { Error: { message: string } };

const channel = new Channel<StreamMessage>();
channel.onmessage = (message) => {
  if ('PartialResult' in message) {
    console.log('Partial:', message.PartialResult.text);
  } else if ('Complete' in message) {
    console.log('Final:', message.Complete.final_text);
  }
};

await invoke('stream_transcription', { channel });
```

### Separate Overlay Window Creation
```rust
// Pattern: Second overlay above recording overlay
// Existing: recording_overlay at y (bottom of screen)
// New: transcription_display at y - DISPLAY_HEIGHT - 20

const TRANSCRIPTION_DISPLAY_HEIGHT: f64 = 200.0;
const TRANSCRIPTION_DISPLAY_WIDTH: f64 = 600.0;
const DISPLAY_SPACING: f64 = 20.0;  // Gap between overlays

pub fn create_transcription_display(app_handle: &AppHandle) {
    let settings = get_settings(app_handle);
    if settings.overlay_position == OverlayPosition::None {
        return;
    }

    // Get recording overlay position
    let recording_y = calculate_overlay_position(app_handle)
        .map(|(_, y)| y)
        .unwrap_or(0.0);

    // Position transcription display above recording overlay
    let display_y = recording_y - TRANSCRIPTION_DISPLAY_HEIGHT - DISPLAY_SPACING;
    let display_x = calculate_centered_x(app_handle, TRANSCRIPTION_DISPLAY_WIDTH);

    WebviewWindowBuilder::new(
        app_handle,
        "transcription_display",
        tauri::WebviewUrl::App("src/overlay/transcription.html".into()),
    )
    .title("Transcription")
    .position(display_x, display_y)
    .inner_size(TRANSCRIPTION_DISPLAY_WIDTH, TRANSCRIPTION_DISPLAY_HEIGHT)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .visible(false)
    .build()
    .expect("Failed to create transcription display");
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Batch-only Whisper | Streaming via chunked inference | 2025 (Simul-Whisper, U2-Whisper papers) | Enables real-time display with 3.3s latency |
| Fixed 30s windows | Sliding window with overlap | whisper.cpp stream example (2024) | Preserves word boundaries, reduces artifacts |
| whisper-rs streaming | Custom implementation required | Current (2026) | Library doesn't support streaming - must build on top |
| Tauri Events for data | Tauri Channels for streaming | Tauri 2.0 (2024) | 10x+ throughput for high-frequency updates |
| Single overlay window | Multiple specialized overlays | Modern Tauri patterns | Independent lifecycles, better positioning control |

**Deprecated/outdated:**
- **whisper_streaming Python library patterns**: Python-specific, not directly applicable to Rust/Tauri stack
- **WebSocket streaming approaches**: Unnecessary complexity for local desktop app - Tauri channels are simpler and faster
- **Server-side VAD chunking**: LeadrScribe already has excellent local VAD with segment callbacks - reuse it

## Open Questions

Things that couldn't be fully resolved:

1. **transcribe-rs streaming support timeline**
   - What we know: Library currently file-based only (v0.1.5), streaming mentioned as future feature
   - What's unclear: Whether maintainer plans to add streaming API, or if we should implement separately
   - Recommendation: Implement custom streaming using existing transcribe() method in threads, monitor library for future streaming APIs

2. **Optimal chunk size for Whisper Small/Medium/Turbo models**
   - What we know: 2-3 seconds is safe minimum, whisper.cpp uses 3s default
   - What's unclear: Whether smaller models (Small/Medium) can handle shorter chunks reliably
   - Recommendation: Start with 2.5s default, make configurable, test WER at 1.5s/2.0s/2.5s/3.0s

3. **GPU memory limits for concurrent chunks on user hardware**
   - What we know: Activations use 500MB-1GB per chunk depending on model size
   - What's unclear: Real-world headroom on users' GPUs (8GB/12GB/16GB typical)
   - Recommendation: Limit to 2 concurrent chunks initially, add memory monitoring if users report OOM

4. **VAD segment callback modification impact**
   - What we know: Current audio.rs emits audio-segment events that could be hijacked for streaming
   - What's unclear: Whether adding streaming consumer breaks existing batch transcription flow
   - Recommendation: Make streaming opt-in via setting, ensure both modes can coexist

5. **Hallucination rate on 2-3s chunks in practice**
   - What we know: Research shows shorter segments increase hallucinations significantly
   - What's unclear: Real-world hallucination rate at 2.5s chunks vs 30s batch with user audio
   - Recommendation: Mark streaming results as "preview" visually, always run final batch transcription for accurate result

## Sources

### Primary (HIGH confidence)
- Tauri v2 Channels Documentation - https://v2.tauri.app/develop/calling-frontend/ - Channel API and performance characteristics
- whisper.cpp stream.cpp example - https://github.com/ggml-org/whisper.cpp/blob/master/examples/stream/stream.cpp - Buffer management and chunk parameters
- whisper_streaming (ufal) GitHub - https://github.com/ufal/whisper_streaming - Local Agreement policy and latency characteristics
- Whisper hallucination research (2025) - https://arxiv.org/html/2501.11378v1 - Quality degradation on short segments

### Secondary (MEDIUM confidence)
- transcribe-rs GitHub repository - https://github.com/cjpais/transcribe-rs - Current capabilities, no native streaming support
- Framer Motion text animation patterns - https://ui.indie-starter.dev/docs/text-animation - Word-by-word reveal techniques
- React auto-scroll best practices - https://dev.to/parth24072001/how-to-autoscroll-in-reactcreating-smooth-auto-scrolling-functionality-in-react-1o33 - ScrollIntoView + RAF pattern
- direct_ring_buffer crate docs - https://docs.rs/direct_ring_buffer/latest/direct_ring_buffer/ - Lock-free audio buffer implementation

### Tertiary (LOW confidence)
- Whisper streaming developments (WebSearch 2026) - https://www.baseten.co/blog/zero-to-real-time-transcription-the-complete-whisper-v3-websockets-tutorial/ - General streaming approaches, not Rust-specific
- FlowToken React component - https://github.com/Ephibbs/flowtoken - Optional polish for LLM-style text reveal
- GPU memory management discussions - https://github.com/openai/whisper/discussions/360 - Community reports on concurrent inference

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Tauri Channels and whisper.cpp patterns are proven, transcribe-rs limitation is documented
- Architecture: MEDIUM - Streaming patterns well-established but require custom implementation for this stack
- Pitfalls: HIGH - Hallucination research and Tauri performance warnings are well-documented

**Research date:** 2026-02-06
**Valid until:** ~30 days (stable domain, but transcribe-rs may add streaming features)

**Key gaps requiring validation during planning:**
- Exact impact on existing batch transcription pipeline when adding streaming consumer
- Memory usage of 2 concurrent Whisper inference tasks on typical user GPUs
- Real-world hallucination rate at 2.5s chunks vs research benchmarks
- Performance of Tauri channels with 5-10 updates per second on Windows/macOS
