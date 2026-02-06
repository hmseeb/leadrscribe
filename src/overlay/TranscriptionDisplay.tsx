import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

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

const TranscriptionDisplay: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [words, setWords] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const prevWordCountRef = useRef(0);

  useEffect(() => {
    const setupEventListeners = async () => {
      const unlistenShow = await listen("show-transcription-display", () => {
        setIsVisible(true);
        setIsListening(true);
        setWords([]);
        prevWordCountRef.current = 0;
      });

      const unlistenHide = await listen("hide-transcription-display", () => {
        setIsVisible(false);
        setIsListening(false);
      });

      const unlistenPartial = await listen<{ text: string; chunk_index: number }>(
        "transcription-partial",
        (event) => {
          const { text } = event.payload;
          const newWords = text.split(/\s+/).filter((w) => w.length > 0);
          setWords((prev) => [...prev, ...newWords]);
        }
      );

      const unlistenFinal = await listen<{ text: string }>(
        "transcription-final",
        (event) => {
          const { text } = event.payload;
          const finalWords = text.split(/\s+/).filter((w) => w.length > 0);
          setWords(finalWords);
          setIsListening(false);
        }
      );

      const unlistenClear = await listen("transcription-clear", () => {
        setWords([]);
        prevWordCountRef.current = 0;
      });

      return () => {
        unlistenShow();
        unlistenHide();
        unlistenPartial();
        unlistenFinal();
        unlistenClear();
      };
    };

    const cleanup = setupEventListeners();
    return () => {
      cleanup.then((fn) => fn());
    };
  }, []);

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
    // Update prevWordCountRef after render
    prevWordCountRef.current = words.length;
  }, [words, shouldAutoScroll]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setShouldAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
  };

  const handleDismiss = async () => {
    try {
      await getCurrentWindow().hide();
    } catch (e) {
      console.error("Failed to hide transcription display:", e);
    }
  };

  return (
    <div className="transcription-display-container">
      <AnimatePresence>
        {isVisible && (
          <motion.div
            className="transcription-display"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            onClick={handleDismiss}
          >
            <div className="transcription-display-left">
              <motion.div
                className="listening-indicator"
                animate={
                  isListening
                    ? {
                        scale: [1, 1.3, 1],
                        opacity: [0.6, 1, 0.6],
                      }
                    : { scale: 1, opacity: 0.3 }
                }
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </div>
            <div
              className="transcription-display-content"
              ref={scrollRef}
              onScroll={handleScroll}
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TranscriptionDisplay;
