import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, FileText, Search, Activity, Zap, Star } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import TranscriptionDetailModal from "../ui/TranscriptionDetailModal";
import { useSettings } from "../../hooks/useSettings";
import { SidebarSection } from "../Sidebar";

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

interface HistoryStats {
  total_count: number;
  total_duration_seconds: number;
  total_words: number;
  saved_count: number;
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

interface DashboardProps {
  onNavigate?: (section: SidebarSection) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { getSetting, updateSetting, settings } = useSettings();
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [recentEntries, setRecentEntries] = useState<HistoryEntry[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    loadDashboardData();
    setupEventListeners();
  }, []);

  // Watch for settings and profiles to update selected profile
  useEffect(() => {
    if (!settings || profiles.length === 0) return;

    const activeProfileId = settings.active_profile_id;

    // If we have a saved profile ID, select it
    if (activeProfileId) {
      const activeProfile = profiles.find((p) => p.id === activeProfileId);
      if (activeProfile && (!selectedProfile || selectedProfile.id !== activeProfile.id)) {
        setSelectedProfile(activeProfile);
        return;
      }
    }

    // Fallback to first profile if no saved selection and no profile selected
    if (!selectedProfile) {
      setSelectedProfile(profiles[0]);
      updateSetting("active_profile_id", profiles[0].id);
    }
  }, [settings, profiles]);

  useEffect(() => {
    if (stats) {
      checkMilestones(stats.total_count);
    }
  }, [stats]);

  useEffect(() => {
    if (searchQuery.trim()) {
      performSearch();
    } else {
      loadRecentEntries();
    }
  }, [searchQuery]);

  const setupEventListeners = async () => {
    // Listen for history updates
    await listen("history-updated", () => {
      loadDashboardData();
    });

    // Listen for profile updates
    await listen("profiles-updated", () => {
      loadProfiles();
    });
  };

  const loadDashboardData = async () => {
    await Promise.all([loadStats(), loadRecentEntries(), loadProfiles()]);
  };

  const loadStats = async () => {
    try {
      const data: HistoryStats = await invoke("get_history_stats");
      setStats(data);
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  };

  const loadRecentEntries = async () => {
    try {
      const entries: HistoryEntry[] = await invoke("get_history_entries");
      setRecentEntries(entries.slice(0, 5));
    } catch (error) {
      console.error("Failed to load recent entries:", error);
    }
  };

  const loadProfiles = async () => {
    try {
      const data: Profile[] = await invoke("get_profiles");
      setProfiles(data);
    } catch (error) {
      console.error("Failed to load profiles:", error);
    }
  };

  const handleProfileSelect = (profile: Profile) => {
    setSelectedProfile(profile);
    updateSetting("active_profile_id", profile.id);
  };

  const performSearch = async () => {
    setIsSearching(true);
    try {
      const results: HistoryEntry[] = await invoke("search_transcriptions", {
        query: searchQuery,
        limit: 20,
      });
      setRecentEntries(results);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const toggleSaved = async (entry: HistoryEntry) => {
    try {
      await invoke("toggle_history_entry_saved", { id: entry.id });
      loadRecentEntries();
    } catch (error) {
      console.error("Failed to toggle saved status:", error);
    }
  };

  const handleEntryClick = (entry: HistoryEntry) => {
    setSelectedEntry(entry);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedEntry(null);
  };

  const handleModalToggleSaved = async () => {
    if (selectedEntry) {
      await toggleSaved(selectedEntry);
      // Update the selected entry with new saved state
      setSelectedEntry({ ...selectedEntry, saved: !selectedEntry.saved });
    }
  };

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return "—";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) return `${hours}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const checkMilestones = (count: number) => {
    const milestones = [
      { count: 1, message: "🎉 First transcription! You're on your way!" },
      { count: 10, message: "⚡ 10 transcriptions! You're getting the hang of it!" },
      { count: 50, message: "🌟 50 transcriptions! You're a power user!" },
      { count: 100, message: "🚀 100 transcriptions! Absolutely crushing it!" },
      { count: 500, message: "💫 500 transcriptions! You're unstoppable!" },
      { count: 1000, message: "🏆 1000 transcriptions! Legend status achieved!" },
    ];

    const milestone = milestones.find((m) => m.count === count);
    if (milestone) {
      setCelebrationMessage(milestone.message);
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 5000);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      className="w-full max-w-6xl mx-auto space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Celebration Banner */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="bg-gradient-to-r from-primary-500 to-purple-500 text-white rounded-xl p-4 text-center font-bold text-lg shadow-xl"
          >
            {celebrationMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Welcome Header */}
      <motion.div variants={itemVariants} className="space-y-2">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">
          Welcome back!
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          {stats && stats.total_count > 0
            ? `You've captured ${stats.total_count} transcriptions so far. Keep the momentum going!`
            : "Ready to start transcribing? Pick a profile and start recording."}
        </p>
      </motion.div>

      {/* Stats Grid */}
      {stats && stats.total_count > 0 && (
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <StatCard
            icon={<FileText className="w-5 h-5" />}
            label="Total Recordings"
            value={stats.total_count.toString()}
            color="blue"
          />
          <StatCard
            icon={<Clock className="w-5 h-5" />}
            label="Total Time"
            value={formatTime(stats.total_duration_seconds)}
            color="green"
          />
          <StatCard
            icon={<Zap className="w-5 h-5" />}
            label="Words Captured"
            value={formatNumber(stats.total_words)}
            color="purple"
          />
          <StatCard
            icon={<Activity className="w-5 h-5" />}
            label="Avg Words/Min"
            value={
              stats.total_duration_seconds > 0
                ? Math.round((stats.total_words / stats.total_duration_seconds) * 60).toString()
                : "—"
            }
            color="amber"
          />
        </motion.div>
      )}

      {/* Profile Selector - Only show in ghostwriter mode */}
      {getSetting("output_mode") === "ghostwriter" && (
        <motion.div variants={itemVariants} className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
              Active Profile
            </h2>
            {profiles.length > 6 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate?.("profiles")}
              >
                View All
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {profiles.slice(0, 6).map((profile) => (
              <button
                key={profile.id}
                onClick={() => handleProfileSelect(profile)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all cursor-pointer
                  ${
                    selectedProfile?.id === profile.id
                      ? "border-primary-500 bg-gradient-to-br from-primary-50 to-primary-100/80 dark:from-primary-900/40 dark:to-primary-800/30 shadow-md shadow-primary-500/10"
                      : "border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50/50 dark:hover:bg-primary-900/20"
                  }
                `}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ backgroundColor: profile.color + "20" }}
                >
                  {profile.icon}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="font-medium text-neutral-900 dark:text-white truncate">
                    {profile.name}
                  </div>
                  {profile.description && (
                    <div className="text-xs text-neutral-600 dark:text-neutral-400 truncate">
                      {profile.description}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Search Bar */}
      <motion.div variants={itemVariants} className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
          <Search className="w-5 h-5" />
        </div>
        <Input
          type="text"
          placeholder="Search your transcriptions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </motion.div>

      {/* Recent Transcriptions */}
      <motion.div variants={itemVariants} className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
            {searchQuery ? "Search Results" : "Recent Transcriptions"}
          </h2>
          {!searchQuery && recentEntries.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate?.("history")}
            >
              View All
            </Button>
          )}
        </div>

        {recentEntries.length === 0 ? (
          <div className="text-center py-12 px-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border-2 border-dashed border-neutral-200 dark:border-neutral-700">
            <FileText className="w-12 h-12 mx-auto mb-3 text-neutral-400" />
            <p className="text-neutral-600 dark:text-neutral-400 mb-4">
              {searchQuery
                ? "No transcriptions found. Try a different search term."
                : "No transcriptions yet. Start recording to see them here!"}
            </p>
            {!searchQuery && (
              <p className="text-sm text-neutral-500 dark:text-neutral-500">
                Tip: Use your global shortcut to start recording from anywhere
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {recentEntries.map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleEntryClick(entry)}
                className="group bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700 hover:bg-primary-100/50 dark:hover:bg-primary-950/50 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-neutral-900 dark:text-white">
                        {entry.title}
                      </span>
                      {entry.duration_seconds && (
                        <span className="text-xs text-neutral-500">
                          {formatDuration(entry.duration_seconds)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 mb-2">
                      {entry.ghostwritten_text || entry.transcription_text}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-neutral-500">
                      <span>{formatDate(entry.timestamp)}</span>
                      {entry.word_count && <span>• {entry.word_count} words</span>}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSaved(entry);
                    }}
                    className="flex-shrink-0 p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
                  >
                    <Star
                      className={`w-5 h-5 ${
                        entry.saved
                          ? "fill-amber-400 text-amber-400"
                          : "text-neutral-400"
                      }`}
                    />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Transcription Detail Modal */}
      <TranscriptionDetailModal
        entry={selectedEntry}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onToggleSaved={handleModalToggleSaved}
      />
    </motion.div>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "blue" | "green" | "purple" | "amber";
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color }) => {
  const colorClasses = {
    blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
    green: "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400",
    purple:
      "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400",
    amber:
      "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400",
  };

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl p-4 border border-neutral-200 dark:border-neutral-700">
      <div className={`inline-flex p-2 rounded-lg mb-3 ${colorClasses[color]}`}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-neutral-900 dark:text-white mb-1">
        {value}
      </div>
      <div className="text-sm text-neutral-600 dark:text-neutral-400">
        {label}
      </div>
    </div>
  );
};

export default Dashboard;
