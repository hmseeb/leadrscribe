import React from "react";
import { motion } from "framer-motion";
import { Cog, FlaskConical, History, Info, Users } from "lucide-react";
import LeadrScribeLogo from "./icons/LeadrScribeLogo";
import LeadrScribeIcon from "./icons/LeadrScribeIcon";
import { useSettings } from "../hooks/useSettings";
import {
  GeneralSettings,
  HistorySettings,
  DebugSettings,
  AboutSettings,
} from "./settings";
import Dashboard from "./dashboard";
import ProfileManager from "./profile";

export type SidebarSection = keyof typeof SECTIONS_CONFIG;

interface IconProps {
  width?: number | string;
  height?: number | string;
  size?: number | string;
  className?: string;
  [key: string]: any;
}

interface SectionConfig {
  label: string;
  icon: React.ComponentType<IconProps>;
  component: React.ComponentType;
  enabled: (settings: any) => boolean;
}

export const SECTIONS_CONFIG = {
  dashboard: {
    label: "Dashboard",
    icon: LeadrScribeIcon,
    component: Dashboard,
    enabled: () => true,
  },
  profiles: {
    label: "Profiles",
    icon: Users,
    component: ProfileManager,
    enabled: (settings) => settings?.output_mode === "ghostwriter",
  },
  history: {
    label: "History",
    icon: History,
    component: HistorySettings,
    enabled: () => true,
  },
  general: {
    label: "Settings",
    icon: Cog,
    component: GeneralSettings,
    enabled: () => true,
  },
  debug: {
    label: "Debug",
    icon: FlaskConical,
    component: DebugSettings,
    enabled: (settings) => settings?.debug_mode ?? false,
  },
  about: {
    label: "About",
    icon: Info,
    component: AboutSettings,
    enabled: () => true,
  },
} as const satisfies Record<string, SectionConfig>;

interface SidebarProps {
  activeSection: SidebarSection;
  onSectionChange: (section: SidebarSection) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSectionChange,
}) => {
  const { settings } = useSettings();

  const availableSections = Object.entries(SECTIONS_CONFIG)
    .filter(([_, config]) => config.enabled(settings))
    .map(([id, config]) => ({ id: id as SidebarSection, ...config }));

  return (
    <div className="flex flex-col w-[220px] h-full border-r-3 border-pencil bg-white items-center px-3 py-3">
      <LeadrScribeLogo className="mb-3" />
      <div className="flex flex-col w-full items-center gap-1.5 pt-3 border-t-3 border-pencil">
        {availableSections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;

          return (
            <motion.div
              key={section.id}
              className={`flex gap-3 items-center px-3 py-2.5 w-full rounded-wobbly cursor-pointer transition-all duration-100 relative border-2 ${
                isActive
                  ? "text-red-marker bg-post-it border-pencil shadow-md rotate-slightly-left"
                  : "text-pencil border-transparent hover:bg-old-paper hover:border-pencil hover:shadow-sm"
              }`}
              onClick={() => onSectionChange(section.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 600, damping: 20 }}
            >
              {isActive && (
                <motion.div
                  layoutId="activeSection"
                  className="absolute left-0 w-1 h-full bg-red-marker rounded-r-full"
                  transition={{ type: "spring", stiffness: 600, damping: 30 }}
                />
              )}
              <Icon
                width={20}
                height={20}
                strokeWidth={2.5}
                className={isActive ? "text-red-marker" : ""}
              />
              <p className={`text-sm ${isActive ? "font-bold" : "font-medium"}`}>
                {section.label}
              </p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
