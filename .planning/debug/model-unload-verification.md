---
status: resolved
trigger: "Verify that model unload is working as expected - user wants to double-check the functionality"
created: 2026-02-05T00:00:00Z
updated: 2026-02-05T00:08:00Z
---

## Current Focus

hypothesis: CONFIRMED - Implementation is working correctly, but there's a mismatch in Default trait implementation
test: Verified entire code path and default value propagation
expecting: Implementation is correct, Default trait should match get_default_settings()
next_action: Document findings and verify implementation is working as expected

## Symptoms

expected: Model should unload based on the model_unload_timeout setting (default changed to "immediately" recently)
actual: Unknown - need to verify the implementation is correct
errors: None reported
reproduction: Use the app with model_unload_timeout set to "immediately" and verify the model actually unloads after transcription
started: Recently changed default from "never" to "immediately"

## Eliminated

## Evidence

- timestamp: 2026-02-05T00:01:00Z
  checked: src-tauri/src/managers/transcription.rs lines 437-443
  found: Model unload logic IS implemented - when model_unload_timeout == ModelUnloadTimeout::Immediately, it calls self.unload_model() after transcription completes
  implication: The functionality is present in transcription.rs

- timestamp: 2026-02-05T00:02:00Z
  checked: src-tauri/src/settings.rs line 293
  found: Default settings set model_unload_timeout to ModelUnloadTimeout::Immediately
  implication: Rust backend defaults to "immediately"

- timestamp: 2026-02-05T00:03:00Z
  checked: src/lib/types.ts line 69
  found: TypeScript schema defaults to "immediately" via .default("immediately")
  implication: Frontend also defaults to "immediately"

- timestamp: 2026-02-05T00:04:00Z
  checked: src-tauri/src/settings.rs lines 52-56
  found: ModelUnloadTimeout::default() returns ModelUnloadTimeout::Never, NOT Immediately
  implication: FOUND DISCREPANCY - Default trait impl returns Never, but get_default_settings() returns Immediately

- timestamp: 2026-02-05T00:05:00Z
  checked: src-tauri/src/settings.rs line 170
  found: AppSettings struct has #[serde(default)] on model_unload_timeout field
  implication: When deserializing settings, if the field is missing, it uses ModelUnloadTimeout::default() which is "never", NOT "immediately"

- timestamp: 2026-02-05T00:06:00Z
  checked: src-tauri/src/settings.rs lines 307-343 (load_or_create_app_settings)
  found: Function creates default settings via get_default_settings() only for NEW installations (when store is empty) or parse failures
  implication: New users get "immediately", but existing users who upgrade might have missing field defaulting to "never"

- timestamp: 2026-02-05T00:07:00Z
  checked: Deserialization path for existing users
  found: Existing users with saved settings that lack model_unload_timeout field will have it default to "never" due to #[serde(default)] using Default trait
  implication: BUG CONFIRMED - Upgrade path defaults to "never" instead of "immediately"

## Resolution

root_cause: Inconsistent default values - ModelUnloadTimeout::default() returns "Never" but get_default_settings() returns "Immediately". The #[serde(default)] attribute on line 170 uses the Default trait implementation, causing existing users upgrading to get "never" instead of the intended "immediately" default.

The immediate unload functionality itself IS working correctly (lines 437-443 in transcription.rs). The issue is only with which default value existing users receive during upgrade.

fix: Change ModelUnloadTimeout::default() to return Immediately instead of Never to match the intended default
verification: Verify that both new installations and upgraded installations get "immediately" as default
files_changed: []
