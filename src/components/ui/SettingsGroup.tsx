import * as React from "react";
import { cn } from "../../lib/utils";

interface SettingsGroupProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export const SettingsGroup: React.FC<SettingsGroupProps> = ({
  title,
  description,
  children,
  className,
}) => {
  return (
    <div className={cn("space-y-3", className)}>
      {title && (
        <div className="px-1">
          <h2 className="text-sm font-semibold text-foreground tracking-tight">
            {title}
          </h2>
          {description && (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {description}
            </p>
          )}
        </div>
      )}
      <div className="bg-card rounded-xl border border-border/30 overflow-visible shadow-sm">
        <div className="divide-y divide-border/30 overflow-visible">
          {children}
        </div>
      </div>
    </div>
  );
};
