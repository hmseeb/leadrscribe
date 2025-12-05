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
          <h2 className="text-sm font-kalam font-bold text-pencil tracking-tight">
            {title}
          </h2>
          {description && (
            <p className="text-xs text-text-subtle mt-1 leading-relaxed">
              {description}
            </p>
          )}
        </div>
      )}
      <div className="bg-white border-3 border-pencil rounded-wobbly-lg overflow-visible shadow-md">
        <div className="divide-y-2 divide-pencil overflow-visible">
          {children}
        </div>
      </div>
    </div>
  );
};
