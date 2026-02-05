import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check, Star, Clock, Calendar } from "lucide-react";
import { Button } from "./Button";
import { AudioPlayer } from "./AudioPlayer";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { cn } from "../../lib/utils";

interface HistoryEntry {
  id: number;
  file_name: string;
  timestamp: number;
  saved: boolean;
  title: string;
  transcription_text: string;
  ghostwritten_text: string | null;
  profile_id: number | null;
  notes: string | null;
  duration_seconds: number | null;
  word_count: number | null;
}

interface TranscriptionDetailModalProps {
  entry: HistoryEntry | null;
  isOpen: boolean;
  onClose: () => void;
  onToggleSaved: () => void;
}

export const TranscriptionDetailModal: React.FC<TranscriptionDetailModalProps> = ({
  entry,
  isOpen,
  onClose,
  onToggleSaved,
}) => {
  const [copiedOriginal, setCopiedOriginal] = React.useState(false);
  const [copiedGhostwritten, setCopiedGhostwritten] = React.useState(false);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (entry && isOpen) {
      loadAudioUrl();
    }
  }, [entry, isOpen]);

  const loadAudioUrl = async () => {
    if (!entry) return;
    try {
      const filePath = await invoke<string>("get_audio_file_path", {
        fileName: entry.file_name,
      });
      const url = convertFileSrc(`${filePath}`, "asset");
      setAudioUrl(url);
    } catch (error) {
      console.error("Failed to load audio:", error);
      setAudioUrl(null);
    }
  };

  if (!entry) return null;

  const handleCopyOriginal = async () => {
    await navigator.clipboard.writeText(entry.transcription_text);
    setCopiedOriginal(true);
    setTimeout(() => setCopiedOriginal(false), 2000);
  };

  const handleCopyGhostwritten = async () => {
    if (entry.ghostwritten_text) {
      await navigator.clipboard.writeText(entry.ghostwritten_text);
      setCopiedGhostwritten(true);
      setTimeout(() => setCopiedGhostwritten(false), 2000);
    }
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return "—";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const hasGhostwritten = entry.ghostwritten_text && entry.ghostwritten_text.trim().length > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl max-h-[90vh] bg-card rounded-lg shadow-xl border border-border z-50 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-border">
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-semibold text-foreground mb-2">
                  {entry.title}
                </h2>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {formatDate(entry.timestamp)}
                  </span>
                  {entry.duration_seconds && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatDuration(entry.duration_seconds)}
                    </span>
                  )}
                  {entry.word_count && (
                    <span>
                      {entry.word_count} words
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={onToggleSaved}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                  title={entry.saved ? "Remove from saved" : "Save transcription"}
                >
                  <Star
                    className={cn(
                      "w-5 h-5",
                      entry.saved
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground"
                    )}
                  />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Audio Player */}
              {audioUrl && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">
                    Recording
                  </h3>
                  <AudioPlayer src={audioUrl} className="w-full" />
                </div>
              )}

              {/* Original Transcription */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                    {hasGhostwritten ? "Original Transcription" : "Transcription"}
                  </h3>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleCopyOriginal}
                    className="flex items-center gap-2"
                  >
                    {copiedOriginal ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <div className="bg-muted/50 p-4 rounded-md border border-border">
                  <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                    {entry.transcription_text}
                  </p>
                </div>
              </div>

              {/* Ghostwritten Version */}
              {hasGhostwritten && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                      Ghostwritten Version
                    </h3>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleCopyGhostwritten}
                      className="flex items-center gap-2"
                    >
                      {copiedGhostwritten ? (
                        <>
                          <Check className="w-4 h-4" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="bg-primary/10 p-4 rounded-md border border-primary/20">
                    <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                      {entry.ghostwritten_text}
                    </p>
                  </div>
                </div>
              )}

              {/* Notes */}
              {entry.notes && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">
                    Notes
                  </h3>
                  <div className="bg-muted/50 p-4 rounded-md border border-border">
                    <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                      {entry.notes}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default TranscriptionDetailModal;
