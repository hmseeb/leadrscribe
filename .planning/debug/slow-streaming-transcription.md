---
status: verifying
trigger: "Streaming transcription is very slow and inaccurate. User wants real-time transcription where words appear as they speak."
created: 2026-02-10T00:00:00Z
updated: 2026-02-10T00:20:00Z
---

## Current Focus

hypothesis: CONFIRMED - Fix implemented
test: User needs to build and test the application
expecting: Words appear 1-2 seconds after speaking (much faster than 4-5 seconds before)
next_action: Awaiting user verification

## Symptoms

expected: Real-time streaming transcription - words should appear on screen as the user speaks, with minimal delay (sub-second)
actual: Transcription is very slow and inaccurate during streaming. Words take many seconds to appear.
errors: No errors, just performance issue
reproduction: Start recording with the keyboard shortcut. Speak. Words appear very slowly in the overlay, not in real-time.
started: This is the first implementation of streaming transcription. The batch-based approach was chosen for reliability but is too slow for real-time feel.

## Eliminated

## Evidence

- timestamp: 2026-02-10T00:05:00Z
  checked: actions.rs streaming pipeline (lines 93-171)
  found: BATCH_THRESHOLD = 48000 samples (3 seconds at 16kHz), accumulates audio until threshold hit, then spawns thread to transcribe
  implication: Minimum 3 seconds of audio must accumulate before ANY transcription starts - this is the primary bottleneck

- timestamp: 2026-02-10T00:06:00Z
  checked: transcription.rs transcribe() method
  found: Uses Mutex lock on engine (line 384), processes synchronously inside lock
  implication: Multiple transcription requests are serialized - if one batch takes 2s to process, the next waits

- timestamp: 2026-02-10T00:07:00Z
  checked: streaming_buffer.rs (unused module)
  found: Built for 2.5s chunks with 300ms overlap, but NOT currently used by actions.rs
  implication: A better streaming buffer implementation exists but isn't being utilized

- timestamp: 2026-02-10T00:08:00Z
  checked: Backpressure mechanism (actions.rs lines 131-135)
  found: Skips batches when >= 2 pending transcriptions
  implication: If transcription is slow, audio chunks are being DROPPED entirely, causing inaccuracy

- timestamp: 2026-02-10T00:10:00Z
  checked: VAD configuration (smoothed.rs, audio.rs line 40)
  found: SmoothedVad with segment_boundary_threshold=50 frames (1.5s silence), min_segment_frames=67 (2s speech minimum)
  implication: VAD emits segments every 2+ seconds of speech followed by 1.5s silence - variable timing, but typically 2-4 seconds per segment

- timestamp: 2026-02-10T00:12:00Z
  checked: Total latency calculation
  found: Pipeline latency = 3s batch accumulation + 1-2s transcription time (estimated for parakeet) + serialization via Mutex = 4-5+ seconds total
  implication: Words spoken at T=0 don't appear until T=4-5 seconds - this is nowhere near "real-time"

- timestamp: 2026-02-10T00:22:00Z
  checked: Parakeet model characteristics
  found: User is using parakeet-tdt-0.6b-v3 which is CPU-optimized, fast inference model
  implication: Transcription time for 0.8s audio should be ~0.3-0.5s on decent CPU, making total latency around 1.2-1.5s - acceptable for "real-time" feel

## Resolution

root_cause: The BATCH_THRESHOLD of 48000 samples (3 seconds at 16kHz) creates a mandatory 3-second wait before ANY transcription begins. Combined with ~0.5-1 second of transcription processing time (parakeet model on CPU) and mutex serialization, total latency is 4-5+ seconds. This is fundamentally incompatible with "real-time" streaming feel.

fix: Reduce BATCH_THRESHOLD from 3 seconds to 1.0 second (16000 samples). This provides enough context for the model to produce accurate results while dramatically reducing latency. Expected total latency: ~1.5-2 seconds (1.0s accumulation + 0.5-1s processing). Conservative choice over 0.8s to ensure quality.

verification: READY FOR USER TESTING
Instructions:
1. Run `_dev.bat` to build and launch the application
2. Trigger recording with your keyboard shortcut
3. Speak continuously for 5-10 seconds (e.g., "The quick brown fox jumps over the lazy dog. This is a test of the real-time transcription system.")
4. Observe when text appears in the overlay
5. Expected: Words appear 1.5-2 seconds after speaking (vs 4-5 seconds before) - should feel much more responsive
6. Verify transcription quality is still good (complete sentences, no gibberish)
7. Test multiple times to ensure consistency
8. If too slow still, can reduce to 0.8s (12800 samples); if accuracy suffers, can increase to 1.5s (24000 samples)

files_changed:
- src-tauri/src/actions.rs (BATCH_THRESHOLD constant)
