import React from "react";
import ReactDOM from "react-dom/client";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import "../index.css";
import TranscriptionDisplay from "./TranscriptionDisplay";

type ThemeMode = "system" | "light" | "dark";
type EffectiveTheme = "light" | "dark";

function getSystemTheme(): EffectiveTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getEffectiveTheme(themeMode: ThemeMode): EffectiveTheme {
  if (themeMode === "system") {
    return getSystemTheme();
  }
  return themeMode;
}

function applyTheme(theme: EffectiveTheme) {
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

// Initialize theme from settings
async function initializeTheme() {
  try {
    const settings = await invoke<{ theme_mode?: ThemeMode }>("get_settings");
    const themeMode = settings?.theme_mode || "system";
    applyTheme(getEffectiveTheme(themeMode));
  } catch {
    // Default to system theme on error
    applyTheme(getSystemTheme());
  }
}

// Listen for theme changes from main window
async function setupThemeListener() {
  await listen<{ theme_mode: ThemeMode }>("theme-changed", (event) => {
    applyTheme(getEffectiveTheme(event.payload.theme_mode));
  });

  // Also listen for system theme changes
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", async () => {
    try {
      const settings = await invoke<{ theme_mode?: ThemeMode }>("get_settings");
      if (settings?.theme_mode === "system") {
        applyTheme(getSystemTheme());
      }
    } catch {
      // Ignore errors
    }
  });
}

// Initialize
initializeTheme();
setupThemeListener();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <TranscriptionDisplay />
  </React.StrictMode>,
);
