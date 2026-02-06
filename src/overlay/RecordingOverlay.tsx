import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize, LogicalPosition } from "@tauri-apps/api/dpi";
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MicrophoneIcon,
  TranscriptionIcon,
  CancelIcon,
} from "../components/icons";
import { cn } from "../lib/utils";

type OverlayState = "recording" | "transcribing" | "ghostwriting" | "error";

const wordVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 500,
      damping: 30,
    },
  },
};

const RecordingOverlay: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [state, setState] = useState<OverlayState>("recording");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [levels, setLevels] = useState<number[]>(Array(9).fill(0));
  const smoothedLevelsRef = useRef<number[]>(Array(16).fill(0));

  // Streaming transcription state
  const [words, setWords] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const prevWordCountRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  useEffect(() => {
    const setupEventListeners = async () => {
      const unlistenShow = await listen("show-overlay", async (event) => {
        const overlayState = event.payload as OverlayState;
        setState(overlayState);
        setIsVisible(true);
        // Focus window to receive keyboard events
        try {
          await getCurrentWindow().setFocus();
        } catch (e) {
          console.error("Failed to focus overlay window:", e);
        }
      });

      const unlistenHide = await listen("hide-overlay", () => {
        setIsVisible(false);
      });

      const unlistenLevel = await listen<number[]>("mic-level", (event) => {
        const newLevels = event.payload as number[];
        const smoothed = smoothedLevelsRef.current.map((prev, i) => {
          const target = newLevels[i] || 0;
          return prev * 0.7 + target * 0.3;
        });
        smoothedLevelsRef.current = smoothed;
        setLevels(smoothed.slice(0, 9));
      });

      const unlistenChunk = await listen<string>("ghostwriter-chunk", () => {});

      const unlistenComplete = await listen("ghostwriter-complete", () => {});

      const unlistenError = await listen<string>("ghostwriter-error", (event) => {
        const error = event.payload as string;
        setErrorMessage(error);
        setState("error");
        setTimeout(() => {
          setIsVisible(false);
          setErrorMessage("");
        }, 10000);
      });

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

  // DOM CustomEvent listeners for streaming transcription
  useEffect(() => {
    const handleShow = () => {
      console.log("[RecordingOverlay] DOM event: td-show");
      setIsStreaming(true);
      setWords([]);
      prevWordCountRef.current = 0;
    };

    const handleHide = () => {
      console.log("[RecordingOverlay] DOM event: td-hide");
      setIsStreaming(false);
    };

    const handlePartial = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      console.log("[RecordingOverlay] DOM event: td-partial", detail);
      const newWords = detail.text.split(/\s+/).filter((w: string) => w.length > 0);
      setWords((prev) => [...prev, ...newWords]);
    };

    const handleFinal = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      console.log("[RecordingOverlay] DOM event: td-final");
      const finalWords = detail.text.split(/\s+/).filter((w: string) => w.length > 0);
      setWords(finalWords);
      setIsStreaming(false);
    };

    const handleClear = () => {
      console.log("[RecordingOverlay] DOM event: td-clear");
      setWords([]);
      prevWordCountRef.current = 0;
    };

    document.addEventListener("td-show", handleShow);
    document.addEventListener("td-hide", handleHide);
    document.addEventListener("td-partial", handlePartial);
    document.addEventListener("td-final", handleFinal);
    document.addEventListener("td-clear", handleClear);

    return () => {
      document.removeEventListener("td-show", handleShow);
      document.removeEventListener("td-hide", handleHide);
      document.removeEventListener("td-partial", handlePartial);
      document.removeEventListener("td-final", handleFinal);
      document.removeEventListener("td-clear", handleClear);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isVisible) {
        invoke("cancel_operation");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVisible]);

  // Auto-scroll when new words arrive
  useEffect(() => {
    if (shouldAutoScroll && scrollRef.current) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "smooth",
        });
      });
    }
    prevWordCountRef.current = words.length;
  }, [words, shouldAutoScroll]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setShouldAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
  };

  // Dynamic window resizing based on streaming state
  useEffect(() => {
    const hasContent = isStreaming || words.length > 0;
    const currentWindow = getCurrentWindow();

    const updateSize = async () => {
      try {
        if (hasContent) {
          // Expanded size for streaming text
          await currentWindow.setSize(new LogicalSize(360, 230));

          // Shift window up to keep pill in same position
          const currentPos = await currentWindow.outerPosition();
          const heightDiff = 230 - 90; // New height - original height
          await currentWindow.setPosition(
            new LogicalPosition(currentPos.x, currentPos.y - heightDiff)
          );
        } else {
          // Original size when no streaming
          const currentPos = await currentWindow.outerPosition();
          const heightDiff = 230 - 90;

          // Move back down before resizing
          await currentWindow.setPosition(
            new LogicalPosition(currentPos.x, currentPos.y + heightDiff)
          );
          await currentWindow.setSize(new LogicalSize(280, 90));
        }
      } catch (e) {
        console.error("Failed to resize/reposition overlay:", e);
      }
    };

    updateSize();
  }, [isStreaming, words.length]);

  const getIcon = () => {
    switch (state) {
      case "recording":
        return <MicrophoneIcon />;
      case "transcribing":
        return <TranscriptionIcon />;
      case "ghostwriting":
        return <TranscriptionIcon />;
      case "error":
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="oklch(0.70 0.15 25)" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        );
      default:
        return <MicrophoneIcon />;
    }
  };

  return (
    <div className="overlay-container">
      <AnimatePresence>
        {isVisible && (
          <>
            {/* Streaming text area above the pill */}
            {(isStreaming || words.length > 0) && (
              <motion.div
                className="streaming-text-area"
                ref={scrollRef}
                onScroll={handleScroll}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{
                  type: "spring" as const,
                  stiffness: 300,
                  damping: 25,
                }}
              >
                {words.length === 0 && (
                  <span className="transcription-placeholder">Listening...</span>
                )}
                {words.map((word, i) => (
                  <motion.span
                    key={`${i}-${word}`}
                    initial={i >= prevWordCountRef.current ? "hidden" : false}
                    animate="visible"
                    variants={wordVariants}
                    className="transcription-word"
                  >
                    {word}{" "}
                  </motion.span>
                ))}
              </motion.div>
            )}

            {/* Recording overlay pill */}
            <motion.div
              className={cn(
                "recording-overlay",
                "fade-in",
                `overlay-state-${state}`
              )}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 30,
                duration: 0.25,
              }}
            >
              <div className="overlay-left">
                <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10">
                  {getIcon()}
                </div>
              </div>

              <div className="overlay-middle">
                {state === "recording" && (
                  <div className="bars-container">
                    {levels.map((v, i) => (
                      <motion.div
                        key={i}
                        className="bar"
                        animate={{
                          height: `${Math.min(16, 3 + Math.pow(v, 0.6) * 14)}px`,
                          opacity: Math.max(0.4, Math.min(1, v * 1.5)),
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 25,
                        }}
                      />
                    ))}
                  </div>
                )}
                <AnimatePresence mode="wait">
                  {state === "transcribing" && (
                    <motion.div
                      className="transcribing-text"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      Transcribing...
                    </motion.div>
                  )}
                  {state === "ghostwriting" && (
                    <motion.div
                      className="transcribing-text"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      Ghostwriting...
                    </motion.div>
                  )}
                  {state === "error" && (
                    <motion.div
                      className="transcribing-text max-w-[400px] text-sm leading-relaxed text-center"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div>{errorMessage}</div>
                      <div className="text-xs mt-0.5 opacity-70">
                        Original transcription pasted
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="overlay-right">
                <button
                  className="cancel-button"
                  onClick={() => invoke("cancel_operation")}
                  title="Cancel (ESC)"
                >
                  <CancelIcon />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RecordingOverlay;
