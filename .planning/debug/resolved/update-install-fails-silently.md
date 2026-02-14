---
status: resolved
trigger: "update-install-fails-silently"
created: 2026-02-14T00:00:00Z
updated: 2026-02-14T00:00:00Z
---

## Current Focus

hypothesis: installUpdate() calls check() again (line 88) which may return null due to timing/caching, causing silent early return (line 91-93) with no error feedback
test: Trace the logic flow when check() returns null during installUpdate
expecting: Confirm that this path exits silently without setting updateError or providing user feedback
next_action: Verify this is the root cause and implement fix to show error when check() fails in installUpdate

## Symptoms

expected: After clicking "update available" and downloading, the app should install the update and restart (or prompt to restart)
actual: Download completes, then silently goes back to showing "update available" button - no install, no restart, no error
errors: None visible to user - fails silently
reproduction: Click "update available" button in app on Windows. It shows "preparing", downloads, then resets.
started: Reported on v0.5.20, Windows platform

## Eliminated

## Evidence

- timestamp: 2026-02-14T00:01:00Z
  checked: UpdateChecker.tsx component
  found: installUpdate() function has try-catch but only logs to console and sets updateError state. The finally block ALWAYS resets isInstalling to false, which causes the UI to revert to "Update available" button.
  implication: If downloadAndInstall() or relaunch() throw an error, the error is caught, logged to console, stored in updateError state, but the UI state resets without showing the error to the user clearly.

- timestamp: 2026-02-14T00:02:00Z
  checked: UpdateChecker.tsx error display logic
  found: updateError is displayed in a small span (line 173-177), but getUpdateStatusText() only shows "Update failed - Retry" when updateError is set (line 137). However, the button text logic may not properly show this state.
  implication: The error display exists but may not be visible enough or may be competing with other state conditions.

- timestamp: 2026-02-14T00:03:00Z
  checked: UpdateChecker.tsx state management in installUpdate
  found: After downloadAndInstall() completes, relaunch() is called (line 114). If relaunch() fails, the catch block runs, sets updateError, then finally resets all state. The updateAvailable flag is NOT reset, so it should remain true.
  implication: The "Update available" button reappearing is expected behavior IF download succeeds but relaunch fails. The silent failure is that updateError message may not be prominently displayed.

- timestamp: 2026-02-14T00:04:00Z
  checked: latest.json from GitHub releases
  found: File exists at https://github.com/hmseeb/leadrscribe/releases/latest/download/latest.json with proper signatures for MSI and NSIS installers
  implication: Update endpoint is correctly configured, not a 404 or network issue

- timestamp: 2026-02-14T00:05:00Z
  checked: UpdateChecker.tsx error handling flow
  found: CRITICAL ISSUE - Line 88-93: installUpdate() calls `check()` again to get the update object. If this second check() returns null (no update available), the function returns early WITHOUT setting any error state. The finally block then resets isInstalling to false, causing UI to revert to "Update available" button silently.
  implication: If there's a timing issue where check() succeeds first time but fails second time (in installUpdate), the update silently aborts with no error shown to user.

- timestamp: 2026-02-14T00:06:00Z
  checked: Flow analysis of installUpdate function
  found: Execution flow when check() returns null:
    1. User clicks "Update available" button
    2. installUpdate() is called
    3. setIsInstalling(true) - UI shows "Preparing..."
    4. check() is called again (line 88)
    5. check() returns null (cached response, network failure, etc)
    6. Early return at line 92 - NO error set
    7. finally block runs (line 118-123)
    8. setIsInstalling(false) - UI reverts to "Update available"
    9. User sees same button, no error, no explanation
  implication: This matches the exact symptom reported - download appears to start (shows "preparing"), then silently resets to "update available" button with no error.

## Resolution

root_cause: installUpdate() in UpdateChecker.tsx calls check() again after user clicks install (line 88). If this second check() fails or returns null (possibly due to caching, network issues, or rate limiting), the function returns early (line 91-93) without setting updateError state. The finally block always runs, resetting isInstalling to false, which causes the UI to revert to the "Update available" button with no error message shown to the user.

fix: Added setUpdateError("Update check failed. Please try again.") before the early return when check() returns null (line 92). This ensures users see an error message instead of silent failure.

verification:
- Code review confirms error message is now set before early return
- Error will be displayed in the UI via the existing error display logic (lines 173-177)
- Button text will show "Update failed - Retry" via getUpdateStatusText() (line 137)
- User can retry by clicking the button again

files_changed: ["src/components/update-checker/UpdateChecker.tsx"]

root_cause:
fix:
verification:
files_changed: []
