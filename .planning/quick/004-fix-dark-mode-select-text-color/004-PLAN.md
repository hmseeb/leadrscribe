---
phase: quick
plan: 004
type: execute
wave: 1
depends_on: []
files_modified:
  - src/index.css
  - src/components/settings/HistorySettings.tsx
autonomous: true

must_haves:
  truths:
    - "Date range dropdown options are readable in dark mode"
    - "Profile dropdown options are readable in dark mode"
    - "Select dropdowns maintain consistent styling in both themes"
  artifacts:
    - path: "src/index.css"
      provides: "Dark mode select/option styling"
      contains: "select"
    - path: "src/components/settings/HistorySettings.tsx"
      provides: "Updated select element styling"
  key_links:
    - from: "src/index.css"
      to: "HistorySettings.tsx select elements"
      via: "CSS selectors targeting select/option"
      pattern: "\\.dark.*select|option"
---

<objective>
Fix dark mode select dropdown text visibility in HistorySettings

Purpose: Native HTML `<option>` elements have limited CSS styling and often use OS defaults, causing white-on-white or unreadable text in dark mode dropdown menus.

Output: Readable dropdown options in both light and dark themes
</objective>

<context>
@.planning/STATE.md
@src/components/settings/HistorySettings.tsx
@src/index.css
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add CSS styling for native select/option elements in dark mode</name>
  <files>src/index.css</files>
  <action>
Add CSS rules to properly style native `<select>` and `<option>` elements for dark mode.

The issue: Native `<option>` elements have very limited CSS support and often inherit OS colors instead of the page's dark theme colors.

Solution approach:
1. Add explicit background-color and color to `.dark select` and `.dark option` elements
2. Use solid colors (not oklch with transparency) since options have limited CSS support
3. Ensure both the select element and its options have dark backgrounds with light text

Add after the existing `.dark .bg-muted` rule (around line 285) or in the dark theme section:

```css
/* Dark theme native select/option styling */
.dark select {
  background-color: oklch(0.24 0.01 270);
  color: oklch(0.94 0 0);
}

.dark select option {
  background-color: oklch(0.24 0.01 270);
  color: oklch(0.94 0 0);
}
```

These values match:
- background: --secondary in dark mode (oklch(0.24 0.01 270))
- color: --foreground in dark mode (oklch(0.94 0 0))
  </action>
  <verify>
1. Run `bun run tauri dev`
2. Open Settings > History
3. Click Filters button
4. Open Date Range dropdown in dark mode
5. Verify all options (All Time, Today, Past Week, etc.) have readable light text on dark background
6. If ghostwriter mode is enabled, verify Profile dropdown also has readable options
  </verify>
  <done>Dropdown option text is clearly visible with light text on dark background in dark mode</done>
</task>

<task type="auto">
  <name>Task 2: Add consistent light theme select styling</name>
  <files>src/index.css</files>
  <action>
For consistency, add explicit light theme styling for select/option elements as well.

Add near the dark theme select rules:

```css
/* Light theme native select/option styling */
html:not(.dark) select {
  background-color: oklch(0.96 0.008 270);
  color: oklch(0.15 0.02 270);
}

html:not(.dark) select option {
  background-color: oklch(0.96 0.008 270);
  color: oklch(0.15 0.02 270);
}
```

These values match:
- background: approximates --secondary in light mode
- color: --foreground in light mode

This ensures select elements have predictable styling across both themes.
  </action>
  <verify>
1. Toggle to light mode
2. Verify Date Range dropdown options have dark text on light background
3. Options should be readable and consistent with the rest of the UI
  </verify>
  <done>Select dropdown options are styled consistently in both light and dark themes</done>
</task>

</tasks>

<verification>
1. `bun run tauri dev` - app launches without errors
2. In dark mode: History > Filters > Date Range dropdown shows readable options
3. In light mode: Same dropdown shows readable options
4. No visual regression in select element appearance (borders, rounded corners still work)
</verification>

<success_criteria>
- Date Range dropdown options readable in dark mode (light text, dark background)
- Date Range dropdown options readable in light mode (dark text, light background)
- Profile dropdown (if visible) follows same styling
- No regressions in select element styling (hover states, focus rings still work)
</success_criteria>

<output>
After completion, create `.planning/quick/004-fix-dark-mode-select-text-color/004-SUMMARY.md`
</output>
