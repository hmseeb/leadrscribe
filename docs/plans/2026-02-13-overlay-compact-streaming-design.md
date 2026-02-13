# Overlay Compact-First Streaming Design

## Problem

The overlay immediately jumps to full streaming width (380px) when streaming starts, before any text has arrived. The text area uses a fixed 80px max-height showing many lines, when most of the time only the latest 1-2 lines matter.

## Design

### Behavior

1. **Start compact** - When recording begins and `td-show` fires, the pill stays at normal 195px width. No visual expansion yet.

2. **Expand on first content** - When first `td-partial` arrives with actual words, CSS transitions the pill to 380px wide and reveals a 2-line text area (~34px height).

3. **Grow on scroll-up** - When user scrolls up in the text area, it smoothly grows to ~140px (roughly 6 lines) to show history.

4. **Shrink back on new text** - When new `td-partial` arrives and user hasn't scrolled in ~500ms, collapse back to 2 lines and resume auto-scroll at bottom.

### Implementation

**Rust (`overlay.rs`):**
- `expand_overlay_for_streaming()` still called on `td-show` to pre-size the transparent window for max expansion. The window is invisible beyond the pill, so extra space has no visual impact.
- Increase `STREAMING_HEIGHT` to accommodate the scroll-expanded state (~220px to fit 6-line text area + controls + shadow padding).

**React (`RecordingOverlay.tsx`):**
- New state: `hasContent` - becomes true when first `td-partial` delivers words.
- New state: `isScrolledUp` - true when user has scrolled up from bottom.
- New ref: `scrollIdleTimer` - 500ms debounce to detect when user stops scrolling.
- Apply `overlay-streaming` CSS class only when `hasContent` is true (not on `isStreaming` alone).
- On scroll event: if scrolled away from bottom, set `isScrolledUp = true` and add `overlay-expanded` class.
- On `td-partial`: if `isScrolledUp` and scroll idle timer expired, reset to compact (2 lines), clear `isScrolledUp`, resume auto-scroll.
- Reset all state on `td-hide`.

**CSS (`index.css`):**
- `.streaming-text-inline` default: `max-height: 34px` (2 lines at 12px * 1.4 line-height).
- New `.streaming-text-expanded`: `max-height: 140px` (6 lines).
- Both use `transition: max-height 180ms ease-out` for smooth grow/shrink.
- `.overlay-streaming` width transition unchanged (195px -> 380px).
