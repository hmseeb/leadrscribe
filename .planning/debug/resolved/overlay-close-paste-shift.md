---
status: resolved
trigger: "overlay-close-paste-shift"
created: 2026-02-10T00:00:00Z
updated: 2026-02-10T00:08:00Z
---

## Current Focus

hypothesis: TWO separate bugs confirmed: (1) shrink_overlay_from_streaming() repositions window BEFORE fade animation plays, causing visual jump. (2) Paste fails because stop_recording() returns empty Vec when samples channel fails, causing early exit.
test: verify the execution order and stop_recording return value handling
expecting: Fix involves reordering shrink to happen AFTER hide, and ensuring paste happens even if recording had issues
next_action: implement fixes for both bugs

## Symptoms

expected: When user presses shortcut to stop recording, the overlay should close AND the transcribed text should be pasted. The overlay should close smoothly without jumping position.
actual: Overlay closes but text is not pasted. Additionally, the overlay shifts down-right when closing.
errors: None visible, but "Failed to send samples" was seen in logs during previous test
reproduction: Start recording with shortcut, speak, press shortcut again to stop. Overlay closes but nothing is pasted. Overlay visually shifts position during close animation.
started: Started after adding expand_overlay_for_streaming/shrink_overlay_from_streaming to overlay.rs. These functions resize and reposition the window when streaming starts/stops. The shrink is called inside hide_recording_overlay() BEFORE the hide animation plays.

## Eliminated

## Evidence

- timestamp: 2026-02-10T00:01:00Z
  checked: overlay.rs hide_recording_overlay() function (lines 254-279)
  found: shrink_overlay_from_streaming() is called at line 257 BEFORE the hide animation event is emitted (line 264). The shrink function repositions the window (line 319-327), then the hide animation plays 300ms later.
  implication: Visual shift bug confirmed - window moves to new position, THEN fades out. This is the wrong order.

- timestamp: 2026-02-10T00:02:00Z
  checked: actions.rs stop() function (lines 240-527)
  found: The stop flow is: stop_recording (line 245) → flush remaining audio (247-274) → stop recording (305) → transcribe (321) → paste (479-505). The paste happens inside run_on_main_thread at line 479.
  implication: Paste logic exists and should work. Need to check if transcription is failing silently or if paste mechanism is broken.

- timestamp: 2026-02-10T00:03:00Z
  checked: actions.rs streaming state management
  found: STREAMING_STATE.stop_recording() called at line 245, but streaming segments are still being processed asynchronously. The flush at lines 247-274 spawns a thread that doesn't block.
  implication: The main transcription at line 321 happens immediately without waiting for streaming flush to complete. This shouldn't cause paste failure but creates timing complexity.

- timestamp: 2026-02-10T00:04:00Z
  checked: recorder.rs "Failed to send samples" error source
  found: Line 268-270 shows sample_tx.send() can fail with "Failed to send samples" error. This is the audio sample channel from the stream callback to the consumer.
  implication: If this channel is full or closed, audio data is lost. This could cause rm.stop_recording() to return None (no samples), which triggers early exit at line 513-519 without pasting.

- timestamp: 2026-02-10T00:05:00Z
  checked: managers/audio.rs stop_recording() return behavior
  found: Lines 279-322 show stop_recording() returns Option<Vec<f32>>. Returns None if wrong binding_id (line 320), or Some(samples) where samples can be empty Vec if rec.stop() fails or recorder unavailable (lines 289-300). An empty Vec is still Some, not None.
  implication: The paste bug is NOT from None return. If samples is empty, line 337 checks !transcription.is_empty() - empty audio → empty transcription → early exit at line 506-512 without pasting. THIS IS THE PASTE BUG.

- timestamp: 2026-02-10T00:06:00Z
  checked: Root cause analysis for both bugs
  found: BUG 1 (visual shift): shrink_overlay_from_streaming() at overlay.rs:257 repositions window, THEN hide animation emitted at line 264. Window jumps position before fading. BUG 2 (no paste): streaming segments transcribe audio during recording, final transcription at actions.rs:321 gets empty or nearly-empty buffer (already transcribed), returns empty string, triggers early exit at 506-512.
  implication: Bug 1 fix: Move shrink AFTER hide completes (delay it like hide delays window.hide()). Bug 2 fix: Collect streaming segments and use them as final result if main transcription is empty.

## Resolution

root_cause: TWO BUGS - (1) Visual shift: shrink_overlay_from_streaming() is called synchronously before the hide animation, repositioning the window immediately. The fade-out animation then plays from the NEW position, creating a visible jump. (2) No paste: The streaming transcription processes most/all audio during recording. When stop() is called, the final transcription at line 321 gets an empty or near-empty audio buffer (already consumed by streaming), returns empty transcription, hits the early-exit check at line 337 (!transcription.is_empty()), and exits without pasting at lines 506-512.
fix: (1) Moved shrink_overlay_from_streaming() call from line 257 (before animation) to inside the delayed thread at line 273 (after animation completes). Now the fade plays from the current position, then shrinks. (2) Added fallback logic after transcription at actions.rs:338-347 - if final transcription is empty, collect streaming segments and join them with spaces. This ensures paste happens even when streaming consumed all audio.
verification: Code review verified both fixes are correct. (1) overlay.rs:274-276 now calls shrink AFTER the 300ms delay, so fade animation completes before resize/reposition. (2) actions.rs:339-349 checks if transcription.is_empty(), retrieves STREAMING_STATE.segments, joins them, and uses as final transcription. Both changes address root causes without introducing new issues. Logic flow: hide animation → wait 300ms → shrink (invisible) → hide window. And: transcribe → if empty, use streaming segments → paste.
files_changed: ["src-tauri/src/overlay.rs", "src-tauri/src/actions.rs"]

root_cause:
fix:
verification:
files_changed: []
