import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import "./index.css";
import AccessibilityPermissions from "./components/AccessibilityPermissions";
import CommandPalette from "./components/command-palette";
import Onboarding from "./components/onboarding";
import { Sidebar, SidebarSection, SECTIONS_CONFIG } from "./components/Sidebar";
import TitleBar from "./components/TitleBar";
import { useSettings } from "./hooks/useSettings";
import { useTheme } from "./hooks/useTheme";

const renderSettingsContent = (
  section: SidebarSection,
  onNavigate: (section: SidebarSection) => void
) => {
  const ActiveComponent =
    SECTIONS_CONFIG[section]?.component || SECTIONS_CONFIG.general.component;
  return <ActiveComponent onNavigate={onNavigate} />;
};

function App() {
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [currentSection, setCurrentSection] =
    useState<SidebarSection>("dashboard");
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const { settings, updateSetting } = useSettings();

  // Initialize and manage theme
  useTheme();

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  // Listen for notification events from backend
  useEffect(() => {
    const setupNotificationListener = async () => {
      const unlisten = await listen<{
        title: string;
        message: string;
        type: string;
      }>("show-notification", (event) => {
        const { title, message, type } = event.payload;

        if (type === "error") {
          toast.error(message, {
            duration: 10000, // Show for 10 seconds
            description: title,
          });
        } else {
          toast(message, {
            duration: 5000,
            description: title,
          });
        }
      });

      return unlisten;
    };

    setupNotificationListener();
  }, []);

  // Handle keyboard shortcuts for debug mode toggle and command palette
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl+K (Windows/Linux) or Cmd+K (macOS) for command palette
      const isCommandPaletteShortcut =
        event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey);

      if (isCommandPaletteShortcut) {
        event.preventDefault();
        setShowCommandPalette((prev) => !prev);
        return;
      }

      // Check for Ctrl+Shift+D (Windows/Linux) or Cmd+Shift+D (macOS)
      const isDebugShortcut =
        event.shiftKey &&
        event.key.toLowerCase() === "d" &&
        (event.ctrlKey || event.metaKey);

      if (isDebugShortcut) {
        event.preventDefault();
        const currentDebugMode = settings?.debug_mode ?? false;
        updateSetting("debug_mode", !currentDebugMode);
      }
    };

    // Add event listener when component mounts
    document.addEventListener("keydown", handleKeyDown);

    // Cleanup event listener when component unmounts
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [settings?.debug_mode, updateSetting]);

  const checkOnboardingStatus = async () => {
    try {
      // Always check if they have any models available
      const modelsAvailable: boolean = await invoke("has_any_models_available");
      setShowOnboarding(!modelsAvailable);
    } catch (error) {
      console.error("Failed to check onboarding status:", error);
      setShowOnboarding(true);
    }
  };

  const handleModelSelected = () => {
    // Transition to main app and navigate to general settings to show the selected model
    setShowOnboarding(false);
    setCurrentSection("general");
  };

  if (showOnboarding) {
    return <Onboarding onModelSelected={handleModelSelected} />;
  }

  return (
    <div className="h-screen flex flex-col">
      <Toaster theme="dark" />
      <TitleBar />
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onNavigate={(section) => setCurrentSection(section as SidebarSection)}
      />
      {/* Main content area that takes remaining space */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          activeSection={currentSection}
          onSectionChange={setCurrentSection}
        />
        {/* Scrollable content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col items-center p-4 gap-4">
              <AccessibilityPermissions />
              {renderSettingsContent(currentSection, setCurrentSection)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
