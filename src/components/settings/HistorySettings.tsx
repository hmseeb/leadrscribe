import React, { useState, useEffect, useCallback } from "react";
import { SettingsGroup } from "../ui/SettingsGroup";
import { AudioPlayer } from "../ui/AudioPlayer";
import { Copy, Star, Check, Trash2 } from "lucide-react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface HistoryEntry {
  id: number;
  file_name: string;
  timestamp: number;
  saved: boolean;
  title: string;
  transcription_text: string;
  ghostwritten_text?: string | null;
}

export const HistorySettings: React.FC = () => {
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistoryEntries = useCallback(async () => {
    try {
      const entries = await invoke<HistoryEntry[]>("get_history_entries");
      setHistoryEntries(entries);
    } catch (error) {
      console.error("Failed to load history entries:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistoryEntries();

    // Listen for history update events
    const setupListener = async () => {
      const unlisten = await listen("history-updated", () => {
        console.log("History updated, reloading entries...");
        loadHistoryEntries();
      });

      // Return cleanup function
      return unlisten;
    };

    let unlistenPromise = setupListener();

    return () => {
      unlistenPromise.then((unlisten) => {
        if (unlisten) {
          unlisten();
        }
      });
    };
  }, [loadHistoryEntries]);

  const toggleSaved = async (id: number) => {
    try {
      await invoke("toggle_history_entry_saved", { id });
      // No need to reload here - the event listener will handle it
    } catch (error) {
      console.error("Failed to toggle saved status:", error);
    }
  };

  const copyToClipboard = async (text: string, isGhostwritten: boolean) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  const getAudioUrl = async (fileName: string) => {
    try {
      const filePath = await invoke<string>("get_audio_file_path", {
        fileName,
      });

      return convertFileSrc(`${filePath}`, "asset");
    } catch (error) {
      console.error("Failed to get audio file path:", error);
      return null;
    }
  };

  const deleteAudioEntry = async (id: number) => {
    try {
      await invoke("delete_history_entry", { id });
    } catch (error) {
      console.error("Failed to delete audio entry:", error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl w-full mx-auto space-y-6">
        <SettingsGroup title="History">
          <div className="px-4 py-3 text-center text-text/60">
            Loading history...
          </div>
        </SettingsGroup>
      </div>
    );
  }

  if (historyEntries.length === 0) {
    return (
      <div className="max-w-3xl w-full mx-auto space-y-6">
        <SettingsGroup title="History">
          <div className="px-4 py-3 text-center text-text/60">
            No transcriptions yet. Start recording to build your history!
          </div>
        </SettingsGroup>
      </div>
    );
  }

  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      <SettingsGroup title="History">
        {historyEntries.map((entry) => (
          <HistoryEntryComponent
            key={entry.id}
            entry={entry}
            onToggleSaved={() => toggleSaved(entry.id)}
            onCopyText={copyToClipboard}
            getAudioUrl={getAudioUrl}
            deleteAudio={deleteAudioEntry}
          />
        ))}
      </SettingsGroup>
    </div>
  );
};

interface HistoryEntryProps {
  entry: HistoryEntry;
  onToggleSaved: () => void;
  onCopyText: (text: string, isGhostwritten: boolean) => Promise<void>;
  getAudioUrl: (fileName: string) => Promise<string | null>;
  deleteAudio: (id: number) => Promise<void>;
}

const HistoryEntryComponent: React.FC<HistoryEntryProps> = ({
  entry,
  onToggleSaved,
  onCopyText,
  getAudioUrl,
  deleteAudio,
}) => {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [showCopiedOriginal, setShowCopiedOriginal] = useState(false);
  const [showCopiedGhostwritten, setShowCopiedGhostwritten] = useState(false);

  useEffect(() => {
    const loadAudio = async () => {
      const url = await getAudioUrl(entry.file_name);
      setAudioUrl(url);
    };
    loadAudio();
  }, [entry.file_name, getAudioUrl]);

  const handleCopyOriginal = async () => {
    await onCopyText(entry.transcription_text, false);
    setShowCopiedOriginal(true);
    setTimeout(() => setShowCopiedOriginal(false), 2000);
  };

  const handleCopyGhostwritten = async () => {
    if (entry.ghostwritten_text) {
      await onCopyText(entry.ghostwritten_text, true);
      setShowCopiedGhostwritten(true);
      setTimeout(() => setShowCopiedGhostwritten(false), 2000);
    }
  };

  const handleDeleteEntry = async () => {
    try {
      await deleteAudio(entry.id);
    } catch (error) {
      console.error("Failed to delete entry:", error);
      alert("Failed to delete entry. Please try again.");
    }
  };

  const hasGhostwritten = entry.ghostwritten_text && entry.ghostwritten_text.trim().length > 0;

  return (
    <div className="px-4 py-2 pb-5 flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <p className="text-sm font-medium">{entry.title}</p>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleSaved}
            className={`p-2 rounded  transition-colors cursor-pointer ${
              entry.saved
                ? "text-logo-primary hover:text-logo-primary/80"
                : "text-text/50 hover:text-logo-primary"
            }`}
            title={entry.saved ? "Remove from saved" : "Save transcription"}
          >
            <Star
              width={16}
              height={16}
              fill={entry.saved ? "currentColor" : "none"}
            />
          </button>
          <button
            onClick={handleDeleteEntry}
            className="text-text/50 hover:text-logo-primary transition-colors cursor-pointer"
            title="Delete entry"
          >
            <Trash2 width={16} height={16} />
          </button>
        </div>
      </div>

      {/* Original Transcription */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <p className="text-xs text-text/60 font-medium">
            {hasGhostwritten ? "Original Transcription" : "Transcription"}
          </p>
          <button
            onClick={handleCopyOriginal}
            className="text-text/50 hover:text-logo-primary transition-colors cursor-pointer"
            title="Copy original transcription to clipboard"
          >
            {showCopiedOriginal ? (
              <Check width={14} height={14} />
            ) : (
              <Copy width={14} height={14} />
            )}
          </button>
        </div>
        <p className="italic text-text/90 text-sm">
          {entry.transcription_text}
        </p>
      </div>

      {/* Ghostwritten Version */}
      {hasGhostwritten && (
        <div className="flex flex-col gap-1 pt-2 border-t border-mid-gray/20">
          <div className="flex items-center justify-between">
            <p className="text-xs text-text/60 font-medium">Ghostwritten</p>
            <button
              onClick={handleCopyGhostwritten}
              className="text-text/50 hover:text-logo-primary transition-colors cursor-pointer"
              title="Copy ghostwritten version to clipboard"
            >
              {showCopiedGhostwritten ? (
                <Check width={14} height={14} />
              ) : (
                <Copy width={14} height={14} />
              )}
            </button>
          </div>
          <p className="italic text-text/90 text-sm">
            {entry.ghostwritten_text}
          </p>
        </div>
      )}

      {audioUrl && <AudioPlayer src={audioUrl} className="w-full" />}
    </div>
  );
};
