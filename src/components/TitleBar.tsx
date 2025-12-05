import React, { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X, Maximize2 } from "lucide-react";
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

    // Listen for window resize events to update maximize state
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
    console.log('Minimize clicked');
    appWindow.minimize().catch(err => console.error('Minimize error:', err));
  };

  const handleMaximize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Maximize clicked');
    appWindow.toggleMaximize()
      .then(() => appWindow.isMaximized())
      .then(setIsMaximized)
      .catch(err => console.error('Maximize error:', err));
  };

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Close clicked');
    appWindow.close().catch(err => console.error('Close error:', err));
  };

  return (
    <div
      className="flex items-center justify-between h-10 bg-white border-b-3 border-pencil select-none"
    >
      {/* Logo - Draggable Area */}
      <div
        data-tauri-drag-region
        className="flex items-center gap-2 px-3 flex-1 h-full"
      >
        <LeadrScribeIcon width={20} height={20} className="text-red-marker" />
      </div>

      {/* Window Controls */}
      <div className="flex h-full" style={{ pointerEvents: 'auto' }}>
        {/* Minimize Button */}
        <button
          onMouseDown={handleMinimize}
          className="h-full px-4 hover:bg-old-paper transition-colors flex items-center justify-center group"
          aria-label="Minimize"
        >
          <Minus className="w-4 h-4 text-pencil" strokeWidth={2.5} />
        </button>

        {/* Maximize/Restore Button */}
        <button
          onMouseDown={handleMaximize}
          className="h-full px-4 hover:bg-old-paper transition-colors flex items-center justify-center group"
          aria-label={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? (
            <Maximize2 className="w-3.5 h-3.5 text-pencil" strokeWidth={2.5} />
          ) : (
            <Square className="w-3.5 h-3.5 text-pencil" strokeWidth={2.5} />
          )}
        </button>

        {/* Close Button */}
        <button
          onMouseDown={handleClose}
          className="h-full px-4 hover:bg-red-marker transition-colors flex items-center justify-center group"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-pencil group-hover:text-white" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
