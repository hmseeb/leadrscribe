---
phase: quick
plan: 005
type: execute
wave: 1
depends_on: []
files_modified:
  - src/overlay/RecordingOverlay.tsx
  - src/index.css
  - src-tauri/src/overlay.rs
  - src-tauri/src/actions.rs
  - src-tauri/src/lib.rs
  - vite.config.ts
autonomous: true

must_haves:
  truths:
    - "Streaming transcription text appears directly above the recording pill during dictation"
    - "The overlay window resizes dynamically when streaming text is present"
    - "The separate transcription_display window no longer appears"
    - "Words animate in one by one as before (spring animation)"
    - "Overlay pill retains its current size and appearance during recording/transcribing/ghostwriting states"
  artifacts:
    - path: "src/overlay/RecordingOverlay.tsx"
      provides: "Integrated streaming text display above the pill"
    - path: "src-tauri/src/overlay.rs"
      provides: "Dynamic window resizing, removed transcription_display window code"
    - path: "src-tauri/src/actions.rs"
      provides: "Streaming events routed to recording_overlay window"
  key_links:
    - from: "src-tauri/src/actions.rs"
      to: "recording_overlay window"
      via: "window.eval() with td-partial/td-final DOM CustomEvents"
      pattern: 'get_webview_window\("recording_overlay"\).*eval.*td-partial'
    - from: "src/overlay/RecordingOverlay.tsx"
      to: "DOM CustomEvents"
      via: "document.addEventListener for td-show/td-partial/td-final"
      pattern: "addEventListener.*td-partial"
---

<objective>
Merge the streaming transcription display into the recording overlay. Instead of two separate windows (a small pill overlay + a wide 600px transcription display), consolidate into a single overlay window where streaming text appears in a compact area above the pill. Remove the separate transcription_display window entirely.

Purpose: Simpler UX - one cohesive overlay instead of two floating windows. More compact streaming display.
Output: Single overlay window that expands vertically when streaming text arrives, with the pill at the bottom and text above.
</objective>

<execution_context>
@C:\Users\hsbaz\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\hsbaz\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/overlay/RecordingOverlay.tsx
@src/overlay/TranscriptionDisplay.tsx
@src/overlay/main.tsx
@src-tauri/src/overlay.rs
@src-tauri/src/actions.rs
@src-tauri/src/lib.rs
@src/index.css (lines 464-671 for overlay and transcription display styles)
@vite.config.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Merge streaming display into RecordingOverlay frontend + update CSS</name>
  <files>
    src/overlay/RecordingOverlay.tsx
    src/index.css
  </files>
  <action>
  Integrate the streaming transcription text display into RecordingOverlay.tsx. The streaming text should appear ABOVE the pill, within the same component.

  **RecordingOverlay.tsx changes:**

  1. Add streaming state: `words` (string[]), `isStreaming` (boolean), `prevWordCountRef`, `scrollRef`, `shouldAutoScroll` - mirror the logic from TranscriptionDisplay.tsx.

  2. Add DOM CustomEvent listeners (same pattern as TranscriptionDisplay.tsx uses, since Tauri IPC events hang in secondary windows):
     - `td-show`: Set isStreaming=true, clear words
     - `td-hide`: Set isStreaming=false
     - `td-partial`: Parse words from event detail, append to words array
     - `td-final`: Replace words with final text, set isStreaming=false
     - `td-clear`: Clear words array

  3. Update the JSX layout. Change from flat pill to a vertical flex column layout:
     ```
     <div className="overlay-container"> (now flex-col, align-items: center, justify-content: flex-end)
       {isStreaming || words.length > 0 ? (
         <AnimatePresence>
           <motion.div className="streaming-text-area"> (compact floating text area above pill)
             {words.map(...)} with spring word animations (same wordVariants as TranscriptionDisplay)
           </motion.div>
         </AnimatePresence>
       ) : null}
       <motion.div className="recording-overlay"> (existing pill, unchanged)
         ...existing pill content...
       </motion.div>
     </div>
     ```

  4. The streaming text area should animate in/out with opacity+y transition. Max width ~320px (compact, NOT 600px like the old window). Max height ~120px with overflow-y auto.

  5. Use `getCurrentWindow()` to call `setSize()` when streaming state changes:
     - No streaming: 280x90 (original size)
     - Streaming active: 360x230 (wider for text, taller for text area above pill)
     - Import `LogicalSize` from `@tauri-apps/api/dpi`
     - Call `getCurrentWindow().setSize(new LogicalSize(width, height))` in a useEffect that watches `isStreaming` and `words.length`
     - Also reposition: when streaming starts, shift window UP so the pill stays in the same screen position. Use `getCurrentWindow().outerPosition()` to get current position, then `setPosition()` to move up by the height difference.

  6. Auto-scroll: Copy the auto-scroll useEffect from TranscriptionDisplay.tsx.

  7. Keep the `wordVariants` animation from TranscriptionDisplay.tsx (spring, stiffness 500, damping 30).

  **src/index.css changes:**

  1. Update `.overlay-container` to use `flex-direction: column; justify-content: flex-end;` so the pill is at the bottom.

  2. Add new `.streaming-text-area` styles:
     ```css
     .streaming-text-area {
       max-width: 320px;
       max-height: 120px;
       overflow-y: auto;
       padding: 10px 14px;
       margin-bottom: 8px;
       background: color-mix(in oklch, var(--popover) 90%, transparent);
       border: 0.5px solid color-mix(in oklch, var(--border) 40%, transparent);
       border-radius: 12px;
       backdrop-filter: blur(24px);
       box-shadow: var(--shadow-lg);
       line-height: 1.5;
       scrollbar-width: thin;
       scrollbar-color: oklch(1 0 0 / 0.15) transparent;
     }
     ```

  3. Reuse `.transcription-word` and `.transcription-placeholder` styles (keep them, they still apply).

  4. Remove the entire `.transcription-display-container` and `.transcription-display` CSS blocks (lines 591-671) as they are no longer needed. Also remove the `.transcription-display-container` entries from the transparent background rules (lines 417-419).

  5. Add scrollbar styles for `.streaming-text-area::-webkit-scrollbar` (4px width, same as old transcription display).

  IMPORTANT: Do NOT change anything about the `.recording-overlay` pill styling itself. It stays the same width, height, and appearance.
  </action>
  <verify>
  Run `bun run build` to confirm TypeScript compiles without errors. Visually inspect the built output to confirm no compile errors.
  </verify>
  <done>
  RecordingOverlay.tsx renders streaming text above the pill, handles td-show/td-partial/td-final/td-hide DOM events, dynamically resizes the window, and the CSS is updated with streaming-text-area styles. Old transcription-display-specific CSS is removed.
  </done>
</task>

<task type="auto">
  <name>Task 2: Route backend events to recording_overlay and remove transcription_display window</name>
  <files>
    src-tauri/src/overlay.rs
    src-tauri/src/actions.rs
    src-tauri/src/lib.rs
    vite.config.ts
    src/overlay/transcription-display.html
    src/overlay/transcription-display-main.tsx
    src/overlay/TranscriptionDisplay.tsx
  </files>
  <action>
  **src-tauri/src/actions.rs changes:**

  1. In `setup_segment_listener` (line 152-159): Change `get_webview_window("transcription_display")` to `get_webview_window("recording_overlay")`. The eval() call and CustomEvent dispatch remain identical - just target the recording_overlay window instead.

  2. In `TranscribeAction::start` (line 197): Remove `crate::overlay::show_transcription_display(app);`. Instead, send `td-show` event to recording_overlay:
     ```rust
     if let Some(window) = app.get_webview_window("recording_overlay") {
         let _ = window.eval("document.dispatchEvent(new CustomEvent('td-show'))");
     }
     ```

  3. In `TranscribeAction::stop`:
     - Line 259: Change flush `get_webview_window("transcription_display")` to `get_webview_window("recording_overlay")`.
     - Lines 326, 477, 494, 499, 505: Remove ALL `crate::overlay::hide_transcription_display(&ah);` calls. Instead, send `td-hide` to recording_overlay:
       ```rust
       if let Some(window) = ah.get_webview_window("recording_overlay") {
           let _ = window.eval("document.dispatchEvent(new CustomEvent('td-hide'))");
       }
       ```
       Place this BEFORE `utils::hide_recording_overlay(&ah)` in each location so the text hides before the pill animates out.
     - Line 463: Change `get_webview_window("transcription_display")` to `get_webview_window("recording_overlay")` for the td-final event.

  **src-tauri/src/overlay.rs changes:**

  1. Remove these constants: `TRANSCRIPTION_DISPLAY_WIDTH`, `TRANSCRIPTION_DISPLAY_HEIGHT`, `DISPLAY_SPACING`.
  2. Remove the entire `calculate_transcription_display_position` function.
  3. Remove the entire `create_transcription_display` function.
  4. Remove the entire `show_transcription_display` function.
  5. Remove the entire `hide_transcription_display` function.

  **src-tauri/src/lib.rs changes:**

  1. Remove line 165-166: `utils::create_transcription_display(app_handle);` - no longer need to create the separate window at startup.

  **vite.config.ts changes:**

  1. Remove the `"transcription-display"` entry from `rollupOptions.input` (line 18). Only `main` and `overlay` entries remain.

  **Delete files (do NOT just empty them - actually remove them):**
  - `src/overlay/transcription-display.html`
  - `src/overlay/transcription-display-main.tsx`
  - `src/overlay/TranscriptionDisplay.tsx`

  Use `git rm` or file system delete for these files.
  </action>
  <verify>
  Run `bun run build` to confirm the project builds without errors. Verify that `transcription_display` does not appear anywhere in the compiled output by searching the build output. Run `cargo check --manifest-path src-tauri/Cargo.toml` to confirm Rust compiles.
  </verify>
  <done>
  All streaming events route to recording_overlay window. The transcription_display window, its creation, show/hide functions, HTML entry, React component, and Vite config entry are fully removed. Project builds cleanly.
  </done>
</task>

</tasks>

<verification>
1. `bun run build` succeeds (frontend compiles)
2. `cargo check --manifest-path src-tauri/Cargo.toml` succeeds (Rust compiles)
3. No references to `transcription_display` remain in source (grep confirms)
4. Manual test: Start recording, speak, see streaming text appear above the pill in a compact area
5. Manual test: Stop recording, overlay shows "Transcribing...", then hides after paste
6. Manual test: The overlay pill itself looks unchanged (same size, same dark pill appearance)
</verification>

<success_criteria>
- Single overlay window handles both the recording pill and streaming text display
- Streaming text appears in a compact area above the pill (max ~320px wide, not 600px)
- Words animate in with spring transitions
- The separate transcription_display window is completely removed (code, HTML, CSS, Vite entry)
- Project builds without errors on both frontend and backend
</success_criteria>

<output>
After completion, create `.planning/quick/005-merge-streaming-into-overlay/005-SUMMARY.md`
</output>
