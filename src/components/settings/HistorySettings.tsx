import React, { useState, useEffect, useCallback } from "react";
import { SettingsGroup } from "../ui/SettingsGroup";
import { AudioPlayer } from "../ui/AudioPlayer";
import { Copy, Star, Check, Trash2, Search, Filter, X, Calendar, Clock } from "lucide-react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { useSettings } from "../../hooks/useSettings";

interface HistoryEntry {
  id: number;
  file_name: string;
  timestamp: number;
  saved: boolean;
  title: string;
  transcription_text: string;
  ghostwritten_text?: string | null;
  profile_id: number | null;
  notes: string | null;
  duration_seconds: number | null;
  word_count: number | null;
}

interface Profile {
  id: number;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  custom_instructions: string | null;
  created_at: number;
  updated_at: number;
}

type DateFilter = "all" | "today" | "week" | "month" | "custom";

export const HistorySettings: React.FC = () => {
  const { getSetting } = useSettings();
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<number | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const loadHistoryEntries = useCallback(async () => {
    setIsSearching(true);
    try {
      let entries: HistoryEntry[] = [];

      // Determine which API to call based on filters
      if (showSavedOnly) {
        entries = await invoke("get_saved_only", { limit: 100 });
      } else if (selectedProfile !== null) {
        entries = await invoke("get_by_profile", {
          profileId: selectedProfile,
          limit: 100,
        });
      } else {
        const dateRange = getDateRange();
        if (dateRange) {
          entries = await invoke("get_by_date_range", {
            startTimestamp: dateRange.start,
            endTimestamp: dateRange.end,
            limit: 100,
          });
        } else if (searchQuery.trim()) {
          entries = await invoke("search_transcriptions", {
            query: searchQuery,
            limit: 100,
          });
        } else {
          entries = await invoke("get_history_entries");
        }
      }

      // Client-side filtering for search query if other filters are active
      if (searchQuery.trim() && (showSavedOnly || selectedProfile !== null || getDateRange())) {
        const query = searchQuery.toLowerCase();
        entries = entries.filter(
          (entry) =>
            entry.transcription_text.toLowerCase().includes(query) ||
            (entry.ghostwritten_text?.toLowerCase().includes(query) ?? false) ||
            (entry.notes?.toLowerCase().includes(query) ?? false)
        );
      }

      setHistoryEntries(entries);
    } catch (error) {
      console.error("Failed to load history entries:", error);
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  }, [searchQuery, selectedProfile, dateFilter, customStartDate, customEndDate, showSavedOnly]);

  const loadProfiles = async () => {
    try {
      const data: Profile[] = await invoke("get_profiles");
      setProfiles(data);
    } catch (error) {
      console.error("Failed to load profiles:", error);
    }
  };

  const getDateRange = (): { start: number; end: number } | null => {
    const now = Math.floor(Date.now() / 1000);
    const day = 86400; // seconds in a day

    switch (dateFilter) {
      case "today":
        return { start: now - day, end: now };
      case "week":
        return { start: now - day * 7, end: now };
      case "month":
        return { start: now - day * 30, end: now };
      case "custom":
        if (customStartDate && customEndDate) {
          return {
            start: Math.floor(new Date(customStartDate).getTime() / 1000),
            end: Math.floor(new Date(customEndDate).getTime() / 1000),
          };
        }
        return null;
      default:
        return null;
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  useEffect(() => {
    loadHistoryEntries();

    // Listen for history update events
    const setupListener = async () => {
      const unlisten = await listen("history-updated", () => {
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

  const clearFilters = () => {
    setSelectedProfile(null);
    setDateFilter("all");
    setCustomStartDate("");
    setCustomEndDate("");
    setShowSavedOnly(false);
    setSearchQuery("");
  };

  const hasActiveFilters =
    selectedProfile !== null ||
    dateFilter !== "all" ||
    showSavedOnly ||
    searchQuery.trim() !== "";

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
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

  if (loading) {
    return (
      <div className="max-w-4xl w-full mx-auto space-y-6">
        <div className="px-4 py-3 text-center text-muted-foreground">
          Loading history...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl w-full mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-sans font-bold text-foreground">
          Transcription History
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          View, search, and manage your transcriptions
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
          <Search className="w-5 h-5" />
        </div>
        <Input
          type="text"
          placeholder="Search by keyword..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-24"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {isSearching && (
            <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1"
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="w-2 h-2 bg-primary-500 rounded-full" />
            )}
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-card rounded-xl p-4 space-y-4 border border-border/30 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">
                Filters
              </h3>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="w-4 h-4 mr-1" />
                  Clear All
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Date Filter */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Date Range
                </label>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                  className="w-full px-3 py-2 rounded-lg border border-border/50 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">Past Week</option>
                  <option value="month">Past Month</option>
                  <option value="custom">Custom Range</option>
                </select>

                {dateFilter === "custom" && (
                  <div className="mt-2 space-y-2">
                    <Input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      placeholder="Start date"
                    />
                    <Input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      placeholder="End date"
                    />
                  </div>
                )}
              </div>

              {/* Profile Filter - Only show in ghostwriter mode */}
              {getSetting("output_mode") === "ghostwriter" && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Profile
                  </label>
                  <select
                    value={selectedProfile ?? ""}
                    onChange={(e) =>
                      setSelectedProfile(e.target.value ? Number(e.target.value) : null)
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border/50 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">All Profiles</option>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.icon} {profile.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Saved Only Toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showSavedOnly}
                onChange={(e) => setShowSavedOnly(e.target.checked)}
                className="w-4 h-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
              />
              <Star className="w-4 h-4 text-amber-500" />
              <span className="text-sm text-foreground">
                Show saved only
              </span>
            </label>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        {historyEntries.length} {historyEntries.length === 1 ? "result" : "results"} found
      </div>

      {/* History Entries */}
      <SettingsGroup title="">
        {historyEntries.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <Search className="w-12 h-12 mx-auto mb-3 text-foreground" />
            <p className="text-muted-foreground">
              {searchQuery || hasActiveFilters
                ? "No transcriptions found. Try adjusting your filters."
                : "No transcriptions yet. Start recording to build your history!"}
            </p>
          </div>
        ) : (
          historyEntries.map((entry, index) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.02 }}
            >
              <HistoryEntryComponent
                entry={entry}
                onToggleSaved={() => toggleSaved(entry.id)}
                onCopyText={copyToClipboard}
                getAudioUrl={getAudioUrl}
                deleteAudio={deleteAudioEntry}
                formatDate={formatDate}
                formatDuration={formatDuration}
              />
            </motion.div>
          ))
        )}
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
  formatDate: (timestamp: number) => string;
  formatDuration: (seconds: number | null) => string;
}

const HistoryEntryComponent: React.FC<HistoryEntryProps> = ({
  entry,
  onToggleSaved,
  onCopyText,
  getAudioUrl,
  deleteAudio,
  formatDate,
  formatDuration,
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
    <div className="px-4 py-2 pb-5 flex flex-col gap-3 border-b border-border last:border-b-0">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">{entry.title}</p>
          <div className="flex items-center gap-3 text-xs text-neutral-500 mt-1">
            <span>{formatDate(entry.timestamp)}</span>
            {entry.word_count && <span>• {entry.word_count} words</span>}
            {entry.duration_seconds && (
              <span className="flex items-center gap-1">
                • <Clock className="w-3 h-3" />
                {formatDuration(entry.duration_seconds)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleSaved}
            className={`p-2 rounded transition-colors cursor-pointer ${
              entry.saved
                ? "text-amber-500 hover:text-amber-600"
                : "text-muted-foreground hover:text-amber-500"
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
            className="text-muted-foreground hover:text-red-500 transition-colors cursor-pointer p-2 rounded"
            title="Delete entry"
          >
            <Trash2 width={16} height={16} />
          </button>
        </div>
      </div>

      {/* Original Transcription */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground font-medium">
            {hasGhostwritten ? "Original Transcription" : "Transcription"}
          </p>
          <button
            onClick={handleCopyOriginal}
            className="text-muted-foreground hover:text-primary-500 transition-colors cursor-pointer"
            title="Copy original transcription to clipboard"
          >
            {showCopiedOriginal ? (
              <Check width={14} height={14} />
            ) : (
              <Copy width={14} height={14} />
            )}
          </button>
        </div>
        <p className="italic text-foreground/90 text-sm">
          {entry.transcription_text}
        </p>
      </div>

      {/* Ghostwritten Version */}
      {hasGhostwritten && (
        <div className="flex flex-col gap-1 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-medium">Ghostwritten</p>
            <button
              onClick={handleCopyGhostwritten}
              className="text-muted-foreground hover:text-primary-500 transition-colors cursor-pointer"
              title="Copy ghostwritten version to clipboard"
            >
              {showCopiedGhostwritten ? (
                <Check width={14} height={14} />
              ) : (
                <Copy width={14} height={14} />
              )}
            </button>
          </div>
          <p className="italic text-foreground/90 text-sm">
            {entry.ghostwritten_text}
          </p>
        </div>
      )}

      {audioUrl && <AudioPlayer src={audioUrl} className="w-full" />}
    </div>
  );
};
