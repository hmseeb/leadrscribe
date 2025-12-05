import React from "react";
import { motion } from "framer-motion";
import { SettingContainer } from "./SettingContainer";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  isUpdating?: boolean;
  label: string;
  description: string;
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
  tooltipPosition?: "top" | "bottom";
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  isUpdating = false,
  label,
  description,
  descriptionMode = "tooltip",
  grouped = false,
  tooltipPosition = "top",
}) => {
  return (
    <SettingContainer
      title={label}
      description={description}
      descriptionMode={descriptionMode}
      grouped={grouped}
      disabled={disabled}
      tooltipPosition={tooltipPosition}
    >
      <label
        className={`inline-flex items-center ${disabled || isUpdating ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        <input
          type="checkbox"
          value=""
          className="sr-only"
          checked={checked}
          disabled={disabled || isUpdating}
          onChange={(e) => onChange(e.target.checked)}
        />
        <motion.div
          className={`relative w-11 h-6 rounded-wobbly-full border-3 border-pencil transition-colors duration-100 ${
            checked
              ? "bg-red-marker"
              : "bg-old-paper"
          } ${disabled ? "opacity-50" : ""}`}
          whileTap={disabled || isUpdating ? {} : { scale: 0.95 }}
        >
          <motion.div
            className="absolute top-0 left-0 w-5 h-5 bg-white border-3 border-pencil rounded-wobbly-full shadow-sm"
            animate={{
              x: checked ? 20 : 0,
            }}
            transition={{
              type: "spring",
              stiffness: 600,
              damping: 25,
            }}
          />
        </motion.div>
      </label>
      {isUpdating && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-red-marker border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </SettingContainer>
  );
};
