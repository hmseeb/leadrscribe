# Phase 1: Foundation - Overlay Redesign - Research

**Researched:** 2026-02-04
**Domain:** Floating overlay UI with animations (React/Tauri)
**Confidence:** HIGH

## Summary

Phase 1 focuses on redesigning the existing recording overlay from a basic functional component to a WisprFlow-style minimal floating pill with dark theme, smooth animations, and configurable positioning. The current implementation (`src/overlay/RecordingOverlay.tsx`) already has solid foundations: Framer Motion animations, event-driven architecture, ESC cancellation, and a robust window lifecycle system that handles cross-platform issues (sleep/wake, multi-monitor).

The redesign is a **refinement, not a rewrite**. Key changes are visual (WisprFlow-style pill shape, improved animations, dark theme) and behavioral (configurable position including cursor-follow). The technical infrastructure is proven and should be preserved.

**Primary recommendation:** Keep existing Rust overlay lifecycle management (`overlay.rs` health check system), keep Framer Motion animation patterns, focus on visual redesign with enhanced animation choreography. Add cursor-follow positioning logic using existing monitor detection code.

## Standard Stack

The established libraries/tools for floating overlay UI in React/Tauri:

### Core (Already Installed - KEEP)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Framer Motion | ^12.23.24 | Animation & transitions | Industry standard for React animations in 2026, 30.6k GitHub stars, 8.1M weekly NPM downloads. AnimatePresence for enter/exit, layout animations for position changes. |
| React | 18.3.1 | UI framework | React 18 concurrent features (startTransition, useDeferredValue) perfect for overlay performance. |
| Tailwind CSS | ^4.1.16 | Styling | Tailwind v4 is 10x faster than v3, zero-runtime, compile-time CSS. Perfect for minimal dark themes. |
| Tauri | 2.x | Desktop framework | WebviewWindow API for overlay creation, multi-monitor support, event system for Rust<->React communication. |

### Supporting (Already Installed - KEEP)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| clsx | ^2.1.1 | Conditional classes | Composing className strings for animation states |
| tailwind-merge | ^3.4.0 | Class deduplication | Preventing Tailwind class conflicts in cn() utility |
| Lucide React | ^0.542.0 | Icons | Microphone, processing, error icons for overlay states |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Framer Motion | React Spring | More complex API, larger bundle. Framer Motion's declarative approach is simpler. |
| Framer Motion | CSS animations | Less dynamic control over state transitions and orchestration. |
| Tailwind CSS | CSS-in-JS | 48% worse performance, runtime overhead. Tailwind v4 is faster. |

**Installation:**
```bash
# No new dependencies needed - all already installed
# Current stack is optimal for this phase
```

## Architecture Patterns

### Current Overlay Architecture (KEEP THIS)

The existing overlay architecture is well-designed and should be preserved:

```
Rust Backend (overlay.rs)
├─ Window Lifecycle Management
│  ├─ create_recording_overlay() - Creates window at startup (hidden)
│  ├─ show_recording_overlay() - Calculates position, shows with retry
│  ├─ hide_recording_overlay() - Fade-out delay, then hide
│  └─ ensure_overlay_exists() - Health check, recreates if stale
├─ Position Calculation
│  ├─ get_monitor_with_cursor() - Finds monitor containing cursor
│  ├─ calculate_overlay_position() - Top/Bottom based on settings
│  └─ update_overlay_position() - Re-position on monitor change
└─ Event Emission
   ├─ emit("show-overlay", state) - Recording/Transcribing/Ghostwriting
   ├─ emit("hide-overlay") - Triggers fade-out
   └─ emit("mic-level", levels) - Audio bars data

React Frontend (RecordingOverlay.tsx)
├─ Event Listeners (Pure Reactive)
│  ├─ listen("show-overlay") → setState, setVisible
│  ├─ listen("hide-overlay") → setVisible(false)
│  ├─ listen("mic-level") → Smoothed audio bars
│  └─ listen("ghostwriter-error") → Error display
├─ Component State (Ephemeral Only)
│  ├─ isVisible: boolean
│  ├─ state: "recording" | "transcribing" | "ghostwriting" | "error"
│  ├─ errorMessage: string
│  └─ levels: number[] (smoothed audio bars)
└─ Framer Motion Animations
   ├─ Initial/Animate/Exit states
   ├─ Pulsing mic icon during recording
   └─ Audio bars with spring animations
```

**Critical insight:** This architecture follows the event-driven pattern from `.planning/research/ARCHITECTURE.md`. React overlay never queries state - it only responds to events. This keeps it lightweight and prevents lag.

### Recommended Project Structure (No Changes Needed)

Current structure is correct:

```
src/overlay/
├── index.html           # Overlay entry point HTML
├── main.tsx             # Theme initialization, ReactDOM render
└── RecordingOverlay.tsx # Main overlay component
```

### Pattern 1: Event-Driven Overlay State

**What:** Overlay state is entirely controlled by Rust backend events, React never queries.

**When to use:** All overlay state updates (show, hide, state changes, audio levels).

**Example (Keep This Pattern):**
```typescript
// Current pattern - CORRECT, keep it
useEffect(() => {
  const unlistenShow = await listen("show-overlay", (event) => {
    const overlayState = event.payload as OverlayState;
    setState(overlayState);
    setIsVisible(true);
  });

  const unlistenHide = await listen("hide-overlay", () => {
    setIsVisible(false);
  });

  return () => { unlistenShow(); unlistenHide(); }
}, []);
```

**Why this pattern:** From PITFALLS.md - polling causes unnecessary re-renders and wastes resources. Events are push-based and instant.

### Pattern 2: Framer Motion AnimatePresence for Enter/Exit

**What:** Smooth fade-in/out with scale animation when overlay appears/disappears.

**When to use:** All overlay show/hide transitions.

**Example (Enhance Current Implementation):**
```typescript
// Current implementation is good, enhance spring physics
<motion.div
  initial={{ scale: 0.8, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  exit={{ scale: 0.8, opacity: 0 }}
  transition={{
    type: "spring",
    stiffness: 300,
    damping: 25,
    duration: 0.3
  }}
>
  {/* overlay content */}
</motion.div>
```

**Why this pattern:** From Framer Motion best practices - spring animations feel natural, non-linear easing creates organic motion. Keep duration <300ms to avoid feeling sluggish.

### Pattern 3: Audio Visualizer Bars with Smoothing

**What:** Real-time audio level visualization with smoothed transitions to prevent jitter.

**When to use:** Recording state only, hide during transcription.

**Example (Current Implementation is Correct):**
```typescript
// Smoothing algorithm - KEEP THIS
const unlistenLevel = await listen<number[]>("mic-level", (event) => {
  const newLevels = event.payload;
  const smoothed = smoothedLevelsRef.current.map((prev, i) => {
    const target = newLevels[i] || 0;
    return prev * 0.7 + target * 0.3; // 70/30 weighted average
  });
  smoothedLevelsRef.current = smoothed;
  setLevels(smoothed.slice(0, 9)); // Show 9 bars
});

// Bar animation with spring physics
<motion.div
  className="bar"
  animate={{
    height: `${Math.min(20, 4 + Math.pow(v, 0.7) * 16)}px`,
    opacity: Math.max(0.3, v * 1.7)
  }}
  transition={{
    type: "spring",
    stiffness: 400,
    damping: 20
  }}
/>
```

**Why this pattern:** Smoothing prevents visual jitter from rapid audio level changes. Power curve (`Math.pow(v, 0.7)`) makes low levels more visible. Spring animations create organic bar movement.

### Pattern 4: Multi-Monitor Cursor Following (NEW FEATURE)

**What:** Position overlay on monitor containing cursor, with follow-cursor option.

**When to use:** When `overlay_position` setting is "FollowCursor" (new option).

**Rust implementation (extend existing `calculate_overlay_position`):**
```rust
// Current code already has monitor detection - GOOD
fn get_monitor_with_cursor(app_handle: &AppHandle) -> Option<tauri::Monitor> {
    let enigo = Enigo::new(&Default::default());
    if let Ok(enigo) = enigo {
        if let Ok(mouse_location) = enigo.location() {
            if let Ok(monitors) = app_handle.available_monitors() {
                for monitor in monitors {
                    if is_mouse_within_monitor(mouse_location, monitor.position(), monitor.size()) {
                        return Some(monitor);
                    }
                }
            }
        }
    }
    app_handle.primary_monitor().ok().flatten()
}

// Extend settings enum to support follow cursor
pub enum OverlayPosition {
    Top,
    Bottom,
    FollowCursor, // NEW
    None
}

// Enhance calculate_overlay_position for cursor-relative positioning
fn calculate_overlay_position(app_handle: &AppHandle) -> Option<(f64, f64)> {
    let settings = settings::get_settings(app_handle);
    let monitor = get_monitor_with_cursor(app_handle)?;
    let work_area = monitor.work_area();
    let scale = monitor.scale_factor();

    // Get cursor position for follow mode
    let cursor_pos = if settings.overlay_position == OverlayPosition::FollowCursor {
        Enigo::new(&Default::default())
            .ok()
            .and_then(|e| e.location().ok())
    } else {
        None
    };

    // Calculate position based on mode
    let (x, y) = match (settings.overlay_position, cursor_pos) {
        (OverlayPosition::FollowCursor, Some((cx, cy))) => {
            // Position below cursor with offset
            let x = (cx as f64 / scale).clamp(
                work_area.position.x as f64 / scale,
                (work_area.position.x + work_area.size.width) as f64 / scale - OVERLAY_WIDTH
            );
            let y = ((cy as f64 + 40.0) / scale).clamp(
                work_area.position.y as f64 / scale,
                (work_area.position.y + work_area.size.height) as f64 / scale - OVERLAY_HEIGHT
            );
            (x, y)
        },
        (OverlayPosition::Top, _) => {
            let x = (work_area.position.x as f64 / scale) +
                    ((work_area.size.width as f64 / scale) - OVERLAY_WIDTH) / 2.0;
            let y = (work_area.position.y as f64 / scale) + OVERLAY_TOP_OFFSET;
            (x, y)
        },
        (OverlayPosition::Bottom | OverlayPosition::None, _) => {
            let x = (work_area.position.x as f64 / scale) +
                    ((work_area.size.width as f64 / scale) - OVERLAY_WIDTH) / 2.0;
            let y = (work_area.position.y as f64 / scale) +
                    (work_area.size.height as f64 / scale) - OVERLAY_BOTTOM_OFFSET;
            (x, y)
        }
    };

    Some((x, y))
}
```

**Why this pattern:** Existing code already has robust monitor detection and position calculation. Extension is straightforward. Clamping prevents overlay from going off-screen.

### Anti-Patterns to Avoid

- **Don't Poll for State:** Never use `setInterval` to check recording state. Use events only.
- **Don't Complex State Management:** Overlay should not have Zustand store or context providers. Component state only.
- **Don't Query Backend:** Never `invoke("get_recording_state")`. React overlay is purely reactive.
- **Don't Continuous Animations:** Only pulse during recording. No infinite animations when idle.
- **Don't Ignore prefers-reduced-motion:** Respect accessibility setting to disable/reduce animations.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audio level smoothing | Simple average or direct display | Weighted exponential smoothing (70/30) with ref storage | Prevents visual jitter, maintains perceived responsiveness. Current implementation is correct. |
| Window position on multi-monitor | Calculate from screen bounds | Existing `get_monitor_with_cursor` + work area calculation | Handles DPI scaling, taskbar exclusion, platform differences. Already implemented in `overlay.rs`. |
| Overlay stale window detection | Trust window.show() succeeded | Health check with `is_visible()` verification + retry | Windows sleep breaks window handles. Current health check system prevents ghost windows. |
| Animation exit timing | Immediate hide on event | Delayed hide with atomic flag for race prevention | Prevents hide() from previous call interrupting new show(). Current HIDE_PENDING pattern is correct. |
| Audio visualizer math | Linear height mapping | Power curve + min/max clamping | Low audio levels become visible, prevents bars from disappearing. |

**Key insight:** The current `overlay.rs` lifecycle management is production-grade and handles all edge cases (Windows sleep, multi-monitor, stale handles). Do NOT replace it - extend it for cursor-follow positioning only.

## Common Pitfalls

### Pitfall 1: Breaking the Health Check System

**What goes wrong:** Refactoring overlay creation/show logic removes or weakens the health check system. After Windows sleep, overlay window handle becomes stale but `show()` succeeds silently. Users think recording failed.

**Why it happens:** From PITFALLS.md - "System sleep invalidates window handles on Windows. `show()` succeeds but `is_visible()` returns false."

**How to avoid:**
- Keep `ensure_overlay_exists()` calls before every show
- Keep `try_show_overlay()` validation with 10ms delay + visibility check
- Keep retry loop with window recreation on failure
- Never assume `show()` success means window is visible

**Warning signs:**
- Overlay doesn't appear after laptop wake from sleep
- `is_visible()` error logs after show operations
- Users report "overlay stopped working" with no error message

### Pitfall 2: Animation Performance Degradation

**What goes wrong:** Overlay causes frame drops or high CPU usage during recording. Webview rendering overhead accumulates, especially on lower-end devices.

**Why it happens:** From PITFALLS.md - "Overlay uses full webview (heavyweight) for simple status display. Animations run continuously even when not visible."

**How to avoid:**
- Set performance budget: Overlay <50MB memory, <5% CPU
- Use GPU-accelerated CSS animations, not JavaScript
- Pause animations when overlay hidden
- Minimize DOM complexity (current 10-20 elements is good)
- No continuous animations except during active recording

**Warning signs:**
- Performance monitoring shows overlay memory >50MB
- CPU usage >5% when overlay visible
- Users report "app feels slow" or battery drain

### Pitfall 3: Multi-Monitor Positioning Failures

**What goes wrong:** Overlay always appears on primary monitor even when cursor is on secondary monitor. Multi-monitor setups broken.

**Why it happens:** From research - Tauri Issue #14019: "All overlay windows open on primary monitor despite position settings."

**How to avoid:**
- Use existing `get_monitor_with_cursor()` which correctly identifies monitor
- Calculate position relative to monitor work area, not screen bounds
- Account for DPI scaling: divide by `monitor.scale_factor()`
- Test on 125%, 150%, 200% DPI scaling
- Test on monitor arrangements: left/right, above/below, different resolutions

**Warning signs:**
- Overlay appears on wrong monitor
- Position calculation puts overlay off-screen
- Overlay under taskbar or dock
- Different behavior on scaled displays

### Pitfall 4: Discoverability of ESC Cancellation

**What goes wrong:** Users don't know ESC cancels recording. They wait for timeout or force-quit app.

**Why it happens:** No visual hint that ESC works. Cancel button exists but keyboard shortcut is invisible.

**How to avoid:**
- Show "Press ESC to cancel" hint on first 3 recordings
- Cancel button tooltip: "Cancel (ESC)"
- Consistent with modal best practices: ESC should always cancel operations
- Screen reader announcement: "Recording started. Press ESC to cancel."

**Warning signs:**
- Support tickets asking "how do I cancel recording?"
- User testing shows people don't discover ESC
- Abandoned recordings because user didn't know how to stop

### Pitfall 5: Dark Theme Inconsistency

**What goes wrong:** Overlay uses dark theme but error state or loading state flashes light background. Jarring contrast in dark environments.

**Why it happens:** Hardcoded colors instead of CSS variables. Theme not applied consistently.

**How to avoid:**
- All colors use CSS variables: `var(--background)`, `var(--foreground)`
- Test in actual dark room (contrast issues invisible in bright office)
- Respect system dark mode preference
- Error state should maintain dark theme (current red error needs dark variant)

**Warning signs:**
- White flash when overlay appears
- Error text unreadable in dark theme
- Inconsistent colors between overlay and main window

## Code Examples

Verified patterns from current implementation:

### Recording Overlay with Animations
```typescript
// Source: src/overlay/RecordingOverlay.tsx (current implementation)
// Pattern: AnimatePresence with spring animations
const RecordingOverlay: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [state, setState] = useState<OverlayState>("recording");

  // Event-driven state (keep this pattern)
  useEffect(() => {
    const setupListeners = async () => {
      const unlistenShow = await listen("show-overlay", (event) => {
        setState(event.payload as OverlayState);
        setIsVisible(true);
      });
      const unlistenHide = await listen("hide-overlay", () => {
        setIsVisible(false);
      });
      return () => { unlistenShow(); unlistenHide(); }
    };
    setupListeners();
  }, []);

  // ESC key cancellation (keep this pattern)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isVisible) {
        invoke("cancel_operation");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <motion.div
      className="recording-overlay"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 25
      }}
    >
      {/* Pulsing mic icon during recording */}
      <motion.div
        animate={{
          scale: state === "recording" ? [1, 1.1, 1] : 1
        }}
        transition={{
          duration: 1.5,
          repeat: state === "recording" ? Infinity : 0,
          ease: "easeInOut"
        }}
      >
        <MicrophoneIcon />
      </motion.div>

      {/* Audio bars (only during recording) */}
      {state === "recording" && (
        <div className="bars-container">
          {levels.map((v, i) => (
            <motion.div
              key={i}
              className="bar"
              animate={{
                height: `${Math.min(20, 4 + Math.pow(v, 0.7) * 16)}px`,
                opacity: Math.max(0.3, v * 1.7)
              }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 20
              }}
            />
          ))}
        </div>
      )}

      {/* Cancel button with hover animation */}
      <motion.div
        className="cancel-button"
        onClick={() => invoke("cancel_operation")}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        title="Cancel (ESC)"
      >
        <CancelIcon />
      </motion.div>
    </motion.div>
  );
};
```

### WisprFlow-Style Minimal Pill Design
```css
/* Source: Enhance current index.css .recording-overlay */
/* WisprFlow-inspired floating pill with dark theme */
.recording-overlay {
  /* Pill shape with rounded ends */
  height: 48px;
  min-width: 240px;
  max-width: 600px;
  padding: 12px 20px;
  border-radius: 24px; /* Pill shape */

  /* Dark minimal theme */
  background: oklch(0.15 0 0); /* Darker than current */
  border: 1px solid oklch(0.25 0 0); /* Subtle border */
  box-shadow: 0 8px 24px oklch(0 0 0 / 0.6); /* Elevated shadow */

  /* Layout */
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 16px;

  /* Smooth transitions */
  transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);

  /* Backdrop blur for layering */
  backdrop-filter: blur(10px);
}

/* Pulsing indicator during recording */
.overlay-state-recording .overlay-left::before {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  background: var(--primary);
  opacity: 0.3;
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.3;
  }
  50% {
    transform: scale(1.2);
    opacity: 0;
  }
}

/* Audio bars with gradient */
.bar {
  width: 4px;
  background: linear-gradient(
    to top,
    var(--primary),
    var(--accent)
  );
  border-radius: 2px;
  max-height: 24px;
  min-height: 4px;
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .recording-overlay,
  .bar,
  .overlay-left::before {
    animation: none !important;
    transition: none !important;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Destroy/recreate overlay on each show | Persistent window with show/hide | Tauri 2.x (2024) | 100-200ms faster, no flash |
| Poll is_recording() every 100ms | Event-driven state with emit/listen | Tauri 2.x events | Lower CPU, instant updates |
| Single monitor positioning | Multi-monitor cursor detection | Tauri 2.x monitor API | Works on all displays |
| exitBeforeEnter (Framer Motion v6) | `<AnimatePresence mode="wait">` | Framer Motion v7.2.0 (2021) | Clearer API, same behavior |
| CSS-in-JS for overlay styling | Tailwind v4 compile-time | Tailwind v4 (2025) | 48% better performance |

**Deprecated/outdated:**
- `AnimatedSharedLayout`: Deprecated in favor of individual `layoutId` props (Framer Motion v7)
- `exitBeforeEnter`: Use `mode="wait"` prop on AnimatePresence instead
- Direct `enigo.mouse_location()`: Now wrapped in Result, requires error handling

## Open Questions

Things that couldn't be fully resolved:

1. **Cursor-Follow Position Update Frequency**
   - What we know: Cursor position can be queried via enigo, existing monitor detection works
   - What's unclear: How often to update position during recording? Every 100ms? Only on show?
   - Recommendation: Only calculate position on show, don't track cursor movement during recording (prevents jitter and CPU waste)

2. **WisprFlow Exact Visual Specs**
   - What we know: WisprFlow uses small persistent bar on dock, minimal/invisible design
   - What's unclear: Exact dimensions, colors, animation timings (no public design specs)
   - Recommendation: Implement interpretation: 48px height pill, 240-600px width, dark theme with subtle border, backdrop blur

3. **Performance Budget Enforcement**
   - What we know: Overlay should be <50MB memory, <5% CPU (from PITFALLS.md)
   - What's unclear: How to enforce in CI/testing? Manual profiling only?
   - Recommendation: Manual performance testing during Phase 3, document baseline metrics

4. **Accessibility Announcements**
   - What we know: Screen readers should announce overlay state changes
   - What's unclear: Does Tauri webview expose to system screen readers automatically?
   - Recommendation: Add ARIA live regions, test with NVDA (Windows) and VoiceOver (macOS)

## Sources

### Primary (HIGH confidence)
- Current LeadrScribe codebase:
  - `src-tauri/src/overlay.rs` - Window lifecycle, positioning, health checks
  - `src/overlay/RecordingOverlay.tsx` - Current overlay implementation
  - `src/index.css` - Overlay styling
- `.planning/research/ARCHITECTURE.md` - Three-window pattern, event-driven architecture
- `.planning/research/STACK.md` - Library recommendations (Framer Motion, Tailwind, React)
- `.planning/research/PITFALLS.md` - Overlay fragility, performance, discoverability issues

### Secondary (MEDIUM confidence)
- [Advanced animation patterns with Framer Motion - Maxime Heckel](https://blog.maximeheckel.com/posts/advanced-animation-patterns-with-framer-motion/)
- [Framer Motion Layout Animations - Official Docs](https://www.framer.com/motion/layout-animations/)
- [Motion - React animation library](https://motion.dev/)
- [react-useoverlay - GitHub](https://github.com/needim/react-useoverlay) - Floating UI + Framer Motion integration
- [WisprFlow: Designing a natural voice interface](https://wisprflow.ai/post/designing-a-natural-and-useful-voice-interface)
- [Tauri multi-monitor positioning Issue #14019](https://github.com/tauri-apps/tauri/issues/14019)
- [VapiBlocks Audio Visualizer](https://www.vapiblocks.com/components/visualizer) - Framer Motion audio bars example
- [Modal Pattern - UX Patterns for Developers](https://uxpatterns.dev/patterns/content-management/modal) - ESC key best practices
- [Best Practices for Modal Windows - UX Movement](https://uxmovement.com/forms/best-practices-for-modal-windows/)

### Tertiary (LOW confidence)
- [Beyond Eye Candy: React Animation Libraries 2026 - Syncfusion](https://www.syncfusion.com/blogs/post/top-react-animation-libraries)
- [react-audio-visualizer-pro - GitHub](https://github.com/SujalXplores/react-audio-visualizer-pro)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Current libraries are 2026 industry standard, verified in STACK.md research
- Architecture patterns: HIGH - Current implementation follows best practices, event-driven pattern proven
- Window lifecycle: HIGH - Existing health check system handles all edge cases (sleep/wake, multi-monitor, stale handles)
- Cursor-follow positioning: MEDIUM - Extension of existing code, but not currently implemented
- WisprFlow visual design: MEDIUM - Design philosophy documented, but exact specs unknown
- Accessibility: MEDIUM - ARIA best practices known, Tauri screen reader support needs testing

**Research date:** 2026-02-04
**Valid until:** 60 days (overlay architecture is stable, no fast-moving dependencies)
