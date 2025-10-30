import React from "react";
import { Dropdown } from "../ui/Dropdown";
import { SettingContainer } from "../ui/SettingContainer";
import { useSettings } from "../../hooks/useSettings";
import type { OutputMode } from "../../lib/types";

interface OutputModeProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

const outputModeOptions = [
  { value: "transcript", label: "Transcript" },
  { value: "ghostwriter", label: "Ghost mode" },
];

export const OutputModeSetting: React.FC<OutputModeProps> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const { getSetting, updateSetting, isUpdating } = useSettings();

    const selectedMode = (getSetting("output_mode") ||
      "transcript") as OutputMode;

    return (
      <SettingContainer
        title="Output Mode"
        description="Transcript provides raw speech-to-text output. Ghost mode rewrites the transcription using AI based on your custom instructions (requires OpenRouter API key)."
        descriptionMode={descriptionMode}
        grouped={grouped}
        tooltipPosition="bottom"
      >
        <Dropdown
          options={outputModeOptions}
          selectedValue={selectedMode}
          onSelect={(value) =>
            updateSetting("output_mode", value as OutputMode)
          }
          disabled={isUpdating("output_mode")}
        />
      </SettingContainer>
    );
  },
);
