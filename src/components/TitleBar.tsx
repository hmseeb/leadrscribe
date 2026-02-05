import React, { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X, Copy } from "lucide-react";
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
    <div className="flex items-center justify-between h-10 bg-sidebar border-b border-sidebar-border select-none">
      {/* Logo - Draggable Area */}
      <div
        data-tauri-drag-region
        className="flex items-center gap-2 px-3 flex-1 h-full"
      >
        <LeadrScribeIcon width={20} height={20} className="text-primary" />
      </div>

      {/* Window Controls */}
      <div className="flex items-center h-full">
        <button
          onMouseDown={handleMinimize}
          className="h-full px-3 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Minimize"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onMouseDown={handleMaximize}
          className="h-full px-3 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? <Copy className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
        </button>
        <button
          onMouseDown={handleClose}
          className="h-full px-3 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-rose-600 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
