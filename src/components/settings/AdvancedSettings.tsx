import React from "react";
import { SettingsGroup } from "../ui/SettingsGroup";
import { OutputModeSetting } from "./OutputMode";
import { OpenRouterApiKey } from "./OpenRouterApiKey";
import { OpenRouterModel } from "./OpenRouterModel";
import { CustomInstructions } from "./CustomInstructions";
import { CustomWords } from "./CustomWords";
import { useSettings } from "../../hooks/useSettings";

export const AdvancedSettings: React.FC = () => {
  const { getSetting } = useSettings();
  const outputMode = getSetting("output_mode") || "transcript";
  const isGhostwriterMode = outputMode === "ghostwriter";
  const isTranscriptMode = outputMode === "transcript";

  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      <SettingsGroup title="Advanced">
        <OutputModeSetting descriptionMode="tooltip" grouped={true} />
        {isGhostwriterMode && (
          <>
            <OpenRouterApiKey descriptionMode="tooltip" grouped={true} />
            <OpenRouterModel descriptionMode="tooltip" grouped={true} />
            <CustomInstructions descriptionMode="tooltip" grouped={true} />
          </>
        )}
        {isTranscriptMode && (
          <CustomWords descriptionMode="tooltip" grouped />
        )}
      </SettingsGroup>
    </div>
  );
};
