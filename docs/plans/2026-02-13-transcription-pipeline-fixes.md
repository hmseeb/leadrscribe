# Transcription Pipeline Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 6 issues in the streaming transcription pipeline: word duplication at window boundaries, unbounded memory growth, fragile eval-based event dispatch, stale eprintln! calls, broken case preservation in custom words, and weak phonetic matching.

**Architecture:** All fixes are scoped to the Rust backend (`src-tauri/src/`) and one React component (`src/overlay/RecordingOverlay.tsx`). Changes are isolated — each task touches different functions or sections of the same files. The streaming pipeline lives in `actions.rs`, custom word correction in `audio_toolkit/text.rs`, and overlay communication bridges `actions.rs` to `RecordingOverlay.tsx`.

**Tech Stack:** Rust (Tauri backend), `strsim` crate (already a dependency — has `jaro_winkler`), React/TypeScript (Tauri frontend), Tauri event system.

---

### Task 1: Fix `preserve_case_pattern` lowercase branch

The `preserve_case_pattern` function in `text.rs` doesn't lowercase the replacement when the original word is lowercase. If the original is `"hello"` and the custom word is `"WORLD"`, it returns `"WORLD"` instead of `"world"`.

**Files:**
- Modify: `src-tauri/src/audio_toolkit/text.rs:96-109` (function body)
- Test: `src-tauri/src/audio_toolkit/text.rs:155-159` (existing test, fix assertion)

**Step 1: Fix the failing test assertion**

The existing test at line 159 asserts the WRONG behavior. Fix it to expect lowercase output:

```rust
#[test]
fn test_preserve_case_pattern() {
    assert_eq!(preserve_case_pattern("HELLO", "world"), "WORLD");
    assert_eq!(preserve_case_pattern("Hello", "world"), "World");
    assert_eq!(preserve_case_pattern("hello", "WORLD"), "world");
}
```

**Step 2: Run test to verify it fails**

Run: `cargo test --lib test_preserve_case_pattern -- --nocapture` from `src-tauri/`
Expected: FAIL — `assertion failed: (left == right)` with left=`"WORLD"`, right=`"world"`

**Step 3: Fix the function**

In `preserve_case_pattern`, change the else branch (line 106-108) from:

```rust
} else {
    replacement.to_string()
}
```

to:

```rust
} else {
    replacement.to_lowercase()
}
```

**Step 4: Run test to verify it passes**

Run: `cargo test --lib test_preserve_case_pattern -- --nocapture` from `src-tauri/`
Expected: PASS

**Step 5: Commit**

```bash
git add src-tauri/src/audio_toolkit/text.rs
git commit -m "fix: preserve_case_pattern now lowercases when original is lowercase"
```

---

### Task 2: Replace Soundex with Jaro-Winkler for custom word matching

Soundex (1918 census algorithm) is too coarse for speech-to-text corrections. `strsim::jaro_winkler` is already available (strsim is a dependency in Cargo.toml) and handles transpositions and similar characters much better.

**Files:**
- Modify: `src-tauri/src/audio_toolkit/text.rs:1-2` (imports)
- Modify: `src-tauri/src/audio_toolkit/text.rs:48-78` (matching loop body)
- Test: `src-tauri/src/audio_toolkit/text.rs:135-176` (existing tests)
- Modify: `src-tauri/Cargo.toml:63` (remove `natural` dependency)

**Step 1: Write a new test for Jaro-Winkler matching behavior**

Add this test to the existing `#[cfg(test)] mod tests` block:

```rust
#[test]
fn test_apply_custom_words_transposition() {
    // Jaro-Winkler handles transpositions better than Levenshtein
    let text = "recieve the mesage";
    let custom_words = vec!["receive".to_string(), "message".to_string()];
    let result = apply_custom_words(text, &custom_words, 0.3);
    assert_eq!(result, "receive the message");
}

#[test]
fn test_apply_custom_words_no_false_positive() {
    // Short common words should not be corrected to unrelated custom words
    let text = "the cat sat";
    let custom_words = vec!["concatenate".to_string()];
    let result = apply_custom_words(text, &custom_words, 0.3);
    assert_eq!(result, "the cat sat");
}
```

**Step 2: Run tests to verify current state**

Run: `cargo test --lib test_apply_custom_words -- --nocapture` from `src-tauri/`
Note which tests pass/fail with the current Soundex+Levenshtein implementation.

**Step 3: Replace the matching algorithm**

In `text.rs`, change imports (lines 1-2) from:

```rust
use natural::phonetics::soundex;
use strsim::levenshtein;
```

to:

```rust
use strsim::jaro_winkler;
```

Replace the matching loop body (lines 48-78) — the `for (i, custom_word_lower)` loop — with:

```rust
for (i, custom_word_lower) in custom_words_lower.iter().enumerate() {
    // Skip if lengths are too different (optimization)
    let len_diff = (cleaned_word.len() as i32 - custom_word_lower.len() as i32).abs();
    if len_diff > 5 {
        continue;
    }

    // Jaro-Winkler: 0.0 = no similarity, 1.0 = exact match
    // Convert to distance: 0.0 = exact match, 1.0 = no similarity
    let jw_similarity = jaro_winkler(&cleaned_word, custom_word_lower);
    let distance = 1.0 - jw_similarity;

    if distance < threshold && distance < best_score {
        best_match = Some(&custom_words[i]);
        best_score = distance;
    }
}
```

**Step 4: Remove `natural` dependency from Cargo.toml**

In `src-tauri/Cargo.toml`, delete line 63:

```toml
natural = "0.5.0"
```

**Step 5: Run all text.rs tests**

Run: `cargo test --lib audio_toolkit::text -- --nocapture` from `src-tauri/`
Expected: ALL PASS (existing + new tests). The default threshold of 0.18 is very strict; adjust test thresholds if needed. The existing `test_apply_custom_words_fuzzy_match` test uses threshold 0.5 — Jaro-Winkler distance for "helo"→"hello" is ~0.07, well within 0.5.

**Step 6: Commit**

```bash
git add src-tauri/src/audio_toolkit/text.rs src-tauri/Cargo.toml
git commit -m "refactor: replace Soundex with Jaro-Winkler for custom word matching

Jaro-Winkler handles transpositions and similar characters better than
Soundex (1918 census algorithm). Removes natural dependency."
```

---

### Task 3: Replace `eprintln!` with log macros in actions.rs and transcription.rs

Two `eprintln!` calls in `actions.rs` (lines 498, 503) and three in `transcription.rs` (lines 338, 469, 488) should use `error!()` from the `log` crate for consistency with the rest of the codebase.

**Files:**
- Modify: `src-tauri/src/actions.rs:498,503`
- Modify: `src-tauri/src/managers/transcription.rs:338,469,488`

**Step 1: Replace in actions.rs**

Line 498 — change:
```rust
Err(e) => eprintln!("Failed to paste transcription: {}", e),
```
to:
```rust
Err(e) => error!("Failed to paste transcription: {}", e),
```

Line 503 — change:
```rust
eprintln!("Failed to run paste on main thread: {:?}", e);
```
to:
```rust
error!("Failed to run paste on main thread: {:?}", e);
```

Verify `use log::error;` is already imported. Current import at line 10 is `use log::{debug, error, info};` — `error` is already there.

**Step 2: Replace in transcription.rs**

Line 338 — change:
```rust
eprintln!("Failed to load model: {}", e);
```
to:
```rust
error!("Failed to load model: {}", e);
```

Line 469 — change:
```rust
eprintln!("Failed to immediately unload model: {}", e);
```
to:
```rust
error!("Failed to immediately unload model: {}", e);
```

Line 488 — change:
```rust
eprintln!("Failed to join idle watcher thread: {:?}", e);
```
to:
```rust
error!("Failed to join idle watcher thread: {:?}", e);
```

Verify `use log::error;` is imported. Current import at line 6 is `use log::{debug, info};` — add `error`:

```rust
use log::{debug, error, info};
```

**Step 3: Verify it compiles**

Run: `cargo check` from `src-tauri/`
Expected: No errors

**Step 4: Commit**

```bash
git add src-tauri/src/actions.rs src-tauri/src/managers/transcription.rs
git commit -m "fix: replace eprintln! with log::error! in actions and transcription"
```

---

### Task 4: Replace `window.eval()` with Tauri events for overlay communication

The streaming overlay uses `window.eval()` to dispatch DOM CustomEvents with manually escaped strings. This is fragile (missing escape for `\r`, `\t`, unicode, backticks) and doesn't use Tauri's built-in event system which handles serialization correctly. The non-streaming overlay events (`show-overlay`, `hide-overlay`, `mic-level`) already use proper Tauri events.

**Files:**
- Modify: `src-tauri/src/actions.rs:179-184,227,329,474-478,486,504,511,519`
- Modify: `src/overlay/RecordingOverlay.tsx:83-130`

**Step 1: Replace backend eval calls with Tauri emit**

In `actions.rs`, replace each `window.eval("document.dispatchEvent(new CustomEvent('td-*'...))` with `window.emit("td-*", payload)`.

**1a.** Line 227 — `td-show`:
```rust
// Before:
let _ = window.eval("document.dispatchEvent(new CustomEvent('td-show'))");
// After:
let _ = window.emit("td-show", ());
```

**1b.** Lines 179-185 — `td-partial`:
```rust
// Before:
if let Some(window) = app_for_display.get_webview_window("recording_overlay") {
    let escaped = display_text.replace('\\', "\\\\").replace('\'', "\\'").replace('\n', "\\n");
    let _ = window.eval(&format!(
        "document.dispatchEvent(new CustomEvent('td-partial', {{ detail: {{ text: '{}' }} }}))",
        escaped
    ));
}
// After:
if let Some(window) = app_for_display.get_webview_window("recording_overlay") {
    let _ = window.emit("td-partial", &display_text);
}
```

**1c.** Lines 472-478 — `td-final`:
```rust
// Before:
if let Some(window) = ah.get_webview_window("recording_overlay") {
    let escaped = final_text.replace('\\', "\\\\").replace('\'', "\\'").replace('\n', "\\n");
    let _ = window.eval(&format!(
        "document.dispatchEvent(new CustomEvent('td-final', {{ detail: {{ text: '{}' }} }}))",
        escaped
    ));
}
// After:
if let Some(window) = ah.get_webview_window("recording_overlay") {
    let _ = window.emit("td-final", &final_text);
}
```

**1d.** All `td-hide` eval calls — there are multiple locations. Replace each:
```rust
// Before:
let _ = window.eval("document.dispatchEvent(new CustomEvent('td-hide'))");
// After:
let _ = window.emit("td-hide", ());
```

Locations in `actions.rs`:
- Line 329
- Line 486
- Line 504
- Line 511
- Line 519

**Step 2: Replace frontend DOM listeners with Tauri event listeners**

In `RecordingOverlay.tsx`, replace the entire second `useEffect` block (lines 83-130) — the one with DOM CustomEvent listeners — with Tauri `listen()` calls:

```typescript
// Streaming transcription listeners (via Tauri events)
useEffect(() => {
  const setupStreamingListeners = async () => {
    const unlistenShow = await listen("td-show", () => {
      console.log("[RecordingOverlay] td-show");
      setIsStreaming(true);
      setWords([]);
    });

    const unlistenHide = await listen("td-hide", () => {
      console.log("[RecordingOverlay] td-hide");
      setIsStreaming(false);
    });

    const unlistenPartial = await listen<string>("td-partial", (event) => {
      const text = event.payload as string;
      console.log("[RecordingOverlay] td-partial", text);
      const newWords = text.split(/\s+/).filter((w: string) => w.length > 0);
      setWords(newWords);
    });

    const unlistenFinal = await listen<string>("td-final", (event) => {
      const text = event.payload as string;
      console.log("[RecordingOverlay] td-final");
      const finalWords = text.split(/\s+/).filter((w: string) => w.length > 0);
      setWords(finalWords);
      setIsStreaming(false);
    });

    return () => {
      unlistenShow();
      unlistenHide();
      unlistenPartial();
      unlistenFinal();
    };
  };

  setupStreamingListeners();
}, []);
```

Note: The `td-clear` event was only handled in the frontend but never emitted from the backend. Remove the listener for it. If needed later, it can be re-added as a Tauri event.

**Step 3: Verify it compiles**

Run: `cargo check` from `src-tauri/`
Expected: No errors

**Step 4: Verify frontend builds**

Run: `bun run build`
Expected: No TypeScript errors

**Step 5: Commit**

```bash
git add src-tauri/src/actions.rs src/overlay/RecordingOverlay.tsx
git commit -m "refactor: replace window.eval() with Tauri events for overlay streaming

Migrates td-show, td-partial, td-final, td-hide from fragile eval-based
DOM CustomEvents to proper Tauri window.emit() calls. Fixes missing
escape sequences for special characters in transcribed text."
```

---

### Task 5: Fix word duplication at window boundaries

When a recording exceeds 10 seconds, the sliding transcription window overlaps with the previous window. The current code naively concatenates `committed_text + " " + window_result`, causing duplicated words at the boundary. For example: "the quick brown fox" + " " + "brown fox jumps" = "the quick brown fox brown fox jumps".

Fix: detect overlapping suffix/prefix between committed text and new window result, merge without duplication.

**Files:**
- Modify: `src-tauri/src/actions.rs:160-175` (display text construction)
- Test: `src-tauri/src/actions.rs` (new `#[cfg(test)]` module)

**Step 1: Write failing tests for the merge function**

Add a new `#[cfg(test)]` module at the bottom of `actions.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::merge_overlapping_text;

    #[test]
    fn test_merge_no_overlap() {
        let result = merge_overlapping_text("hello world", "foo bar");
        assert_eq!(result, "hello world foo bar");
    }

    #[test]
    fn test_merge_with_overlap() {
        let result = merge_overlapping_text(
            "the quick brown fox jumps",
            "brown fox jumps over the lazy dog",
        );
        assert_eq!(result, "the quick brown fox jumps over the lazy dog");
    }

    #[test]
    fn test_merge_full_overlap() {
        let result = merge_overlapping_text("hello world foo", "hello world foo");
        assert_eq!(result, "hello world foo");
    }

    #[test]
    fn test_merge_empty_committed() {
        let result = merge_overlapping_text("", "hello world");
        assert_eq!(result, "hello world");
    }

    #[test]
    fn test_merge_empty_new() {
        let result = merge_overlapping_text("hello world", "");
        assert_eq!(result, "hello world");
    }

    #[test]
    fn test_merge_single_word_overlap_ignored() {
        // Single common words like "the" should not trigger dedup
        let result = merge_overlapping_text("I saw the", "the cat");
        assert_eq!(result, "I saw the the cat");
    }

    #[test]
    fn test_merge_case_insensitive() {
        let result = merge_overlapping_text(
            "Hello World Foo",
            "hello world foo bar baz",
        );
        assert_eq!(result, "Hello World Foo bar baz");
    }
}
```

**Step 2: Run tests to verify they fail**

Run: `cargo test --lib actions::tests -- --nocapture` from `src-tauri/`
Expected: FAIL — `merge_overlapping_text` does not exist

**Step 3: Implement the merge function**

Add this function to `actions.rs` (above the `StreamingState` struct, e.g., after the imports):

```rust
/// Merges two overlapping text segments by detecting shared suffix/prefix.
/// Requires at least 2 matching words to trigger dedup (avoids false positives
/// on common single words like "the", "a", "and").
fn merge_overlapping_text(committed: &str, new_text: &str) -> String {
    if committed.is_empty() {
        return new_text.to_string();
    }
    if new_text.is_empty() {
        return committed.to_string();
    }

    let committed_words: Vec<&str> = committed.split_whitespace().collect();
    let new_words: Vec<&str> = new_text.split_whitespace().collect();

    let max_overlap = committed_words.len().min(new_words.len());
    let mut best_overlap = 0;

    // Find longest suffix of committed that matches prefix of new (case-insensitive)
    // Require at least 2 words to avoid false positives on common words
    for overlap_len in (2..=max_overlap).rev() {
        let committed_suffix = &committed_words[committed_words.len() - overlap_len..];
        let new_prefix = &new_words[..overlap_len];

        let matches = committed_suffix
            .iter()
            .zip(new_prefix.iter())
            .all(|(a, b)| a.to_lowercase() == b.to_lowercase());

        if matches {
            best_overlap = overlap_len;
            break; // Longest match found (iterating from largest to smallest)
        }
    }

    if best_overlap > 0 {
        let remaining = &new_words[best_overlap..];
        if remaining.is_empty() {
            committed.to_string()
        } else {
            format!("{} {}", committed, remaining.join(" "))
        }
    } else {
        format!("{} {}", committed, new_text)
    }
}
```

**Step 4: Run tests to verify they pass**

Run: `cargo test --lib actions::tests -- --nocapture` from `src-tauri/`
Expected: ALL PASS

**Step 5: Wire the merge function into the streaming pipeline**

In `actions.rs`, replace the display text construction (lines 160-175):

```rust
// Before:
let display_text = if is_windowed {
    let committed = STREAMING_STATE.committed_text.lock().unwrap().clone();
    let prev_latest = STREAMING_STATE.latest_text.lock().unwrap().clone();
    if !prev_latest.is_empty() {
        *STREAMING_STATE.committed_text.lock().unwrap() = prev_latest;
    }
    if committed.is_empty() {
        text.clone()
    } else {
        format!("{} {}", committed, text)
    }
} else {
    text.clone()
};
```

```rust
// After:
let display_text = if is_windowed {
    let committed = STREAMING_STATE.committed_text.lock().unwrap().clone();
    let prev_latest = STREAMING_STATE.latest_text.lock().unwrap().clone();
    if !prev_latest.is_empty() {
        *STREAMING_STATE.committed_text.lock().unwrap() = prev_latest;
    }
    merge_overlapping_text(&committed, &text)
} else {
    text.clone()
};
```

**Step 6: Verify it compiles**

Run: `cargo check` from `src-tauri/`
Expected: No errors

**Step 7: Commit**

```bash
git add src-tauri/src/actions.rs
git commit -m "fix: deduplicate words at streaming window boundaries

Adds merge_overlapping_text() that detects shared suffix/prefix between
committed text and new window result. Requires 2+ matching words to
avoid false positives on common words. Fixes word duplication in
recordings longer than 10 seconds."
```

---

### Task 6: Cap streaming audio buffer to prevent unbounded memory growth

The `audio_buffer` in `StreamingState` grows for the entire recording duration. A 30-minute recording at 16kHz = ~115 MB just for the streaming buffer, which is separate from the actual recording buffer in `AudioRecordingManager`. Since streaming only uses the last 10-second window, older audio can be discarded.

**Files:**
- Modify: `src-tauri/src/actions.rs:25-84` (StreamingState methods)
- Modify: `src-tauri/src/actions.rs:127-129` (call trim after marking length)

**Step 1: Add a `trim_buffer` method to StreamingState**

Add this method to the `impl StreamingState` block (after `clone_audio_window`):

```rust
/// Trims the audio buffer to keep only recent audio, preventing unbounded growth.
/// Adjusts `last_transcribed_len` to account for removed samples.
fn trim_buffer(&self, max_seconds: f64) {
    let max_samples = (max_seconds * 16000.0) as usize;
    let margin = (2.0 * 16000.0) as usize; // 2s margin to avoid boundary issues
    let limit = max_samples + margin;

    let mut buf = self.audio_buffer.lock().unwrap();
    if buf.len() > limit {
        let trim_amount = buf.len() - limit;
        buf.drain(..trim_amount);

        // Adjust last_transcribed_len to stay consistent with trimmed buffer
        let old_len = self.last_transcribed_len.load(Ordering::Acquire);
        self.last_transcribed_len.store(
            old_len.saturating_sub(trim_amount),
            Ordering::Release,
        );
    }
}
```

**Step 2: Call trim after each transcription trigger**

In the segment listener (around line 129, after `STREAMING_STATE.last_transcribed_len.store(...)`), add the trim call:

```rust
// Mark current buffer length as "transcribed up to here"
let buf_len = STREAMING_STATE.audio_buffer.lock().unwrap().len();
STREAMING_STATE.last_transcribed_len.store(buf_len, Ordering::Release);

// Trim buffer to prevent unbounded memory growth
STREAMING_STATE.trim_buffer(MAX_WINDOW_SECONDS);
```

**Step 3: Verify it compiles**

Run: `cargo check` from `src-tauri/`
Expected: No errors

**Step 4: Commit**

```bash
git add src-tauri/src/actions.rs
git commit -m "fix: cap streaming audio buffer to prevent unbounded memory growth

Trims the streaming buffer to MAX_WINDOW_SECONDS + 2s margin after each
transcription trigger. A 30-minute recording no longer accumulates
~115MB in the streaming buffer."
```

---

## Verification

After all tasks are complete:

1. `cargo check` from `src-tauri/` — no errors
2. `cargo test --lib` from `src-tauri/` — all tests pass
3. `bun run build` — frontend builds without errors
4. Manual test: record for >15 seconds and verify no word duplication in overlay
5. Manual test: add a custom word and verify corrections work with the new Jaro-Winkler matching
