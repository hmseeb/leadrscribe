import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MicrophoneIcon,
  TranscriptionIcon,
  CancelIcon,
} from "../components/icons";
import { cn } from "../lib/utils";

type OverlayState = "recording" | "transcribing" | "ghostwriting" | "error";

const RecordingOverlay: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [state, setState] = useState<OverlayState>("recording");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [levels, setLevels] = useState<number[]>(Array(9).fill(0));
  const smoothedLevelsRef = useRef<number[]>(Array(16).fill(0));

  // Streaming transcription state
  const [words, setWords] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
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

  // Streaming transcription listeners (via Tauri events)
  useEffect(() => {
    const setupStreamingListeners = async () => {
      const unlistenShow = await listen("td-show", () => {
        console.log("[RecordingOverlay] td-show");
        setIsStreaming(true);
        setWords([]);
        setShouldAutoScroll(true);
      });

      const unlistenHide = await listen("td-hide", () => {
        console.log("[RecordingOverlay] td-hide");
        setIsStreaming(false);
        setWords([]);
        setShouldAutoScroll(true);
      });

      const unlistenPartial = await listen<string>("td-partial", (event) => {
        const text = event.payload as string;
        console.log("[RecordingOverlay] td-partial", text);
        const newWords = text.split(/\s+/).filter((w: string) => w.length > 0);
        setWords(newWords);
      });

      const unlistenFinal = await listen<string>("td-final", (event) => {
        const text = event.payload as string;
        console.log("[RecordingOverlay] td-final");
        const finalWords = text.split(/\s+/).filter((w: string) => w.length > 0);
        setWords(finalWords);
        setIsStreaming(false);
      });

      return () => {
        unlistenShow();
        unlistenHide();
        unlistenPartial();
        unlistenFinal();
      };
    };

    setupStreamingListeners();
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
  }, [words, shouldAutoScroll]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setShouldAutoScroll(scrollHeight - scrollTop - clientHeight < 10);
  };

  const hasWords = words.length > 0;

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
          <motion.div
            className={cn(
              "recording-overlay",
              "fade-in",
              `overlay-state-${state}`,
              hasWords && "overlay-streaming"
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
            {/* Streaming text - above controls */}
            <AnimatePresence>
              {hasWords && (
                <motion.div
                  className="streaming-text-inline"
                  ref={scrollRef}
                  onScroll={handleScroll}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <span className="transcription-word">
                    {words.join(" ")}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Pill controls row */}
            <div className="overlay-controls">
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RecordingOverlay;
