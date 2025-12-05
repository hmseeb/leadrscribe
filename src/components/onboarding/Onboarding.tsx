import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ModelInfo } from "../../lib/types";
import ModelCard from "./ModelCard";
import LeadrScribeLogo from "../icons/LeadrScribeLogo";

interface OnboardingProps {
  onModelSelected: () => void;
}

interface DownloadProgress {
  model_id: string;
  downloaded: number;
  total: number;
  percentage: number;
}

const Onboarding: React.FC<OnboardingProps> = ({ onModelSelected }) => {
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadModels();

    // Listen for download progress
    const progressUnlisten = listen<DownloadProgress>("model-download-progress", (event) => {
      setDownloadProgress(event.payload);
    });

    // Listen for download completion
    const completeUnlisten = listen<string>("model-download-complete", async (event) => {
      const modelId = event.payload;
      console.log("Download completed for:", modelId);
      // Don't navigate yet - wait for extraction if needed
    });

    // Listen for extraction events
    const extractStartUnlisten = listen<string>("model-extraction-started", () => {
      setIsExtracting(true);
    });

    const extractCompleteUnlisten = listen<string>("model-extraction-completed", async (event) => {
      const modelId = event.payload;
      console.log("Extraction completed for:", modelId);

      // Set as active model
      try {
        console.log("Calling set_active_model for:", modelId);
        await invoke("set_active_model", { modelId });
        console.log("Successfully called set_active_model, model should be loaded");

        // Verify the model is actually loaded
        const status = await invoke("get_transcription_model_status");
        console.log("Model status after set_active_model:", status);

        // Now navigate to main app
        onModelSelected();
      } catch (err) {
        console.error("Failed to set active model:", err);
        setError(`Failed to activate model: ${err}`);
        setDownloadingModelId(null);
        setDownloadProgress(null);
        setIsExtracting(false);
      }
    });

    const extractFailedUnlisten = listen<{ model_id: string; error: string }>("model-extraction-failed", (event) => {
      setError(`Extraction failed: ${event.payload.error}`);
      setDownloadingModelId(null);
      setDownloadProgress(null);
      setIsExtracting(false);
    });

    return () => {
      progressUnlisten.then((fn) => fn());
      completeUnlisten.then((fn) => fn());
      extractStartUnlisten.then((fn) => fn());
      extractCompleteUnlisten.then((fn) => fn());
      extractFailedUnlisten.then((fn) => fn());
    };
  }, [onModelSelected]);

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
    setDownloadingModelId(modelId);
    setDownloadProgress(null);
    setIsExtracting(false);
    setError(null);

    try {
      // Start download in background
      await invoke("download_model", { modelId });
    } catch (err) {
      console.error("Download failed:", err);
      setError(`Failed to start download: ${err}`);
      setDownloadingModelId(null);
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
    <div className="h-screen w-screen flex flex-col inset-0 bg-paper">
      {/* Title bar with window controls */}
      <div data-tauri-drag-region className="h-8 flex items-center justify-end px-3 shrink-0 bg-white border-b-3 border-pencil">
        <div className="flex items-center gap-2">
          <button
            onClick={() => getCurrentWindow().minimize()}
            className="w-3 h-3 rounded-wobbly-full bg-post-it border-2 border-pencil hover:bg-old-paper transition-colors"
            aria-label="Minimize"
          />
          <button
            onClick={() => getCurrentWindow().close()}
            className="w-3 h-3 rounded-wobbly-full bg-red-marker border-2 border-pencil hover:bg-primary-600 transition-colors"
            aria-label="Close"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col p-8 gap-6 overflow-auto">
        <motion.div
          className="flex flex-col items-center gap-3 shrink-0"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, type: "spring", stiffness: 500 }}
        >
          <LeadrScribeLogo width={200} />
          <h1 className="text-2xl font-kalam font-bold text-pencil">Welcome to LeadrScribe</h1>
          <p className="text-text-muted max-w-md font-medium mx-auto text-center">
            Choose and download a transcription model to get started
          </p>
        </motion.div>

      <div className="max-w-3xl w-full mx-auto text-center flex-1 flex flex-col min-h-0">
        {error && (
          <motion.div
            className="bg-red-marker/10 border-3 border-red-marker rounded-wobbly-lg p-4 mb-6 shrink-0 shadow-md"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <p className="text-red-marker text-sm font-medium">
              {error}
            </p>
          </motion.div>
        )}

        <motion.div
          className="flex flex-col gap-3"
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
                  disabled={downloadingModelId !== null && downloadingModelId !== model.id}
                  isDownloading={downloadingModelId === model.id}
                  downloadProgress={downloadingModelId === model.id ? downloadProgress : null}
                  isExtracting={downloadingModelId === model.id && isExtracting}
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
                  disabled={downloadingModelId !== null && downloadingModelId !== model.id}
                  isDownloading={downloadingModelId === model.id}
                  downloadProgress={downloadingModelId === model.id ? downloadProgress : null}
                  isExtracting={downloadingModelId === model.id && isExtracting}
                  onSelect={handleDownloadModel}
                />
              </motion.div>
            ))}
        </motion.div>
      </div>
      </div>
    </div>
  );
};

export default Onboarding;
