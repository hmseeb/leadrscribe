import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X, Copy } from "lucide-react";
import { ModelInfo } from "../../lib/types";
import ModelCard from "./ModelCard";
import LeadrScribeIcon from "../icons/LeadrScribeIcon";

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
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const checkMaximized = async () => {
      const maximized = await getCurrentWindow().isMaximized();
      setIsMaximized(maximized);
    };
    checkMaximized();
    const unlisten = getCurrentWindow().onResized(() => {
      checkMaximized();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

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

    // Listen for download errors
    const downloadErrorUnlisten = listen<{ model_id: string; error: string }>("model-download-error", (event) => {
      console.error("Download error:", event.payload);
      setError(`Download failed: ${event.payload.error}`);
      setDownloadingModelId(null);
      setDownloadProgress(null);
      setIsExtracting(false);
    });

    // Listen for download cancellation
    const downloadCancelledUnlisten = listen<string>("model-download-cancelled", (event) => {
      console.log("Download cancelled for:", event.payload);
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
      downloadErrorUnlisten.then((fn) => fn());
      downloadCancelledUnlisten.then((fn) => fn());
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

  const handleCancelDownload = async (modelId: string) => {
    try {
      await invoke("cancel_download", { modelId });
      setDownloadingModelId(null);
      setDownloadProgress(null);
      setIsExtracting(false);
    } catch (err) {
      console.error("Failed to cancel download:", err);
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
    <div className="h-screen w-screen flex flex-col inset-0 bg-background">
      {/* Title bar with window controls */}
      <div className="h-10 flex items-center justify-between shrink-0 bg-sidebar border-b border-sidebar-border select-none">
        <div data-tauri-drag-region className="flex items-center gap-2 px-3 flex-1 h-full">
          <LeadrScribeIcon width={20} height={20} className="text-primary" />
        </div>
        <div className="flex items-center h-full">
          <button
            onMouseDown={() => getCurrentWindow().minimize()}
            className="h-full px-3 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Minimize"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onMouseDown={() => getCurrentWindow().toggleMaximize().then(() => getCurrentWindow().isMaximized()).then(setIsMaximized)}
            className="h-full px-3 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? <Copy className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
          </button>
          <button
            onMouseDown={() => getCurrentWindow().close()}
            className="h-full px-3 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-rose-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col p-8 gap-6 overflow-auto">
        <motion.div
          className="flex flex-col items-center gap-2 shrink-0"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, type: "spring", stiffness: 500 }}
        >
          <h1 className="text-2xl font-semibold text-foreground">
            Choose a transcription model
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto text-center">
            Download a model to get started with speech-to-text
          </p>
        </motion.div>

      <div className="max-w-3xl w-full mx-auto flex-1 flex flex-col min-h-0">
        {error && (
          <motion.div
            className="bg-destructive/10 rounded-lg border border-destructive/30 p-4 mb-6 shrink-0 "
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <p className="text-destructive text-sm font-medium">
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
                  onCancel={handleCancelDownload}
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
                  onCancel={handleCancelDownload}
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
