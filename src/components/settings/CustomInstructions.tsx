import React, { useState, useEffect, useRef } from "react";
import { SettingContainer } from "../ui/SettingContainer";
import { useSettingsStore } from "../../stores/settingsStore";

interface CustomInstructionsProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

const MAX_LENGTH = 10000;
const DEFAULT_INSTRUCTIONS = "Improve grammar, spelling, clarity, and flow while preserving the original meaning and tone.";

export const CustomInstructions: React.FC<CustomInstructionsProps> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const [localValue, setLocalValue] = useState(DEFAULT_INSTRUCTIONS);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Load initial value only once on mount
    useEffect(() => {
      const settings = useSettingsStore.getState().settings;
      const value = (settings?.custom_instructions || DEFAULT_INSTRUCTIONS) as string;
      setLocalValue(value);
    }, []);

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      if (value.length <= MAX_LENGTH) {
        setLocalValue(value);

        // Debounce backend updates
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          useSettingsStore.getState().updateSetting("custom_instructions", value);
        }, 500);
      }
    };

    const handleBlur = () => {
      // Save immediately on blur
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      useSettingsStore.getState().updateSetting("custom_instructions", localValue);
    };

    const charCount = localValue.length;
    const isNearLimit = charCount > MAX_LENGTH * 0.9;

    return (
      <SettingContainer
        title="Custom Instructions"
        description="Tell the AI how to rewrite your transcriptions. Be specific about the tone, style, and any transformations you want. This system prompt guides the ghostwriting process."
        descriptionMode={descriptionMode}
        grouped={grouped}
        layout="stacked"
        tooltipPosition="bottom"
      >
        <div className="flex flex-col gap-1 w-full">
          <textarea
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Improve grammar, spelling, clarity, and flow while preserving the original meaning and tone."
            maxLength={MAX_LENGTH}
            rows={6}
            className="w-full px-3 py-2 text-sm bg-mid-gray/10 border border-mid-gray/80 rounded resize-y transition-all duration-150 hover:bg-logo-primary/10 hover:border-logo-primary focus:outline-none focus:bg-logo-primary/20 focus:border-logo-primary disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <div className={`text-xs text-right ${isNearLimit ? "text-orange-400" : "text-mid-gray"}`}>
            {charCount.toLocaleString()} / {MAX_LENGTH.toLocaleString()} characters
          </div>
        </div>
      </SettingContainer>
    );
  },
);
