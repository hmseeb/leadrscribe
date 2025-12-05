import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MicrophoneIcon,
  TranscriptionIcon,
  CancelIcon,
} from "../components/icons";
import "./RecordingOverlay.css";

type OverlayState = "recording" | "transcribing" | "ghostwriting" | "error";

const RecordingOverlay: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [state, setState] = useState<OverlayState>("recording");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [levels, setLevels] = useState<number[]>(Array(16).fill(0));
  const smoothedLevelsRef = useRef<number[]>(Array(16).fill(0));

  useEffect(() => {
    const setupEventListeners = async () => {
      // Listen for show-overlay event from Rust
      const unlistenShow = await listen("show-overlay", (event) => {
        const overlayState = event.payload as OverlayState;
        setState(overlayState);
        setIsVisible(true);
      });

      // Listen for hide-overlay event from Rust
      const unlistenHide = await listen("hide-overlay", () => {
        setIsVisible(false);
      });

      // Listen for mic-level updates
      const unlistenLevel = await listen<number[]>("mic-level", (event) => {
        const newLevels = event.payload as number[];

        // Apply smoothing to reduce jitter
        const smoothed = smoothedLevelsRef.current.map((prev, i) => {
          const target = newLevels[i] || 0;
          return prev * 0.7 + target * 0.3; // Smooth transition
        });

        smoothedLevelsRef.current = smoothed;
        setLevels(smoothed.slice(0, 9));
      });

      // Listen for ghostwriter chunks (we don't display text, but keep listener for compatibility)
      const unlistenChunk = await listen<string>("ghostwriter-chunk", () => {
        // Not displaying ghostwriter text in overlay anymore
      });

      // Listen for ghostwriter completion
      const unlistenComplete = await listen("ghostwriter-complete", () => {
        // Not displaying ghostwriter text in overlay anymore
      });

      // Listen for ghostwriter errors
      const unlistenError = await listen<string>("ghostwriter-error", (event) => {
        const error = event.payload as string;
        setErrorMessage(error);
        setState("error");

        // Auto-hide error after 10 seconds (increased from 5 for better visibility)
        setTimeout(() => {
          setIsVisible(false);
          setErrorMessage("");
        }, 10000);
      });

      // Cleanup function
      return () => {
        unlistenShow();
        unlistenHide();
        unlistenLevel();
        unlistenChunk();
        unlistenComplete();
        unlistenError();
      };
    };

    setupEventListeners();
  }, []);

  // Handle ESC key to dismiss overlay
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isVisible) {
        invoke("cancel_operation");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVisible]);

  const getIcon = () => {
    switch (state) {
      case "recording":
        return <MicrophoneIcon />;
      case "transcribing":
        return <TranscriptionIcon />;
      case "ghostwriting":
        return <TranscriptionIcon />; // Using transcription icon for ghostwriting too
      case "error":
        return (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        );
      default:
        return <MicrophoneIcon />;
    }
  };

  const getStateColor = () => {
    switch (state) {
      case "recording":
        return "#ff4d4d"; // Red marker
      case "transcribing":
        return "#2d5da1"; // Blue pen
      case "ghostwriting":
        return "#8B5CF6"; // Purple
      case "error":
        return "#ff4d4d"; // Red marker for errors
      default:
        return "#2d5da1"; // Blue pen
    }
  };

  if (!isVisible) {
    return null;
  }

  const getPulseAnimation = () => {
    // No pulse animation needed for hand-drawn design
    return {};
  };

  return (
    <motion.div
      className={`recording-overlay fade-in overlay-state-${state}`}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{
        scale: 1,
        opacity: 1,
        ...getPulseAnimation(),
      }}
      transition={{
        scale: { type: "spring", stiffness: 300, damping: 25 },
        boxShadow: { duration: 2, repeat: Infinity, ease: "easeInOut" }
      }}
    >
      <div className="overlay-left">
        <motion.div
          animate={{
            scale: state === "recording" ? [1, 1.1, 1] : 1
          }}
          transition={{
            duration: 1.5,
            repeat: state === "recording" ? Infinity : 0,
            ease: "easeInOut"
          }}
        >
          {getIcon()}
        </motion.div>
      </div>

      <div className="overlay-middle">
        {state === "recording" && (
          <div className="bars-container">
            {levels.map((v, i) => (
              <motion.div
                key={i}
                className="bar"
                animate={{
                  height: `${Math.min(20, 4 + Math.pow(v, 0.7) * 16)}px`,
                  opacity: Math.max(0.3, v * 1.7),
                }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 20,
                }}
              />
            ))}
          </div>
        )}
        <AnimatePresence>
          {state === "transcribing" && (
            <motion.div
              className="transcribing-text"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
            >
              Transcribing...
            </motion.div>
          )}
          {state === "ghostwriting" && (
            <motion.div
              className="transcribing-text"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
            >
              Ghostwriting...
            </motion.div>
          )}
          {state === "error" && (
            <motion.div
              className="transcribing-text"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              style={{
                maxWidth: "400px",
                fontSize: "14px",
                fontWeight: "600",
                lineHeight: "1.4",
                textAlign: "center"
              }}
            >
              <div>⚠️ {errorMessage}</div>
              <div style={{ fontSize: "12px", marginTop: "4px", fontWeight: "400" }}>
                Original transcription pasted
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="overlay-right">
        <motion.div
          className="cancel-button"
          onClick={() => {
            invoke("cancel_operation");
          }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          title="Cancel (ESC)"
        >
          <CancelIcon />
        </motion.div>
      </div>
    </motion.div>
  );
};

export default RecordingOverlay;
