---
phase: quick
plan: 004
subsystem: ui
tags: [css, dark-mode, styling, select, oklch]

# Dependency graph
requires:
  - phase: quick-001
    provides: Light theme modernization with oklch colors
provides:
  - Native select/option element styling for dark and light themes
  - Readable dropdown options in HistorySettings filters
affects: [ui, theming]

# Tech tracking
tech-stack:
  added: []
  patterns: [Native HTML element theming with oklch colors]

key-files:
  created: []
  modified: [src/index.css]

key-decisions:
  - "Used explicit oklch colors matching CSS variables for select/option elements"
  - "Applied styling to both dark and light themes for consistency"

patterns-established:
  - "Native select styling: Explicit background-color and color on both select and option elements to override OS defaults"

# Metrics
duration: <1min
completed: 2026-02-05
---

# Quick Task 004: Fix Dark Mode Select Text Color

**Native select/option elements now have explicit dark theme styling with light text on dark backgrounds, fixing unreadable dropdown options**

## Performance

- **Duration:** <1 min
- **Started:** 2026-02-05T16:26:52Z
- **Completed:** 2026-02-05T16:27:32Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added dark mode styling for native select and option elements
- Added matching light mode styling for consistency
- Fixed unreadable dropdown text in HistorySettings Date Range and Profile filters

## Task Commits

Each task was committed atomically:

1. **Tasks 1-2: Add native select/option styling for both themes** - `3902747` (style)

## Files Created/Modified
- `src/index.css` - Added `.dark select`, `.dark select option`, `html:not(.dark) select`, and `html:not(.dark) select option` rules

## Decisions Made

**Used explicit oklch colors matching CSS variables**
- Dark theme: background `oklch(0.24 0.01 270)` (--secondary), color `oklch(0.94 0 0)` (--foreground)
- Light theme: background `oklch(0.96 0.008 270)` (approximates --secondary), color `oklch(0.15 0.02 270)` (--foreground)
- Ensures consistent visual appearance with the rest of the UI

**Applied to both select and option elements**
- Native `<option>` elements have limited CSS support and often use OS defaults
- Explicit styling on both ensures dropdown menus inherit dark theme colors

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - straightforward CSS addition.

## Next Phase Readiness

- Select dropdowns now readable in both themes
- Pattern established for styling native HTML elements that don't inherit theme colors well
- Ready for any future native element theming needs

---
*Phase: quick*
*Completed: 2026-02-05*
