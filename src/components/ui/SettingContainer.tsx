import * as React from "react";
import { Info } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./Tooltip";

interface SettingContainerProps {
  title: string;
  description: string;
  children: React.ReactNode;
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
  layout?: "horizontal" | "stacked";
  disabled?: boolean;
  tooltipPosition?: "top" | "bottom";
  className?: string;
}

export const SettingContainer: React.FC<SettingContainerProps> = ({
  title,
  description,
  children,
  descriptionMode = "tooltip",
  grouped = false,
  layout = "horizontal",
  disabled = false,
  tooltipPosition = "top",
  className,
}) => {
  const containerClasses = grouped
    ? "px-4 py-3"
    : "px-4 py-3 border-2 border-border shadow-md bg-card";

  if (layout === "stacked") {
    return (
      <div className={cn(containerClasses, className)}>
        <div className="flex items-center gap-2 mb-2">
          <h3
            className={cn(
              "text-sm font-semibold",
              disabled && "opacity-50"
            )}
          >
            {title}
          </h3>
          {descriptionMode === "tooltip" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side={tooltipPosition} className="max-w-xs">
                <p className="text-center">{description}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {descriptionMode === "inline" && (
          <p className={cn("text-sm text-muted-foreground mb-2", disabled && "opacity-50")}>
            {description}
          </p>
        )}
        <div className="w-full">{children}</div>
      </div>
    );
  }

  // Horizontal layout (default)
  const horizontalContainerClasses = grouped
    ? "flex items-center justify-between px-4 py-3"
    : "flex items-center justify-between px-4 py-3 border-2 border-border shadow-md bg-card";

  return (
    <div className={cn(horizontalContainerClasses, className)}>
      <div className="max-w-2/3">
        <div className="flex items-center gap-2">
          <h3
            className={cn(
              "text-sm font-semibold",
              disabled && "opacity-50"
            )}
          >
            {title}
          </h3>
          {descriptionMode === "tooltip" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side={tooltipPosition} className="max-w-xs">
                <p className="text-center">{description}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {descriptionMode === "inline" && (
          <p className={cn("text-sm text-muted-foreground", disabled && "opacity-50")}>
            {description}
          </p>
        )}
      </div>
      <div className="relative">{children}</div>
    </div>
  );
};
