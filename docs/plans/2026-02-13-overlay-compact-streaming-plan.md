# Overlay Compact-First Streaming Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the overlay start compact and only expand when first streaming text arrives, show max 2 lines by default, and grow taller when user scrolls up.

**Architecture:** CSS-driven visual transitions with React state gating. Rust pre-sizes the transparent window on `td-show` (invisible beyond pill), frontend controls when the pill visually expands via CSS classes. Scroll state tracked in React to toggle between 2-line and 6-line max-height.

**Tech Stack:** React + Framer Motion (overlay component), CSS transitions (width/height), Rust/Tauri (window sizing)

---

### Task 1: CSS — Change streaming text to 2-line default and add expanded class

**Files:**
- Modify: `src/index.css:602-609` (`.streaming-text-inline`)
- Modify: `src/index.css:500-504` (after `.overlay-streaming`)

**Step 1: Change `.streaming-text-inline` max-height from 80px to 34px and add transition**

In `src/index.css`, replace lines 602-609:

```css
/* BEFORE */
.streaming-text-inline {
  padding: 8px 12px 2px;
  max-height: 80px;
  overflow-y: auto;
  line-height: 1.4;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in oklch, var(--muted-foreground) 30%, transparent) transparent;
}

/* AFTER */
.streaming-text-inline {
  padding: 8px 12px 2px;
  max-height: 34px;
  overflow-y: auto;
  line-height: 1.4;
  transition: max-height 180ms ease-out;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in oklch, var(--muted-foreground) 30%, transparent) transparent;
}
```

**Step 2: Add `.streaming-text-expanded` class after `.overlay-streaming`**

Insert after `src/index.css:504` (after `.overlay-streaming` closing brace):

```css
/* Expanded streaming text - user scrolled up to read history */
.streaming-text-expanded {
  max-height: 140px;
}
```

**Step 3: Verify visually**

Run: `bun run dev` (or `run-dev.bat`)
Expected: Overlay still functions, streaming text area visually shorter.

**Step 4: Commit**

```bash
git add src/index.css
git commit -m "style: limit streaming text to 2 lines, add expanded scroll class"
```

---

### Task 2: React — Gate width expansion on first content, not streaming start

**Files:**
- Modify: `src/overlay/RecordingOverlay.tsx:22-26` (state declarations)
- Modify: `src/overlay/RecordingOverlay.tsx:86-101` (streaming listeners)
- Modify: `src/overlay/RecordingOverlay.tsx:146-150` (scroll handler)
- Modify: `src/overlay/RecordingOverlay.tsx:152` (`hasStreamingContent`)
- Modify: `src/overlay/RecordingOverlay.tsx:180-184` (CSS class application)
- Modify: `src/overlay/RecordingOverlay.tsx:198-216` (streaming text section)

**Step 1: Add new state and refs**

At `src/overlay/RecordingOverlay.tsx:26`, after `const [shouldAutoScroll, setShouldAutoScroll] = useState(true);`, add:

```tsx
const [isScrolledUp, setIsScrolledUp] = useState(false);
const scrollIdleTimerRef = useRef<ReturnType<typeof setTimeout>>();
```

**Step 2: Update `td-show` to NOT set streaming content visible**

In the `td-show` listener (line 86-90), add resets for new state:

```tsx
const unlistenShow = await listen("td-show", () => {
  console.log("[RecordingOverlay] td-show");
  setIsStreaming(true);
  setWords([]);
  setIsScrolledUp(false);
  setShouldAutoScroll(true);
});
```

**Step 3: Update `td-hide` to reset all streaming state**

In the `td-hide` listener (line 92-95):

```tsx
const unlistenHide = await listen("td-hide", () => {
  console.log("[RecordingOverlay] td-hide");
  setIsStreaming(false);
  setIsScrolledUp(false);
  setShouldAutoScroll(true);
  if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current);
});
```

**Step 4: Update `td-partial` to shrink back if user stopped scrolling**

Replace the `td-partial` listener (lines 97-102):

```tsx
const unlistenPartial = await listen<string>("td-partial", (event) => {
  const text = event.payload as string;
  console.log("[RecordingOverlay] td-partial", text);
  const newWords = text.split(/\s+/).filter((w: string) => w.length > 0);
  setWords(newWords);

  // If user was scrolled up but idle for 500ms, shrink back and resume auto-scroll
  setIsScrolledUp((prev) => {
    if (prev && !scrollIdleTimerRef.current) {
      // Timer already expired — collapse
      setShouldAutoScroll(true);
      return false;
    }
    return prev;
  });
});
```

**Step 5: Update scroll handler with idle timer**

Replace the `handleScroll` function (lines 146-150):

```tsx
const handleScroll = () => {
  if (!scrollRef.current) return;
  const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
  const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;

  if (isAtBottom) {
    // User scrolled back to bottom — collapse immediately
    setIsScrolledUp(false);
    setShouldAutoScroll(true);
    if (scrollIdleTimerRef.current) {
      clearTimeout(scrollIdleTimerRef.current);
      scrollIdleTimerRef.current = undefined;
    }
  } else {
    // User scrolled up — expand and start idle timer
    setIsScrolledUp(true);
    setShouldAutoScroll(false);

    // Reset idle timer on each scroll event (debounce 500ms)
    if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current);
    scrollIdleTimerRef.current = setTimeout(() => {
      scrollIdleTimerRef.current = undefined;
      // Don't collapse here — next td-partial will check and collapse
    }, 500);
  }
};
```

**Step 6: Change `hasStreamingContent` to gate on actual words**

Replace line 152:

```tsx
// Before:
const hasStreamingContent = isStreaming || words.length > 0;

// After — only show streaming UI when we have actual content:
const hasWords = words.length > 0;
const hasStreamingContent = isStreaming || hasWords;
```

**Step 7: Gate `overlay-streaming` class on `hasWords` instead of `hasStreamingContent`**

Replace lines 180-185 (the className in the motion.div):

```tsx
className={cn(
  "recording-overlay",
  "fade-in",
  `overlay-state-${state}`,
  hasWords && "overlay-streaming"
)}
```

This is the key change: the pill only widens when actual words have arrived, not when streaming starts.

**Step 8: Add `streaming-text-expanded` class to the text container**

Replace line 200 (the streaming text div):

```tsx
<motion.div
  className={cn(
    "streaming-text-inline",
    isScrolledUp && "streaming-text-expanded"
  )}
  ref={scrollRef}
  onScroll={handleScroll}
  initial={{ opacity: 0, height: 0 }}
  animate={{ opacity: 1, height: "auto" }}
  exit={{ opacity: 0, height: 0 }}
  transition={{ duration: 0.2 }}
>
```

**Step 9: Commit**

```bash
git add src/overlay/RecordingOverlay.tsx
git commit -m "feat: compact-first overlay — expand on first content, 2-line default with scroll expansion"
```

---

### Task 3: Rust — Increase STREAMING_HEIGHT for scroll-expanded state

**Files:**
- Modify: `src-tauri/src/overlay.rs:17` (`STREAMING_HEIGHT` constant)

**Step 1: Increase STREAMING_HEIGHT**

In `src-tauri/src/overlay.rs`, change line 17:

```rust
// Before:
const STREAMING_HEIGHT: f64 = 160.0;

// After — accommodate 6-line expanded text area (140px) + controls (42px) + padding (48px):
const STREAMING_HEIGHT: f64 = 230.0;
```

The transparent window needs to be tall enough for the max expanded state. Since it's transparent, the extra space is invisible.

**Step 2: Commit**

```bash
git add src-tauri/src/overlay.rs
git commit -m "fix: increase streaming window height for scroll-expanded text"
```

---

### Task 4: Manual smoke test

**Step 1: Run dev build**

Run: `run-dev.bat` (or `bun run tauri dev`)

**Step 2: Test compact-first behavior**

1. Trigger recording via shortcut
2. Verify overlay appears as compact pill (195px width, no text area)
3. Speak — first `td-partial` should arrive and pill widens to 380px with 2-line text area
4. Continue speaking — text auto-scrolls at bottom, only 2 lines visible

**Step 3: Test scroll expansion**

1. During active streaming, scroll up in the text area
2. Verify text area grows taller (~6 lines visible)
3. Stop scrolling, wait ~500ms, then continue speaking
4. Verify text area shrinks back to 2 lines and auto-scroll resumes

**Step 4: Test edge cases**

- Very short recording (no streaming text at all) — pill should stay compact
- Stop recording while scrolled up — overlay should hide cleanly
- Rapid scroll up/down — no flickering or state desync
