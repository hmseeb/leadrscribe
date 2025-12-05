import { invoke } from "@tauri-apps/api/core";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  FileText,
  Users,
  Cog,
  Star,
  Clock,
  Command,
  Home,
} from "lucide-react";
import React, { useState, useEffect, useRef } from "react";

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

interface CommandItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  category: "navigation" | "action" | "transcription";
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (section: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<(CommandItem | HistoryEntry)[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Navigation commands
  const navigationCommands: CommandItem[] = [
    {
      id: "nav-dashboard",
      label: "Go to Dashboard",
      icon: <Home className="w-4 h-4" />,
      action: () => {
        onNavigate("dashboard");
        onClose();
      },
      category: "navigation",
    },
    {
      id: "nav-history",
      label: "Go to History",
      icon: <FileText className="w-4 h-4" />,
      action: () => {
        onNavigate("history");
        onClose();
      },
      category: "navigation",
    },
    {
      id: "nav-profiles",
      label: "Go to Profiles",
      icon: <Users className="w-4 h-4" />,
      action: () => {
        onNavigate("profiles");
        onClose();
      },
      category: "navigation",
    },
    {
      id: "nav-settings",
      label: "Go to Settings",
      icon: <Cog className="w-4 h-4" />,
      action: () => {
        onNavigate("general");
        onClose();
      },
      category: "navigation",
    },
    {
      id: "nav-about",
      label: "Go to About",
      icon: <FileText className="w-4 h-4" />,
      action: () => {
        onNavigate("about");
        onClose();
      },
      category: "navigation",
    },
  ];

  // Action commands
  const actionCommands: CommandItem[] = [
    {
      id: "action-saved",
      label: "Show Saved Transcriptions",
      icon: <Star className="w-4 h-4" />,
      action: async () => {
        onNavigate("search");
        onClose();
      },
      category: "action",
    },
    {
      id: "action-recent",
      label: "Show Recent Transcriptions",
      icon: <Clock className="w-4 h-4" />,
      action: () => {
        onNavigate("dashboard");
        onClose();
      },
      category: "action",
    },
  ];

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    if (query.trim()) {
      performSearch(query);
    } else {
      // Show all commands when no query
      setResults([...navigationCommands, ...actionCommands]);
    }
  }, [query, isOpen]);

  const performSearch = async (searchQuery: string) => {
    const lowerQuery = searchQuery.toLowerCase();

    // Filter commands
    const filteredCommands = [...navigationCommands, ...actionCommands].filter(
      (cmd) => cmd.label.toLowerCase().includes(lowerQuery)
    );

    // Search transcriptions
    let transcriptions: HistoryEntry[] = [];
    try {
      transcriptions = await invoke("search_transcriptions", {
        query: searchQuery,
        limit: 10,
      });
    } catch (error) {
      console.error("Search failed:", error);
    }

    setResults([...filteredCommands, ...transcriptions]);
    setSelectedIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      executeSelected();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  const executeSelected = () => {
    const selected = results[selectedIndex];
    if (!selected) return;

    if ("action" in selected) {
      // It's a command
      selected.action();
    } else {
      // It's a transcription - navigate to search with this entry
      onNavigate("search");
      onClose();
    }
  };

  const isCommand = (item: CommandItem | HistoryEntry): item is CommandItem => {
    return "action" in item;
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-[20vh]"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl bg-white rounded-wobbly-lg shadow-xl border-3 border-pencil overflow-hidden"
        >
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b-3 border-pencil">
            <Search className="w-5 h-5 text-text-subtle" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search commands or transcriptions..."
              className="flex-1 outline-none bg-transparent text-pencil text-lg"
            />
            <div className="flex items-center gap-1 text-xs text-text-subtle">
              <kbd className="px-2 py-1 bg-old-paper rounded-wobbly border-2 border-pencil">
                <Command className="w-3 h-3 inline" />K
              </kbd>
              <span>to close</span>
            </div>
          </div>

          {/* Results */}
          <div className="max-h-[400px] overflow-y-auto">
            {results.length === 0 ? (
              <div className="px-4 py-8 text-center text-text-subtle">
                {query.trim()
                  ? "No results found"
                  : "Type to search commands or transcriptions"}
              </div>
            ) : (
              <div className="py-2">
                {results.map((item, index) => {
                  const isSelected = index === selectedIndex;
                  const isCmd = isCommand(item);

                  return (
                    <button
                      key={isCmd ? item.id : (item as HistoryEntry).id}
                      onClick={() => {
                        setSelectedIndex(index);
                        executeSelected();
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`
                        w-full px-4 py-3 text-left flex items-start gap-3 transition-colors
                        ${
                          isSelected
                            ? "bg-post-it"
                            : "hover:bg-old-paper"
                        }
                      `}
                    >
                      {isCmd ? (
                        <>
                          <div
                            className={`
                            flex-shrink-0 w-8 h-8 rounded-wobbly flex items-center justify-center border-2 border-pencil
                            ${
                              isSelected
                                ? "bg-red-marker text-white"
                                : "bg-white text-pencil"
                            }
                          `}
                          >
                            {item.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-pencil">
                              {item.label}
                            </div>
                            <div className="text-xs text-text-subtle capitalize">
                              {item.category}
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div
                            className={`
                            flex-shrink-0 w-8 h-8 rounded-wobbly flex items-center justify-center border-2 border-pencil
                            ${
                              isSelected
                                ? "bg-red-marker text-white"
                                : "bg-white text-pencil"
                            }
                          `}
                          >
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-pencil truncate">
                              {item.title}
                            </div>
                            <div className="text-sm text-text-subtle line-clamp-1">
                              {item.ghostwritten_text || item.transcription_text}
                            </div>
                            <div className="text-xs text-text-subtle mt-1">
                              {formatDate(item.timestamp)}
                              {item.word_count && ` • ${item.word_count} words`}
                            </div>
                          </div>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t-2 border-pencil text-xs text-text-subtle flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-old-paper rounded-wobbly border-2 border-pencil">
                  ↑↓
                </kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-old-paper rounded-wobbly border-2 border-pencil">
                  ↵
                </kbd>
                Select
              </span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-old-paper rounded-wobbly border-2 border-pencil">
                Esc
              </kbd>
              Close
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CommandPalette;
