# Testing Patterns

**Analysis Date:** 2026-02-04

## Test Framework

**Status:** Not configured

**Findings:**
- No test files found in `src/` directory
- No test configuration files (`jest.config.ts`, `vitest.config.ts`, `package.json` test scripts)
- `tsconfig.json` does not include test file patterns
- No testing dependencies in `package.json` (no Jest, Vitest, Testing Library)
- Project is a Tauri desktop application with React frontend and Rust backend

**Implication:**
Testing must be added if quality assurance is required. The codebase currently has zero test coverage.

## Testing Approach for New Tests

Given the architecture and dependencies, if testing is to be implemented, consider:

**Frontend Testing Options:**
1. **Vitest** - Modern, fast test runner, good TypeScript support
   - Lightweight alternative to Jest
   - Would require: `vitest`, `@testing-library/react`, `@testing-library/user-event`

2. **Jest** - Established standard for React projects
   - Would require: `jest`, `ts-jest`, `@testing-library/react`

**Backend Testing:**
- Rust uses built-in `#[cfg(test)]` and `#[test]` macros
- No test modules currently present in Rust files
- Tests would go in the same file as code or in `tests/` directory

**Integration Testing:**
- Tauri applications benefit from integration tests using Tauri's test API
- Would test frontend-backend command/event communication
- Requires `tauri-test` or similar setup

## File Organization (Current State)

**Test File Locations:**
- Not applicable - no tests exist
- Convention would likely be:
  - Co-located: `ComponentName.test.tsx` next to `ComponentName.tsx`
  - Or separate: `src/__tests__/` directory

**Naming Convention (if implemented):**
- `*.test.tsx` for React component tests
- `*.test.ts` for utility/hook tests
- `*.spec.ts` for Rust unit tests

## Test Structure (Recommended for New Tests)

Based on code patterns, tests should follow this structure:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

describe('ComponentName', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  it('should render correctly', () => {
    // Arrange
    const props = { /* ... */ };

    // Act
    render(<Component {...props} />);

    // Assert
    expect(screen.getByText('...')).toBeInTheDocument();
  });
});
```

## Mocking

**Not Currently Used:** No mocking libraries configured

**Recommended Setup (if testing added):**

**For Tauri Commands:**
```typescript
// Mock the invoke function
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// In test:
const { invoke } = await import('@tauri-apps/api/core');
(invoke as any).mockResolvedValue({ /* response */ });
```

**For Zustand Store:**
```typescript
// Mock the store
vi.mock('../stores/settingsStore', () => ({
  useSettingsStore: () => ({
    settings: mockSettings,
    updateSetting: vi.fn(),
    // ... other methods
  }),
}));
```

**For React Hooks:**
```typescript
vi.mock('../hooks/useSettings', () => ({
  useSettings: () => ({
    settings: mockSettings,
    updateSetting: vi.fn(),
    // ... other methods
  }),
}));
```

**What to Mock:**
- Tauri `invoke()` calls (backend communication)
- Zustand store methods
- External API calls (OpenRouter API for ghostwriter mode)
- Browser APIs (geolocation, clipboard) if tested

**What NOT to Mock:**
- React hook logic itself (test behavior)
- Component rendering
- User interactions (use Testing Library utilities instead)
- Utility functions that don't have side effects

## Fixtures and Factories

**Not Currently Used:** No test data or factory patterns in place

**Recommended Pattern (if testing added):**

```typescript
// factories.ts
export const createMockSettings = (overrides?: Partial<Settings>): Settings => ({
  bindings: {},
  push_to_talk: false,
  audio_feedback: true,
  selected_model: "small",
  always_on_microphone: false,
  selected_microphone: "Default",
  selected_output_device: "Default",
  translate_to_english: false,
  selected_language: "auto",
  overlay_position: "bottom",
  debug_mode: false,
  custom_words: [],
  history_limit: 5,
  mute_while_recording: false,
  theme_mode: "system",
  ...overrides,
});

export const createMockModel = (overrides?: Partial<ModelInfo>): ModelInfo => ({
  id: "small",
  name: "Whisper Small",
  description: "Small model",
  filename: "whisper_small.bin",
  size_mb: 1400,
  is_downloaded: true,
  is_downloading: false,
  partial_size: 0,
  is_directory: false,
  accuracy_score: 0.85,
  speed_score: 0.9,
  ...overrides,
});
```

**Location:**
- `src/__tests__/factories/` or `src/__tests__/fixtures/`

## Coverage

**Current:** 0% - No tests exist

**Target (if implementing):**
- Suggest starting with critical paths:
  - Settings update/retrieval (settingsStore, useSettings hook)
  - Model selection and download flow
  - Keyboard shortcut handling
  - Error handling in async operations

**To check coverage (once tests added):**
```bash
# With Vitest
vitest run --coverage

# With Jest
jest --coverage
```

## Test Types

**Unit Tests (Recommended First Priority):**
- Utility functions: `keyboard.ts`, `format.ts` functions
- Store methods: settingsStore actions
- Hook logic: useSettings, useModels behavior
- Small component logic

**Example:**
```typescript
describe('formatKeyCombination', () => {
  it('should format macOS key combinations', () => {
    const result = formatKeyCombination('Shift+Meta+K', 'macos');
    expect(result).toBe('Shift+Command+K');
  });
});
```

**Integration Tests (Medium Priority):**
- Hook + Store interactions (useSettings reading/writing to store)
- Component + Tauri command flow (ModelSelector downloading models)
- Settings UI interactions affecting backend

**Example:**
```typescript
describe('ModelSelector - Download Integration', () => {
  it('should handle model download and selection', async () => {
    (invoke as any).mockResolvedValueOnce([mockModel]);
    (invoke as any).mockResolvedValueOnce(null); // download_model

    render(<ModelSelector />);

    const downloadBtn = await screen.findByText('Download');
    fireEvent.click(downloadBtn);

    // Assert download was called
    expect(invoke).toHaveBeenCalledWith('download_model', { modelId: 'small' });
  });
});
```

**E2E Tests (Lower Priority - Manual or Automation):**
- Full application flows (startup → settings → transcription)
- Multi-window interactions (overlay window)
- Platform-specific functionality (macOS permissions, Windows shortcuts)
- Not automated in codebase; would require Tauri's e2e framework or Playwright/Cypress

## Event Testing Pattern

Given the heavy use of Tauri events, tests should handle:

```typescript
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((eventName, callback) => {
    // Optionally trigger callback with mock event
    if (eventName === 'model-state-changed') {
      callback({
        payload: { event_type: 'loading_completed', model_id: 'small' },
      });
    }
    return Promise.resolve(() => {}); // unlisten function
  }),
}));
```

## Async Testing Pattern

For async operations (common in this codebase):

```typescript
import { waitFor } from '@testing-library/react';

it('should load models on mount', async () => {
  (invoke as any).mockResolvedValue([mockModel]);

  render(<ModelSelector />);

  await waitFor(() => {
    expect(screen.getByText(mockModel.name)).toBeInTheDocument();
  });
});
```

## Running Tests (if implemented)

**Command format:**
```bash
# Run all tests
npm run test          # or: bun run test

# Watch mode
npm run test:watch    # or: bun run test:watch

# Coverage
npm run test:coverage # or: bun run test:coverage

# Specific file
npm run test -- ModelSelector.test.tsx
```

**Would need to add to package.json:**
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

## Critical Paths That Need Testing

Based on code review, these areas should be prioritized if tests are added:

1. **Settings Management** (`settingsStore.ts`, `useSettings.ts`)
   - Loading/saving settings
   - Updating individual settings
   - Audio device enumeration

2. **Model Selection & Download** (`ModelSelector.tsx`, model manager)
   - Model download with progress tracking
   - Model extraction
   - Error handling during download

3. **Keyboard Shortcut Handling** (`LeadrScribeShortcut.tsx`, keyboard utils)
   - Shortcut recording and validation
   - OS-specific key name handling
   - Binding update/reset

4. **Error Handling** (throughout)
   - Async error recovery
   - Toast notification triggering
   - State restoration on failure

---

*Testing analysis: 2026-02-04*
