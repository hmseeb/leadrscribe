import { invoke } from "@tauri-apps/api/core";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit2, Trash2, X, Check } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { useSettings } from "../../hooks/useSettings";

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

const PROFILE_ICONS = ["∅", "📊", "📝", "💻", "✉️", "📞", "🎯", "💡", "📚", "🎨", "🔬"];
const PROFILE_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Green
  "#8B5CF6", // Purple
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#EC4899", // Pink
  "#14B8A6", // Teal
  "#F97316", // Orange
];

export const ProfileManager: React.FC = () => {
  const { settings, updateSetting } = useSettings();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: PROFILE_COLORS[0],
    icon: PROFILE_ICONS[0],
    custom_instructions: "",
  });

  useEffect(() => {
    loadProfiles();
  }, []);

  useEffect(() => {
    if (settings) {
      setActiveProfileId(settings.active_profile_id || null);
    }
  }, [settings]);

  const loadProfiles = async () => {
    try {
      const data: Profile[] = await invoke("get_profiles");
      // Filter out "None" profile (ID 1) from the Profiles page
      setProfiles(data.filter(p => p.id !== 1));
    } catch (error) {
      console.error("Failed to load profiles:", error);
    }
  };

  const handleProfileActivate = (profileId: number) => {
    setActiveProfileId(profileId);
    updateSetting("active_profile_id", profileId);
  };

  const validateCustomInstructions = (instructions: string, isNoneProfile: boolean = false): boolean => {
    const trimmed = instructions.trim();

    // "None" profile (ID 1) can have empty instructions
    if (isNoneProfile) {
      return true;
    }

    if (!trimmed) {
      alert("Custom instructions are required. Please provide instructions for the AI.");
      return false;
    }
    const charCount = trimmed.length;
    if (charCount < 20) {
      alert("Custom instructions must be at least 20 characters. Please provide more detailed instructions.");
      return false;
    }
    if (charCount > 10000) {
      alert("Custom instructions cannot exceed 10,000 characters. Please shorten your instructions.");
      return false;
    }
    return true;
  };

  const handleCreate = async () => {
    if (!validateCustomInstructions(formData.custom_instructions)) {
      return;
    }
    try {
      await invoke("create_profile", {
        name: formData.name,
        description: formData.description || null,
        color: formData.color,
        icon: formData.icon,
        customInstructions: formData.custom_instructions,
      });
      resetForm();
      setIsCreating(false);
      loadProfiles();
    } catch (error) {
      console.error("Failed to create profile:", error);
    }
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    // Check if editing the "None" profile (ID 1)
    if (!validateCustomInstructions(formData.custom_instructions, editingId === 1)) {
      return;
    }
    try {
      await invoke("update_profile", {
        id: editingId,
        name: formData.name,
        description: formData.description || null,
        color: formData.color,
        icon: formData.icon,
        customInstructions: formData.custom_instructions,
      });
      resetForm();
      setEditingId(null);
      loadProfiles();
    } catch (error) {
      console.error("Failed to update profile:", error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this profile?")) return;
    try {
      await invoke("delete_profile", { id });
      loadProfiles();
    } catch (error) {
      console.error("Failed to delete profile:", error);
    }
  };

  const startEdit = (profile: Profile) => {
    setEditingId(profile.id);
    setFormData({
      name: profile.name,
      description: profile.description || "",
      color: profile.color,
      icon: profile.icon,
      custom_instructions: profile.custom_instructions || "",
    });
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      color: PROFILE_COLORS[0],
      icon: PROFILE_ICONS[0],
      custom_instructions: "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsCreating(false);
    resetForm();
  };

  return (
    <div className="w-full max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
            Voice Profiles
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            Customize AI behavior for different contexts
          </p>
        </div>
        {!isCreating && !editingId && (
          <Button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Profile
          </Button>
        )}
      </div>

      {/* Create/Edit Form */}
      <AnimatePresence>
        {(isCreating || editingId) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-neutral-200 dark:border-neutral-700 shadow-lg"
          >
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
              {editingId ? "Edit Profile" : "Create New Profile"}
            </h3>

            <div className="space-y-4">
              {/* Icon Selector */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Icon
                </label>
                <div className="flex gap-2 flex-wrap">
                  {PROFILE_ICONS.map((icon) => (
                    <button
                      key={icon}
                      onClick={() => setFormData({ ...formData, icon })}
                      className={`
                        w-12 h-12 text-2xl rounded-lg border-2 transition-all
                        ${
                          formData.icon === icon
                            ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                            : "border-neutral-200 dark:border-neutral-700 hover:border-primary-300"
                        }
                      `}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Selector */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Color
                </label>
                <div className="flex gap-2">
                  {PROFILE_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setFormData({ ...formData, color })}
                      className={`
                        w-10 h-10 rounded-lg border-2 transition-all
                        ${
                          formData.color === color
                            ? "border-neutral-900 dark:border-white scale-110"
                            : "border-transparent hover:scale-105"
                        }
                      `}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Name *
                </label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Meeting, Email, Code Review"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Description
                </label>
                <Input
                  type="text"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Brief description of this profile"
                />
              </div>

              {/* Custom Instructions */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Custom AI Instructions *
                </label>
                <textarea
                  value={formData.custom_instructions}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      custom_instructions: e.target.value,
                    })
                  }
                  placeholder="Tell the AI how to format your transcriptions for this context... (20-10,000 characters)"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={4}
                  maxLength={10000}
                />
                <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  {formData.custom_instructions.trim().length} / 10,000 characters
                  {formData.custom_instructions.trim().length < 20 && formData.custom_instructions.trim().length > 0 &&
                    <span className="text-red-500 ml-2">(minimum 20 characters required)</span>
                  }
                  {formData.custom_instructions.trim().length > 10000 &&
                    <span className="text-red-500 ml-2">(exceeds maximum)</span>
                  }
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={editingId ? handleUpdate : handleCreate}
                  disabled={
                    !formData.name.trim() ||
                    // "None" profile (ID 1) can have empty instructions, others require 20+ chars
                    (editingId !== 1 && (
                      !formData.custom_instructions.trim() ||
                      formData.custom_instructions.trim().length < 20
                    )) ||
                    formData.custom_instructions.trim().length > 10000
                  }
                  className="flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {editingId ? "Update" : "Create"}
                </Button>
                <Button onClick={cancelEdit} variant="secondary">
                  <X className="w-4 h-4" />
                  Cancel
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profiles List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {profiles.map((profile) => (
          <motion.div
            key={profile.id}
            layout
            onClick={() => handleProfileActivate(profile.id)}
            className={`
              rounded-xl p-4 border-2 transition-all cursor-pointer
              ${
                activeProfileId === profile.id
                  ? "border-primary-500 bg-gradient-to-br from-primary-50 to-primary-100/80 dark:from-primary-900/40 dark:to-primary-800/30 shadow-md shadow-primary-500/10"
                  : "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50/50 dark:hover:bg-primary-900/20"
              }
            `}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ backgroundColor: profile.color + "20" }}
                >
                  {profile.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-neutral-900 dark:text-white">
                      {profile.name}
                    </h3>
                    {activeProfileId === profile.id && (
                      <span className="px-2 py-0.5 bg-primary-500 text-white text-xs rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                  {profile.description && (
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                      {profile.description}
                    </p>
                  )}
                  {profile.custom_instructions && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-2 line-clamp-2">
                      {profile.custom_instructions}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => startEdit(profile)}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
                >
                  <Edit2 className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                </button>
                <button
                  onClick={() => handleDelete(profile.id)}
                  className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {profiles.length === 0 && !isCreating && (
        <div className="text-center py-12 px-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border-2 border-dashed border-neutral-200 dark:border-neutral-700">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-neutral-600 dark:text-neutral-400 mb-4">
            No profiles yet. Create your first profile to get started!
          </p>
          <Button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 mx-auto"
          >
            <Plus className="w-4 h-4" />
            Create Profile
          </Button>
        </div>
      )}
    </div>
  );
};

export default ProfileManager;
