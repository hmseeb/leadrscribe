import React from "react";
import { SettingContainer } from "../ui/SettingContainer";
import { Dropdown, DropdownOption } from "../ui/Dropdown";
import { useTheme } from "../../hooks/useTheme";
import { ThemeMode } from "../../lib/types";

interface ThemeSelectorProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

const THEME_OPTIONS: DropdownOption[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  descriptionMode = "tooltip",
  grouped = false,
}) => {
  const { themeMode, setTheme } = useTheme();

  return (
    <SettingContainer
      title="Theme"
      description="Choose between light and dark mode, or follow your system preference"
      descriptionMode={descriptionMode}
      grouped={grouped}
    >
      <Dropdown
        options={THEME_OPTIONS}
        selectedValue={themeMode}
        onSelect={(value) => setTheme(value as ThemeMode)}
        className="min-w-[140px]"
      />
    </SettingContainer>
  );
};
