import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { ModelInfo } from "../../lib/types";
import ModelCard from "./ModelCard";
import LeadrScribeLogo from "../icons/LeadrScribeLogo";

interface OnboardingProps {
  onModelSelected: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onModelSelected }) => {
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      const models: ModelInfo[] = await invoke("get_available_models");
      // Only show downloadable models for onboarding
      setAvailableModels(models.filter((m) => !m.is_downloaded));
    } catch (err) {
      console.error("Failed to load models:", err);
      setError("Failed to load available models");
    }
  };

  const handleDownloadModel = async (modelId: string) => {
    setDownloading(true);
    setError(null);

    // Immediately transition to main app - download will continue in footer
    onModelSelected();

    try {
      await invoke("download_model", { modelId });
    } catch (err) {
      console.error("Download failed:", err);
      setError(`Failed to download model: ${err}`);
      setDownloading(false);
    }
  };

  const getRecommendedBadge = (modelId: string): boolean => {
    return modelId === "parakeet-tdt-0.6b-v3";
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <div className="h-screen w-screen flex flex-col p-6 gap-6 inset-0 bg-gradient-to-br from-background via-background to-primary-50/30 dark:to-primary-950/10">
      <motion.div
        className="flex flex-col items-center gap-3 shrink-0"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <LeadrScribeLogo width={200} />
        <p className="text-text-muted dark:text-neutral-400 max-w-md font-medium mx-auto text-center">
          To get started, choose a transcription model
        </p>
      </motion.div>

      <div className="max-w-[680px] w-full mx-auto text-center flex-1 flex flex-col min-h-0">
        {error && (
          <motion.div
            className="bg-error-500/10 dark:bg-error-500/20 border border-error-500/30 dark:border-error-500/40 rounded-xl p-4 mb-4 shrink-0 shadow-sm"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <p className="text-error-600 dark:text-error-400 text-sm font-medium">
              {error}
            </p>
          </motion.div>
        )}

        <motion.div
          className="flex flex-col gap-4"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {availableModels
            .filter((model) => getRecommendedBadge(model.id))
            .map((model, index) => (
              <motion.div key={model.id} variants={itemVariants}>
                <ModelCard
                  model={model}
                  variant="featured"
                  disabled={downloading}
                  onSelect={handleDownloadModel}
                />
              </motion.div>
            ))}

          {availableModels
            .filter((model) => !getRecommendedBadge(model.id))
            .sort((a, b) => a.size_mb - b.size_mb)
            .map((model, index) => (
              <motion.div key={model.id} variants={itemVariants}>
                <ModelCard
                  model={model}
                  disabled={downloading}
                  onSelect={handleDownloadModel}
                />
              </motion.div>
            ))}
        </motion.div>
      </div>
    </div>
  );
};

export default Onboarding;
