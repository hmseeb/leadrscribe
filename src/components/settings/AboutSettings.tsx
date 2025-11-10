import React, { useState, useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { SettingsGroup } from "../ui/SettingsGroup";
import { SettingContainer } from "../ui/SettingContainer";
import { AppDataDirectory } from "./AppDataDirectory";
import UpdateChecker from "../update-checker";

export const AboutSettings: React.FC = () => {
  const [version, setVersion] = useState("");

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
          title="Updates"
          description="Check for and install new versions"
          grouped={true}
        >
          <UpdateChecker />
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
