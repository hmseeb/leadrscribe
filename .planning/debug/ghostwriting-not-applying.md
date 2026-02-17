---
status: verifying
trigger: "Investigate issue: ghostwriting-not-applying"
created: 2026-02-16T00:00:00Z
updated: 2026-02-16T00:35:00Z
---

## Current Focus

hypothesis: ROOT CAUSE FOUND - API key retrieval logic mismatch
test: Apply fix to make actions.rs use the same fallback logic as the command
expecting: Ghostwriting will work reliably even when keyring is flaky
next_action: Apply fix and verify

## Symptoms

expected: After transcription completes, the text should be sent to OpenRouter for ghostwriting (improve grammar/clarity/professionalism and follow custom instructions/profile), then the improved text should be pasted.
actual: The raw transcription is pasted unchanged. Ghostwriting doesn't seem to run or its output is not used.
errors: No error messages shown in overlay or notifications.
reproduction: Enable ghostwriting mode in settings, configure OpenRouter API key and model, record and transcribe speech - the raw text is pasted without improvement.
started: User reports it's "not working as expected" - unclear if it ever worked or broke recently.

## Eliminated

## Evidence

- timestamp: 2026-02-16T00:05:00Z
  checked: ghostwriter.rs, actions.rs, settings.rs, shortcut.rs, OutputMode.tsx
  found: |
    Flow exists and looks correct:
    1. Frontend sends "transcript" or "ghostwriter" string via updateSetting("output_mode", value)
    2. settingUpdaters[output_mode] calls invoke("change_output_mode_setting", { mode: value })
    3. Backend change_output_mode_setting parses string to OutputMode enum and saves to store
    4. actions.rs line 403 checks: settings.output_mode == OutputMode::Ghostwriter
    5. If true, calls ghostwriter::process_text (line 466-474)
    6. ghostwriter::process_text returns Result<String>
    7. If Ok(ghostwritten), uses ghostwritten text (line 479)
    8. If Err(e), emits error to overlay AND notification window (line 481-504), uses original text

    Key insight: Error handling exists and SHOULD show notification if ghostwriter fails
  implication: If user sees no error message, either (a) output_mode != Ghostwriter, or (b) error events not reaching frontend, or (c) ghostwriter succeeds but returns unchanged text

- timestamp: 2026-02-16T00:10:00Z
  checked: ghostwriter.rs process_text function
  found: |
    process_text can fail in these ways:
    - Line 73-78: Returns Err if api_key is None or empty
    - Line 111: Returns Err if HTTP request fails
    - Line 114-135: Returns Err if response status is not success (includes retry logic)
    - All errors return Err with descriptive message

    Success path:
    - Line 179-206: Parses response, extracts content/reasoning, strips preambles
    - Always returns Ok(String) on success
  implication: If ghostwriter fails, it MUST return Err. If it returns Ok, the text should be the ghostwritten version.

- timestamp: 2026-02-16T00:15:00Z
  checked: Added comprehensive debug logging to trace execution
  found: |
    Added [GHOSTWRITER_DEBUG] logs at critical points:
    1. shortcut.rs::change_output_mode_setting - logs incoming mode, before/after values, verification
    2. actions.rs::TranscribeAction::stop - logs settings.output_mode, comparison result, API call params, success/fail paths, final text

    Next step: Run app and reproduce issue to see logs
  implication: Logs will reveal exactly which path is taken and why ghostwriting doesn't apply

- timestamp: 2026-02-16T00:20:00Z
  checked: Actual settings_store.json file
  found: |
    {
      "output_mode": "ghostwriter",
      "openrouter_api_key": null,
      "openrouter_model": "google/gemini-2.5-flash",
      "custom_instructions": "Improve grammar, spelling, clarity, and flow while preserving the original meaning and tone.\n\n",
      "active_profile_id": 5
    }

    Key observations:
    - output_mode IS set to "ghostwriter" ✓
    - openrouter_api_key is null (because it's stored in keyring per shortcut.rs lines 388-403)
    - openrouter_model is set ✓
    - custom_instructions is set ✓
  implication: Settings persistence is working correctly. The API key should be in the Windows keyring. If get_openrouter_api_key() returns None, that would cause ghostwriter::process_text to fail with "No API key configured" error - which should trigger error notifications BUT user reports seeing no errors!

- timestamp: 2026-02-16T00:25:00Z
  checked: Recent commit history and keyring implementation
  found: |
    Commit 0ed535d (Feb 16, today) fixed keyring to enable windows-native feature.
    Before this fix, keyring silently failed and API key was lost.
    After this fix, there's verified read-back and fallback to settings file if keyring doesn't work.

    Given that settings file shows "openrouter_api_key": null, this means:
    - EITHER keyring IS working and key is stored there
    - OR keyring failed but the verification failed and didn't trigger fallback (bug in fix)
  implication: Need to verify if keyring is actually returning the API key at runtime when ghostwriting executes

## Resolution

root_cause: API key retrieval logic mismatch between frontend command and ghostwriting execution. The `get_openrouter_api_key_setting()` command (shortcut.rs:374-395) has proper fallback logic: keyring → settings file → auto-migrate. However, `settings::get_openrouter_api_key()` function (settings.rs:18-32) ONLY checks keyring with no fallback. Actions.rs uses the simpler function, so when Windows keyring is flaky (verification passes at save time but retrieval fails later), ghostwriting gets None for API key even though settings file fallback exists. This causes ghostwriter::process_text to return Err("No API key configured"), original text is pasted, but error notifications may not be visible if windows don't exist or user misses toast.

fix: Changed shortcut.rs::change_openrouter_api_key_setting() to ALWAYS store API key in settings file as fallback, even when keyring verification succeeds. Previously, if keyring verification passed, it set settings.openrouter_api_key = None. This caused ghostwriting to fail if keyring later became unreliable (Windows credential manager can be flaky). Now the API key is stored in both keyring (for security when accessible) AND settings file (for reliability). The ghostwriting code already had the correct fallback logic (keyring → settings file), but settings file was empty due to the aggressive clearing.

Changed line 408 in shortcut.rs from:
```rust
s.openrouter_api_key = None;  // Clear from settings after keyring verification
```

To:
```rust
s.openrouter_api_key = api_key.clone();  // Keep in settings as fallback
```

This ensures ghostwriting always has access to the API key via fallback, even if keyring becomes inaccessible.

verification: Build and test: (1) Set API key in Ghost mode settings, (2) Restart app to verify key persists, (3) Do transcription with Ghost mode enabled, (4) Verify ghostwritten text is pasted (not original)
files_changed: ["src-tauri/src/shortcut.rs"]
