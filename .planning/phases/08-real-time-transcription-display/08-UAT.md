---
status: testing
phase: 08-real-time-transcription-display
source: 08-01-SUMMARY.md, 08-02-SUMMARY.md, 08-03-SUMMARY.md
started: 2026-02-06T00:00:00Z
updated: 2026-02-06T00:00:00Z
---

## Current Test

number: 1
name: Transcription display appears during recording
expected: |
  When you trigger a recording shortcut, a dark translucent bar appears above the recording pill overlay. It should show a pulsing green dot on the left and "Listening..." placeholder text.
awaiting: user response

## Tests

### 1. Transcription display appears during recording
expected: When you trigger a recording shortcut, a dark translucent bar appears above the recording pill overlay. It should show a pulsing green dot on the left and "Listening..." placeholder text.
result: PASS (fixed: Tauri IPC events hung in secondary window, switched to DOM CustomEvents via eval())

### 2. Partial text streams in during recording
expected: While speaking for 5-10 seconds, partial transcription text begins appearing in the dark bar after ~2-3 seconds. Words should animate in with a spring effect.
result: [pending]

### 3. Auto-scroll as text grows
expected: If you speak for a longer period (15+ seconds), as text fills the display area it should auto-scroll to keep the newest text visible.
result: [pending]

### 4. Final text replaces streaming text
expected: When you stop recording, the streaming partial text is replaced by the final batch transcription result. The display should then hide after the text is pasted.
result: [pending]

### 5. Display hides on all exit paths
expected: The transcription display hides when: (a) recording completes normally, (b) you press ESC to cancel, (c) transcription produces empty result. No orphaned display windows.
result: [pending]

### 6. Click to dismiss
expected: Clicking anywhere on the dark transcription display bar dismisses/hides it.
result: [pending]

### 7. Existing transcription still works
expected: The normal transcription flow (record → transcribe → paste) still works correctly. Text is pasted to the active application as before.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0

## Gaps

[none yet]
