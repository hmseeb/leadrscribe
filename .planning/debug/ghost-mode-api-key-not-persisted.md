---
status: verifying
trigger: "ghost-mode-api-key-not-persisted"
created: 2026-02-16T00:00:00Z
updated: 2026-02-16T00:20:00Z
---

## Current Focus

hypothesis: Fix applied successfully
test: Manual verification in running app
expecting: API key field should populate after app loads, persist after restart, and Ghost mode should work
next_action: Verify fix manually with user

## Symptoms

expected: API key should be saved persistently and Ghost mode should use it for OpenRouter API calls
actual: Two bugs: (1) Ghost mode reports "No API key configured" even though the key is visible in the settings UI field. (2) After restarting the app, the API key field is empty — the key was not persisted.
errors: Toast notification: "No API key configured. Please add your OpenRouter API key in settings. Original transcription was pasted instead. Please check your OpenRouter config in settings. Ghostwriter Failed"
reproduction: Set OpenRouter API key in settings, set output mode to Ghost mode, do a transcription → error. Restart app → key gone.
started: Current behavior, likely since the feature was implemented

## Eliminated

## Evidence

- timestamp: 2026-02-16T00:05:00Z
  checked: Frontend OpenRouterApiKey.tsx component (lines 19-23)
  found: Component loads initial value from useSettingsStore.getState().settings.openrouter_api_key, which reads from Tauri store JSON
  implication: Frontend is reading from wrong source - should call backend command to get from keychain

- timestamp: 2026-02-16T00:06:00Z
  checked: Frontend settingsStore.ts refreshSettings method (lines 171-177)
  found: Method fetches selected_microphone, selected_output_device, and openrouter_api_key via invoke("get_openrouter_api_key_setting") - this IS correct!
  implication: The invoke call exists but maybe the result isn't being used properly

- timestamp: 2026-02-16T00:07:00Z
  checked: Backend change_openrouter_api_key_setting in shortcut.rs (lines 388-410)
  found: When saving API key, backend stores in OS keychain (line 392), then clears it from settings file (line 395). When keychain fails, falls back to settings file (line 400).
  implication: API key is intentionally NOT stored in settings.json, only in OS keychain

- timestamp: 2026-02-16T00:08:00Z
  checked: Backend get_openrouter_api_key_setting in shortcut.rs (lines 364-385)
  found: Reads from keychain first (line 366), falls back to settings file and auto-migrates to keychain (lines 371-381)
  implication: Backend correctly retrieves from keychain

- timestamp: 2026-02-16T00:09:00Z
  checked: Actions.rs ghost mode execution (lines 462-464)
  found: Ghost mode gets API key via get_openrouter_api_key() (from settings.rs) OR settings.openrouter_api_key - backend reads from keychain correctly
  implication: Backend ghostwriter code is correct

- timestamp: 2026-02-16T00:10:00Z
  checked: Frontend settingsStore.ts refreshSettings merge logic (lines 194-197)
  found: Line 194-197 merges openrouter_api_key from invoke result into settings object. This SHOULD work!
  implication: Need to verify if the invoke is actually being called or if there's a timing issue

- timestamp: 2026-02-16T00:12:00Z
  checked: OpenRouterApiKey.tsx component initialization (line 19-23)
  found: useEffect runs ONCE on mount and reads from useSettingsStore.getState().settings - but this happens BEFORE refreshSettings completes!
  implication: Race condition! Component reads initial (empty) state before async refreshSettings finishes loading from backend

## Resolution

root_cause: Race condition in OpenRouterApiKey component. The component's useEffect loads the initial value from the Zustand store synchronously (line 20-22), but the store's refreshSettings() method loads the API key from the backend asynchronously. Since the component mounts before refreshSettings completes, it reads an empty value from the store's initial state. The store DOES fetch from the keychain correctly (via invoke("get_openrouter_api_key_setting") on line 176), but the component has already grabbed the empty initial state and never re-reads when the store updates.

fix: Changed OpenRouterApiKey component to use Zustand's selector hook instead of getState(). This creates a reactive subscription that updates the component whenever settings.openrouter_api_key changes in the store.

Changed from:
```typescript
useEffect(() => {
  const settings = useSettingsStore.getState().settings;
  const value = (settings?.openrouter_api_key || "") as string;
  setLocalValue(value);
}, []);
```

To:
```typescript
const apiKeyFromStore = useSettingsStore((state) => state.settings?.openrouter_api_key);

useEffect(() => {
  const value = (apiKeyFromStore || "") as string;
  setLocalValue(value);
}, [apiKeyFromStore]);
```

verification:
files_changed: ["src/components/settings/OpenRouterApiKey.tsx"]
