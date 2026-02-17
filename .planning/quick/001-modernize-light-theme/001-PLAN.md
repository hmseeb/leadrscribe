---
phase: quick
plan: 001
type: execute
wave: 1
depends_on: []
files_modified:
  - src/index.css
autonomous: true

must_haves:
  truths:
    - "Light theme feels as polished and modern as dark theme"
    - "Light theme uses violet accent color (270 hue) matching dark theme"
    - "Light backgrounds have subtle violet tint for warmth"
    - "Cards and surfaces have clear visual hierarchy"
  artifacts:
    - path: "src/index.css"
      provides: "Modernized light theme variables"
      contains: ":root"
  key_links:
    - from: ":root"
      to: ".dark"
      via: "matching violet accent hue (270)"
      pattern: "oklch.*270"
---

<objective>
Modernize the light theme CSS variables to match the polish and modern aesthetic of the dark theme.

Purpose: The dark theme uses violet accents (oklch 270 hue), subtle tinted backgrounds, and refined borders. The light theme currently uses pure grayscale with orange accents, making it feel dated compared to the dark theme.

Output: Updated `:root` CSS variables in src/index.css with violet-tinted palette matching dark theme's modern aesthetic.
</objective>

<execution_context>
@C:\Users\hsbaz\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\hsbaz\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/index.css
</context>

<tasks>

<task type="auto">
  <name>Task 1: Modernize light theme color palette</name>
  <files>src/index.css</files>
  <action>
Update the `:root` (light theme) variables in src/index.css to use a modern violet-accented palette that mirrors the dark theme's sophistication:

**Core palette changes:**
- `--background`: oklch(0.985 0.005 270) - off-white with barely perceptible violet warmth
- `--foreground`: oklch(0.15 0.01 270) - near-black with violet undertone
- `--card`: oklch(0.995 0 0) - pure white for cards (creates layering)
- `--card-foreground`: oklch(0.15 0.01 270) - match foreground
- `--popover`: oklch(1 0 0) - pure white
- `--popover-foreground`: oklch(0.15 0.01 270) - match foreground

**Accent colors (matching dark theme's violet hue 270):**
- `--primary`: oklch(0.55 0.20 270) - violet primary (darker than dark theme for contrast)
- `--primary-foreground`: oklch(1 0 0) - pure white
- `--secondary`: oklch(0.94 0.01 270) - light violet for secondary surfaces
- `--secondary-foreground`: oklch(0.20 0.01 270)
- `--muted`: oklch(0.96 0.005 270) - very light violet muted
- `--muted-foreground`: oklch(0.45 0 0) - medium gray
- `--accent`: oklch(0.55 0.20 270) - same as primary
- `--accent-foreground`: oklch(1 0 0)

**Borders and inputs:**
- `--border`: oklch(0.90 0.008 270) - subtle violet-tinted border
- `--input`: oklch(0.96 0.005 270) - light input background
- `--ring`: oklch(0.55 0.20 270) - violet focus ring

**Destructive:**
- `--destructive`: oklch(0.55 0.20 25) - red for destructive (same hue as dark)
- `--destructive-foreground`: oklch(1 0 0)

**Chart colors (harmonious with violet primary):**
- `--chart-1`: oklch(0.55 0.18 270) - violet
- `--chart-2`: oklch(0.55 0.14 200) - teal
- `--chart-3`: oklch(0.55 0.14 160) - green
- `--chart-4`: oklch(0.58 0.16 80) - yellow-orange
- `--chart-5`: oklch(0.55 0.14 320) - magenta

**Sidebar:**
- `--sidebar`: oklch(0.97 0.008 270) - slightly tinted sidebar
- `--sidebar-foreground`: oklch(0.20 0.01 270)
- `--sidebar-primary`: oklch(0.55 0.20 270)
- `--sidebar-primary-foreground`: oklch(1 0 0)
- `--sidebar-accent`: oklch(0.92 0.015 270) - light violet accent
- `--sidebar-accent-foreground`: oklch(0.20 0.01 270)
- `--sidebar-border`: oklch(0.90 0.008 270)
- `--sidebar-ring`: oklch(0.55 0.20 270)

Keep the same `--radius: 12px` and font definitions.
  </action>
  <verify>Open src/index.css and verify `:root` variables use oklch with 270 hue for accents</verify>
  <done>Light theme variables updated with violet-accented palette matching dark theme aesthetic</done>
</task>

<task type="auto">
  <name>Task 2: Add light theme utility styles</name>
  <files>src/index.css</files>
  <action>
Add light theme specific utility styles after the existing dark theme utilities (after line 200), mirroring the dark theme's polish:

```css
/* Light theme card elevation */
:root .bg-card,
:not(.dark) .bg-card {
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.05);
}

/* Light theme sidebar border */
:root .bg-sidebar,
:not(.dark) .bg-sidebar {
  border-right: 1px solid var(--sidebar-border);
}

/* Light theme focus rings */
:root *:focus-visible,
:not(.dark) *:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--background), 0 0 0 3px var(--primary);
}

/* Light theme primary button lift */
:root .bg-primary,
:not(.dark) .bg-primary {
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.15);
}

:root .bg-primary:hover,
:not(.dark) .bg-primary:hover {
  filter: brightness(1.05);
}
```

This ensures the light theme has the same polished interactions as dark theme.
  </action>
  <verify>Check that light theme utility styles exist in src/index.css after dark theme utilities</verify>
  <done>Light theme has matching utility styles for cards, focus rings, and buttons</done>
</task>

</tasks>

<verification>
- [ ] `:root` variables use oklch with 270 hue for violet accents
- [ ] Light theme has same interaction polish as dark theme (focus rings, button lifts)
- [ ] Color hierarchy: background < card < popover creates visual layering
- [ ] Primary/accent colors use violet (270 hue) instead of orange (27 hue)
</verification>

<success_criteria>
Light theme CSS variables modernized with violet-accented palette matching dark theme's sophistication. Utility styles added for consistent polish across themes.
</success_criteria>

<output>
After completion, create `.planning/quick/001-modernize-light-theme/001-SUMMARY.md`
</output>
