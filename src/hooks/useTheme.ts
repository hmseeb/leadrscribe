import { useEffect, useCallback } from "react";
import { emit } from "@tauri-apps/api/event";
import { useSettingsStore } from "../stores/settingsStore";
import { ThemeMode } from "../lib/types";

type EffectiveTheme = "light" | "dark";

function getSystemTheme(): EffectiveTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: EffectiveTheme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function getEffectiveTheme(themeMode: ThemeMode): EffectiveTheme {
  if (themeMode === "system") {
    return getSystemTheme();
  }
  return themeMode;
}

// Initialize theme immediately (call before React renders)
export function initializeTheme() {
  const settings = useSettingsStore.getState().settings;
  const themeMode = (settings?.theme_mode as ThemeMode) || "system";
  const effectiveTheme = getEffectiveTheme(themeMode);
  applyTheme(effectiveTheme);
}

export function useTheme() {
  const settings = useSettingsStore((state) => state.settings);
  const updateSetting = useSettingsStore((state) => state.updateSetting);

  const themeMode = (settings?.theme_mode as ThemeMode) || "system";
  const effectiveTheme = getEffectiveTheme(themeMode);

  const setTheme = useCallback(
    (mode: ThemeMode) => {
      updateSetting("theme_mode", mode);
    },
    [updateSetting]
  );

  // Apply theme when it changes and notify overlay
  useEffect(() => {
    applyTheme(effectiveTheme);
    // Emit event to sync overlay window
    emit("theme-changed", { theme_mode: themeMode }).catch(() => {
      // Ignore errors if no overlay is open
    });
  }, [effectiveTheme, themeMode]);

  // Listen for system theme changes when in system mode
  useEffect(() => {
    if (themeMode !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      applyTheme(getSystemTheme());
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [themeMode]);

  return {
    themeMode,
    effectiveTheme,
    setTheme,
  };
}
