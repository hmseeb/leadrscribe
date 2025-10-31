import React from "react";

interface SettingsGroupProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
}

export const SettingsGroup: React.FC<SettingsGroupProps> = ({
  title,
  description,
  children,
}) => {
  return (
    <div className="space-y-3">
      {title && (
        <div className="px-1">
          <h2 className="text-sm font-semibold text-text dark:text-neutral-100 tracking-tight">
            {title}
          </h2>
          {description && (
            <p className="text-xs text-text-subtle dark:text-neutral-500 mt-1 leading-relaxed">
              {description}
            </p>
          )}
        </div>
      )}
      <div className="bg-surface dark:bg-neutral-800/50 border border-border dark:border-neutral-700/50 rounded-xl overflow-visible shadow-sm backdrop-blur-sm">
        <div className="divide-y divide-border dark:divide-neutral-700/50">
          {children}
        </div>
      </div>
    </div>
  );
};
