import React from "react";
import { motion } from "framer-motion";
import { Cog, FlaskConical, History, Info, Users } from "lucide-react";
import LeadrScribeLogo from "./icons/LeadrScribeLogo";
import LeadrScribeIcon from "./icons/LeadrScribeIcon";
import { useSettings } from "../hooks/useSettings";
import { cn } from "../lib/utils";
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
    <div className="flex flex-col w-[200px] h-full bg-sidebar items-center px-3 py-4">
      <div className="flex flex-col w-full items-center gap-1">
        {availableSections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;

          return (
            <motion.div
              key={section.id}
              className={cn(
                "flex gap-3 items-center px-3 py-2.5 w-full cursor-pointer transition-all relative rounded-lg",
                isActive
                  ? "text-primary-foreground bg-primary shadow-sm"
                  : "text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent"
              )}
              onClick={() => onSectionChange(section.id)}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 600, damping: 20 }}
            >
              <Icon
                width={18}
                height={18}
                strokeWidth={2}
                className={isActive ? "text-white" : ""}
              />
              <p className={cn("text-sm", isActive ? "font-semibold" : "font-medium")}>
                {section.label}
              </p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
