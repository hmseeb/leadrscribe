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
  "#2d5da1", // Blue pen
  "#10B981", // Green
  "#8B5CF6", // Purple
  "#F59E0B", // Amber
  "#ff4d4d", // Red marker
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
          <h1 className="text-3xl font-kalam font-bold text-pencil">
            Voice Profiles
          </h1>
          <p className="text-sm text-text-subtle mt-1">
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
            className="bg-white rounded-wobbly-lg p-6 border-3 border-pencil shadow-md"
          >
            <h3 className="text-lg font-kalam font-bold text-pencil mb-4">
              {editingId ? "Edit Profile" : "Create New Profile"}
            </h3>

            <div className="space-y-4">
              {/* Icon Selector */}
              <div>
                <label className="block text-sm font-medium text-pencil mb-2">
                  Icon
                </label>
                <div className="flex gap-2 flex-wrap">
                  {PROFILE_ICONS.map((icon) => (
                    <button
                      key={icon}
                      onClick={() => setFormData({ ...formData, icon })}
                      className={`
                        w-12 h-12 text-2xl rounded-wobbly border-2 border-pencil transition-all
                        ${
                          formData.icon === icon
                            ? "bg-post-it"
                            : "bg-white hover:bg-old-paper"
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
                <label className="block text-sm font-medium text-pencil mb-2">
                  Color
                </label>
                <div className="flex gap-2">
                  {PROFILE_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setFormData({ ...formData, color })}
                      className={`
                        w-10 h-10 rounded-wobbly border-2 transition-all
                        ${
                          formData.color === color
                            ? "border-pencil scale-110"
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
                <label className="block text-sm font-medium text-pencil mb-2">
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
                <label className="block text-sm font-medium text-pencil mb-2">
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
                <label className="block text-sm font-medium text-pencil mb-2">
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
                  className="w-full px-3 py-2 border-3 border-pencil rounded-wobbly-lg bg-white text-pencil focus:outline-none focus:ring-2 focus:ring-blue-pen"
                  rows={4}
                  maxLength={10000}
                />
                <div className="mt-1 text-xs text-text-subtle">
                  {formData.custom_instructions.trim().length} / 10,000 characters
                  {formData.custom_instructions.trim().length < 20 && formData.custom_instructions.trim().length > 0 &&
                    <span className="text-red-marker ml-2">(minimum 20 characters required)</span>
                  }
                  {formData.custom_instructions.trim().length > 10000 &&
                    <span className="text-red-marker ml-2">(exceeds maximum)</span>
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
              rounded-wobbly-lg p-4 border-3 transition-all cursor-pointer
              ${
                activeProfileId === profile.id
                  ? "border-blue-pen bg-post-it shadow-md"
                  : "bg-white border-pencil hover:bg-old-paper"
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
                    <h3 className="font-semibold text-pencil">
                      {profile.name}
                    </h3>
                    {activeProfileId === profile.id && (
                      <span className="px-2 py-0.5 bg-blue-pen text-white text-xs rounded-wobbly">
                        Active
                      </span>
                    )}
                  </div>
                  {profile.description && (
                    <p className="text-sm text-text-subtle mt-1">
                      {profile.description}
                    </p>
                  )}
                  {profile.custom_instructions && (
                    <p className="text-xs text-text-subtle mt-2 line-clamp-2">
                      {profile.custom_instructions}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => startEdit(profile)}
                  className="p-2 hover:bg-old-paper rounded-wobbly transition-colors"
                >
                  <Edit2 className="w-4 h-4 text-pencil" />
                </button>
                <button
                  onClick={() => handleDelete(profile.id)}
                  className="p-2 hover:bg-red-marker/20 rounded-wobbly transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-red-marker" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {profiles.length === 0 && !isCreating && (
        <div className="text-center py-12 px-4 bg-white rounded-wobbly-lg border-3 border-dashed border-pencil shadow-md">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-text-subtle mb-4">
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
