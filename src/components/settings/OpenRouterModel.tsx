import React, { useState, useEffect, useRef } from "react";
import { Dropdown } from "../ui/Dropdown";
import { Input } from "../ui/Input";
import { SettingContainer } from "../ui/SettingContainer";
import { useSettingsStore } from "../../stores/settingsStore";

interface OpenRouterModelProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

const CUSTOM_MODEL_VALUE = "__custom__";

const modelOptions = [
  { value: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet (Recommended)" },
  { value: "anthropic/claude-3-5-haiku", label: "Claude 3.5 Haiku (Fast)" },
  { value: "openai/gpt-4-turbo", label: "GPT-4 Turbo" },
  { value: "openai/gpt-4o", label: "GPT-4o" },
  { value: "meta-llama/llama-3.1-405b-instruct", label: "Llama 3.1 405B" },
  { value: CUSTOM_MODEL_VALUE, label: "Custom model..." },
];

export const OpenRouterModel: React.FC<OpenRouterModelProps> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const [selectedValue, setSelectedValue] = useState("anthropic/claude-3.5-sonnet");
    const [customModel, setCustomModel] = useState("");
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Load initial value only once on mount
    useEffect(() => {
      const settings = useSettingsStore.getState().settings;
      const model = (settings?.openrouter_model || "anthropic/claude-3.5-sonnet") as string;
      const isPreset = modelOptions.some(
        (opt) => opt.value === model && opt.value !== CUSTOM_MODEL_VALUE
      );
      setSelectedValue(isPreset ? model : CUSTOM_MODEL_VALUE);
      setCustomModel(isPreset ? "" : model);
    }, []);

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, []);

    const handleDropdownChange = (value: string) => {
      setSelectedValue(value);
      if (value !== CUSTOM_MODEL_VALUE) {
        useSettingsStore.getState().updateSetting("openrouter_model", value);
        setCustomModel("");
      }
    };

    const handleCustomModelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setCustomModel(value);

      // Debounce backend updates
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        const trimmedValue = value.trim();
        if (trimmedValue) {
          useSettingsStore.getState().updateSetting("openrouter_model", trimmedValue);
        }
      }, 500);
    };

    const handleCustomModelBlur = () => {
      // Save immediately on blur
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      const trimmedValue = customModel.trim();
      if (trimmedValue) {
        useSettingsStore.getState().updateSetting("openrouter_model", trimmedValue);
      }
    };

    const showCustomInput = selectedValue === CUSTOM_MODEL_VALUE;

    return (
      <SettingContainer
        title="OpenRouter Model"
        description="Choose which AI model to use for ghostwriting. Different models have different capabilities and costs. See https://openrouter.ai/models for details."
        descriptionMode={descriptionMode}
        grouped={grouped}
        tooltipPosition="bottom"
      >
        <div className="flex flex-col gap-2 w-full">
          <Dropdown
            options={modelOptions}
            selectedValue={selectedValue}
            onSelect={handleDropdownChange}
          />
          {showCustomInput && (
            <Input
              type="text"
              value={customModel}
              onChange={handleCustomModelChange}
              onBlur={handleCustomModelBlur}
              placeholder="e.g., anthropic/claude-3-opus"
              className="w-full font-mono text-xs"
            />
          )}
        </div>
      </SettingContainer>
    );
  },
);
