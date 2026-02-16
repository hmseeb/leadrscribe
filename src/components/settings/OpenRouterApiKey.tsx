import React, { useState, useEffect, useRef } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "../ui/Input";
import { SettingContainer } from "../ui/SettingContainer";
import { useSettingsStore } from "../../stores/settingsStore";

interface OpenRouterApiKeyProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const OpenRouterApiKey: React.FC<OpenRouterApiKeyProps> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const [showKey, setShowKey] = useState(false);
    const [localValue, setLocalValue] = useState("");
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Subscribe to the settings store to get reactive updates
    const apiKeyFromStore = useSettingsStore((state) => state.settings?.openrouter_api_key);

    // Update local value when store value changes (including after initial load from keychain)
    useEffect(() => {
      const value = (apiKeyFromStore || "") as string;
      setLocalValue(value);
    }, [apiKeyFromStore]);

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setLocalValue(value);

      // Debounce backend updates
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        useSettingsStore.getState().updateSetting("openrouter_api_key", value.trim() || null);
      }, 500);
    };

    const handleBlur = () => {
      // Save immediately on blur
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      useSettingsStore.getState().updateSetting("openrouter_api_key", localValue.trim() || null);
    };

    return (
      <SettingContainer
        title="OpenRouter API Key"
        description="Your OpenRouter API key is stored locally on your device. Get your API key from https://openrouter.ai/keys. This is required for Ghost mode to work."
        descriptionMode={descriptionMode}
        grouped={grouped}
        tooltipPosition="bottom"
      >
        <div className="flex gap-2 w-full items-center">
          <Input
            type={showKey ? "text" : "password"}
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="sk-or-v1-..."
            className="flex-1 font-mono text-xs"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="p-2 text-muted-foreground hover:text-primary transition-colors"
            title={showKey ? "Hide API key" : "Show API key"}
          >
            {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </SettingContainer>
    );
  },
);
