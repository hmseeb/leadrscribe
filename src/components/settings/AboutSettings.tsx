import React, { useState, useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { SettingsGroup } from "../ui/SettingsGroup";
import { SettingContainer } from "../ui/SettingContainer";
import { Button } from "../ui/Button";
import { AppDataDirectory } from "./AppDataDirectory";

export const AboutSettings: React.FC = () => {
  const [version, setVersion] = useState("");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const appVersion = await getVersion();
        setVersion(appVersion);
      } catch (error) {
        console.error("Failed to get app version:", error);
        setVersion("0.1.2");
      }
    };

    fetchVersion();
  }, []);

  const handleCheckForUpdates = async () => {
    setChecking(true);
    try {
      await invoke("trigger_update_check");
    } catch (error) {
      console.error("Failed to check for updates:", error);
    } finally {
      setTimeout(() => setChecking(false), 1000);
    }
  };

  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      <SettingsGroup title="About">
        <SettingContainer
          title="Version"
          description="Current version of LeadrScribe"
          grouped={true}
        >
          <span className="text-sm font-mono">v{version}</span>
        </SettingContainer>

        <SettingContainer
          title="Check for Updates"
          description="Check if a newer version is available"
          grouped={true}
        >
          <Button
            variant="primary"
            size="md"
            onClick={handleCheckForUpdates}
            disabled={checking}
          >
            {checking ? "Checking..." : "Check for Updates"}
          </Button>
        </SettingContainer>

        <AppDataDirectory descriptionMode="tooltip" grouped={true} />
      </SettingsGroup>

      <SettingsGroup title="Acknowledgments">
        <SettingContainer
          title="Whisper.cpp"
          description="High-performance inference of OpenAI's Whisper automatic speech recognition model"
          grouped={true}
          layout="stacked"
        >
          <div className="text-sm text-mid-gray">
            LeadrScribe uses Whisper.cpp for fast, local speech-to-text processing.
            Thanks to the amazing work by Georgi Gerganov and contributors.
          </div>
        </SettingContainer>
      </SettingsGroup>
    </div>
  );
};
