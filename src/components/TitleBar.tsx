import React, { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import LeadrScribeIcon from "./icons/LeadrScribeIcon";

export const TitleBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const appWindow = getCurrentWindow();

  useEffect(() => {
    const checkMaximized = async () => {
      const maximized = await appWindow.isMaximized();
      setIsMaximized(maximized);
    };

    checkMaximized();

    const unlisten = appWindow.onResized(() => {
      checkMaximized();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleMinimize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    appWindow.minimize().catch(err => console.error('Minimize error:', err));
  };

  const handleMaximize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    appWindow.toggleMaximize()
      .then(() => appWindow.isMaximized())
      .then(setIsMaximized)
      .catch(err => console.error('Maximize error:', err));
  };

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    appWindow.close().catch(err => console.error('Close error:', err));
  };

  return (
    <div className="flex items-center justify-between h-10 bg-background border-b-2 border-border select-none">
      {/* Logo - Draggable Area */}
      <div
        data-tauri-drag-region
        className="flex items-center gap-2 px-3 flex-1 h-full"
      >
        <LeadrScribeIcon width={20} height={20} className="text-primary" />
      </div>

      {/* Window Controls */}
      <div className="flex items-center gap-2 pr-3 h-full">
        {/* Minimize Button */}
        <button
          onMouseDown={handleMinimize}
          className="w-5 h-5 bg-secondary border-2 border-border hover:shadow-md transition-all duration-100 flex items-center justify-center text-secondary-foreground text-sm font-bold"
          aria-label="Minimize"
        >
          −
        </button>

        {/* Maximize/Restore Button */}
        <button
          onMouseDown={handleMaximize}
          className="w-5 h-5 bg-muted border-2 border-border hover:shadow-md transition-all duration-100 flex items-center justify-center text-foreground text-[10px] font-bold"
          aria-label={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? "◱" : "□"}
        </button>

        {/* Close Button */}
        <button
          onMouseDown={handleClose}
          className="w-5 h-5 bg-primary border-2 border-border hover:shadow-md transition-all duration-100 flex items-center justify-center text-primary-foreground text-sm font-bold"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
