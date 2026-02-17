# Coding Conventions

**Analysis Date:** 2026-02-04

## Naming Patterns

**Files:**
- React/TypeScript components: PascalCase (e.g., `ModelSelector.tsx`, `GeneralSettings.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useSettings.ts`, `useModels.ts`)
- Utility files: camelCase (e.g., `keyboard.ts`, `format.ts`)
- Stores: camelCase with `Store` suffix (e.g., `settingsStore.ts`)
- Managers (Rust): snake_case modules with `Manager` struct (e.g., `transcription.rs` → `TranscriptionManager`)

**Functions:**
- React functional components: PascalCase (e.g., `export const GeneralSettings: React.FC`)
- Utility functions: camelCase (e.g., `formatKeyCombination`, `getKeyName`, `normalizeKey`)
- Tauri commands (Rust): snake_case (e.g., `check_custom_sounds`, `update_microphone_mode`)
- Event handlers: prefixed with `handle` in camelCase (e.g., `handleKeyDown`, `handleModelSelect`, `handleClickOutside`)
- Internal async functions: camelCase descriptive names (e.g., `checkOnboardingStatus`, `loadModels`, `startRecording`)

**Variables:**
- State variables: camelCase (e.g., `currentModelId`, `modelDownloadProgress`, `showModelDropdown`)
- Boolean state: prefixed with `is` or `show` (e.g., `isLoading`, `isUpdating`, `showOnboarding`)
- Constants: UPPER_SNAKE_CASE for globals (e.g., `DEFAULT_SETTINGS`, `DEFAULT_AUDIO_DEVICE`)
- Map/Set collections: descriptive plural (e.g., `downloadProgress`, `extractingModels`)

**Types:**
- Interfaces: PascalCase, often with `Props` suffix for React component props (e.g., `ModelSelectorProps`, `LeadrScribeShortcutProps`)
- Type definitions: PascalCase (e.g., `ModelStatus`, `AudioDevice`)
- Generic enums: PascalCase (e.g., `MicrophoneMode`, `RecordingState`)

## Code Style

**Formatting:**
- No explicit formatter (ESLint/Prettier) configuration found
- Tab size: Implicit (TypeScript config uses standard modern defaults)
- Semicolons: Present (TypeScript/React style)
- String quotes: Double quotes for imports, single or double for content

**Linting:**
- TypeScript strict mode enabled: `"strict": true` in `tsconfig.json`
- Unused locals/parameters checked: Disabled (`"noUnusedLocals": false`, `"noUnusedParameters": false`)
- No explicit ESLint config found - relies on TypeScript compiler checks only

**React Patterns:**
- Functional components with hooks (no class components)
- Generic typing for components: `React.FC<Props>` where Props is an interface
- Props passed as destructured interface (e.g., `{ descriptionMode = "tooltip", grouped = false }`)

## Import Organization

**Order:**
1. External libraries/third-party imports (React, Tauri, UI libs)
2. Relative imports from parent directories (hooks, stores)
3. Relative imports from same/child directories (components, utilities)
4. CSS/style imports at the end

**Examples:**
```typescript
// Order in GeneralSettings.tsx
import React from "react";                           // React
import { invoke } from "@tauri-apps/api/core";     // Tauri
import { toast } from "sonner";                     // Third-party
import { useSettings } from "../../hooks/useSettings";  // Hooks
import { SettingsGroup } from "../ui/SettingsGroup";    // UI components
import ModelSelector from "../model-selector";      // Feature components
```

**Path Aliases:**
- No path aliases configured (`tsconfig.json` uses standard moduleResolution)
- Uses relative paths throughout (e.g., `../../hooks/`, `../ui/`)

## Error Handling

**Patterns:**
- `try/catch` blocks for async operations
- Error messages wrapped with context (e.g., "Failed to load models:", error)
- Toast notifications for user-facing errors: `toast.error(message)` from sonner library
- Backend errors passed through as strings from Tauri `invoke()` calls
- Rust backend uses `anyhow::Result<T>` for error handling

**Examples:**
```typescript
// Frontend pattern
try {
  const modelList = await invoke<ModelInfo[]>("get_available_models");
  setModels(modelList);
  setError(null);
} catch (err) {
  setError(`Failed to load models: ${err}`);
} finally {
  setLoading(false);
}

// Toast notification pattern
catch (error) {
  console.error("Failed to change binding:", error);
  toast.error(`Failed to set shortcut: ${error}`);
}
```

## Logging

**Framework:** `console` object (no logging library)

**Patterns:**
- Error logging: `console.error()` for failures and exceptions
- Debug logging: `console.log()` with "DEBUG:" prefix for diagnostic info (seen in `ModelSelector.tsx`)
- Typically paired with error context (e.g., "Failed to check model status")
- Rust backend uses `log::debug()` for debug messages

**Usage:**
```typescript
// Error logging
console.error("Failed to load current model:", err);

// Debug logging
console.log("DEBUG: get_current_model returned:", current);
console.log("DEBUG: Comparison (transcriptionStatus === current):", transcriptionStatus === current);
```

## Comments

**When to Comment:**
- Complex cleanup logic in useEffect (e.g., "CRITICAL FIX:" comments)
- Non-obvious control flow or state management
- OS-specific handling (marked with comments about macOS vs Windows behavior)

**JSDoc/TSDoc:**
- Used in utility functions (e.g., keyboard.ts has JSDoc comment blocks)
- Format: Single block comment above function
- Includes function purpose and parameter descriptions

**Example:**
```typescript
/**
 * Keyboard utility functions for handling keyboard events
 */

/**
 * Extract a consistent key name from a KeyboardEvent
 * This function provides cross-platform keyboard event handling
 * and returns key names appropriate for the target operating system
 */
export const getKeyName = (e: KeyboardEvent, osType: OSType = "unknown"): string => {
```

## Function Design

**Size:** Functions are typically 20-50 lines for handlers, longer for complex logic
- Large components like `ModelSelector.tsx` are ~395 lines due to multiple event listeners
- Decomposed into smaller helper functions when logic is reusable

**Parameters:**
- Handlers receive event objects or typed parameters
- Async functions pass typed invoke parameters (e.g., `{ modelId }`)
- Configuration objects passed as destructured props with defaults

**Return Values:**
- Event handlers typically return void
- Data fetching functions return typed promises (e.g., `Promise<ModelInfo[]>`)
- State setters return void (React convention)
- Validation functions return typed results (e.g., `Result<T>` in Rust)

**Example:**
```typescript
const handleModelSelect = async (modelId: string) => {
  try {
    setModelError(null);
    setShowModelDropdown(false);
    await invoke("set_active_model", { modelId });
    setCurrentModelId(modelId);
  } catch (err) {
    const errorMsg = `${err}`;
    setModelError(errorMsg);
    setModelStatus("error");
    onError?.(errorMsg);
  }
};
```

## Module Design

**Exports:**
- Components: Named or default exports (mixed usage)
- Hooks: Named exports (e.g., `export const useSettings`)
- Stores: Default export for the created store
- Utilities: Named exports for functions
- Types: Named exports from central `lib/types.ts`

**Example patterns:**
```typescript
// Component: Named export
export const GeneralSettings: React.FC = () => { };

// Hook: Named export
export const useSettings = (): UseSettingsReturn => { };

// Utility: Multiple named exports
export const getKeyName = (e: KeyboardEvent, osType: OSType): string => { };
export const formatKeyCombination = (combination: string, osType: OSType): string => { };

// Store: Default export
const settingsStore = create<SettingsStore>(...)
export default settingsStore;
```

**Barrel Files:**
- Used for component groups (e.g., `src/components/settings/index.ts`)
- Typically re-export the main component with a simple import wrapper
- Example: `src/components/model-selector/index.ts` exports `ModelSelector`

**Index files:**
- Most directories have an `index.ts` that re-exports main components
- Reduces verbosity in imports (e.g., `import CommandPalette from "./components/command-palette"`)

## Type System

**Zod Schemas:**
- Used extensively for runtime type validation
- Defined in `src/lib/types.ts`
- Examples: `ShortcutBindingSchema`, `SettingsSchema`, `ModelInfoSchema`
- Inferred types created with `z.infer<typeof Schema>`

**Pattern:**
```typescript
export const SettingsSchema = z.object({
  bindings: ShortcutBindingsMapSchema,
  push_to_talk: z.boolean(),
  selected_model: z.string(),
  // ... more fields
});
export type Settings = z.infer<typeof SettingsSchema>;
```

## State Management

**Frontend:**
- Zustand stores for global state (e.g., `settingsStore.ts`)
- React hooks for component-level state (`useState`)
- Context-based state through custom hooks
- Tauri events for backend-to-frontend communication

**Backend:**
- Arc<Mutex<T>> for thread-safe shared state
- Manager pattern for business logic (AudioRecordingManager, ModelManager, etc.)
- Settings stored via Tauri store plugin

---

*Convention analysis: 2026-02-04*
