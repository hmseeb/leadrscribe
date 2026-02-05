import { invoke } from "@tauri-apps/api/core";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus } from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import { cn } from "../../lib/utils";

interface Tag {
  id: number;
  name: string;
  color: string;
  created_at: number;
}

interface TagInputProps {
  selectedTags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
  placeholder?: string;
}

const TAG_COLORS = [
  "#3B82F6", "#10B981", "#8B5CF6", "#F59E0B",
  "#EF4444", "#EC4899", "#14B8A6", "#F97316",
];

export const TagInput: React.FC<TagInputProps> = ({
  selectedTags,
  onTagsChange,
  placeholder = "Add tags...",
}) => {
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (inputValue.trim()) {
      searchTags(inputValue);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [inputValue]);

  const searchTags = async (query: string) => {
    try {
      const results: Tag[] = await invoke("search_tags", { query });
      const filtered = results.filter(
        (tag) => !selectedTags.some((selected) => selected.id === tag.id)
      );
      setSuggestions(filtered);
      setShowSuggestions(true);
    } catch (error) {
      console.error("Failed to search tags:", error);
    }
  };

  const createNewTag = async () => {
    if (!inputValue.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const randomColor = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
      const tagId: number = await invoke("create_tag", {
        name: inputValue.trim(),
        color: randomColor,
      });

      const newTag: Tag = {
        id: tagId,
        name: inputValue.trim(),
        color: randomColor,
        created_at: Date.now() / 1000,
      };

      onTagsChange([...selectedTags, newTag]);
      setInputValue("");
      setShowSuggestions(false);
    } catch (error) {
      console.error("Failed to create tag:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const selectTag = (tag: Tag) => {
    onTagsChange([...selectedTags, tag]);
    setInputValue("");
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const removeTag = (tagId: number) => {
    onTagsChange(selectedTags.filter((tag) => tag.id !== tagId));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (suggestions.length > 0) {
        selectTag(suggestions[0]);
      } else if (inputValue.trim()) {
        createNewTag();
      }
    } else if (e.key === "Backspace" && !inputValue && selectedTags.length > 0) {
      removeTag(selectedTags[selectedTags.length - 1].id);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-wrap gap-2 p-2 rounded-lg border border-input/50 bg-background focus-within:ring-2 focus-within:ring-ring transition-all">
        {selectedTags.map((tag) => (
          <motion.div
            key={tag.id}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium text-white"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            <button
              onClick={() => removeTag(tag.id)}
              className="hover:bg-black/20 p-0.5 rounded transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => inputValue && setShowSuggestions(true)}
          placeholder={selectedTags.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] outline-none bg-transparent text-foreground"
        />
      </div>

      <AnimatePresence>
        {showSuggestions && (suggestions.length > 0 || inputValue.trim()) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-1 bg-popover rounded-lg border border-border shadow-lg overflow-hidden"
          >
            {suggestions.map((tag) => (
              <button
                key={tag.id}
                onClick={() => selectTag(tag)}
                className="w-full px-3 py-2 text-left hover:bg-accent transition-colors flex items-center gap-2"
              >
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="text-popover-foreground">{tag.name}</span>
              </button>
            ))}

            {inputValue.trim() && !suggestions.some((tag) => tag.name.toLowerCase() === inputValue.toLowerCase()) && (
              <button
                onClick={createNewTag}
                disabled={isCreating}
                className="w-full px-3 py-2 text-left border-t border-border hover:bg-muted transition-colors flex items-center gap-2 text-primary"
              >
                <Plus className="w-4 h-4" />
                <span>Create "{inputValue}"</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TagInput;
