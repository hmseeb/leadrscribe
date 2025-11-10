import React from "react";
import { motion } from "framer-motion";
import { Download, ArrowDown, Loader2 } from "lucide-react";
import { ModelInfo } from "../../lib/types";
import { formatModelSize } from "../../lib/utils/format";
import Badge from "../ui/Badge";

interface DownloadProgress {
  model_id: string;
  downloaded: number;
  total: number;
  percentage: number;
}

interface ModelCardProps {
  model: ModelInfo;
  variant?: "default" | "featured";
  disabled?: boolean;
  className?: string;
  onSelect: (modelId: string) => void;
  isDownloading?: boolean;
  downloadProgress?: DownloadProgress | null;
  isExtracting?: boolean;
}

const ModelCard: React.FC<ModelCardProps> = ({
  model,
  variant = "default",
  disabled = false,
  className = "",
  onSelect,
  isDownloading = false,
  downloadProgress = null,
  isExtracting = false,
}) => {
  const isFeatured = variant === "featured";

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <motion.div
      className={`w-full rounded-xl border-2 p-5 transition-all duration-200 ${
        isFeatured
          ? "border-primary-400 dark:border-primary-600 bg-gradient-to-br from-primary-50/50 to-white dark:from-primary-950/30 dark:to-neutral-900 shadow-md"
          : "border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm"
      } ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className={`text-xl font-bold ${isFeatured ? "text-primary-700 dark:text-primary-300" : "text-neutral-900 dark:text-neutral-100"}`}>
              {model.name}
            </h3>
            {isFeatured && (
              <Badge variant="primary">
                <span className="text-xs font-semibold">Recommended</span>
              </Badge>
            )}
          </div>

          <p className="text-neutral-600 dark:text-neutral-400 text-sm mb-4">
            {model.description}
          </p>

          <div className="flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400 mb-4">
            <Download className="w-4 h-4" />
            <span className="font-medium">{formatModelSize(model.size_mb)}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-600 dark:text-neutral-400 font-medium uppercase tracking-wide">Accuracy</span>
                <span className="text-neutral-900 dark:text-neutral-100 font-bold">{Math.round(model.accuracy_score * 100)}%</span>
              </div>
              <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary-600 to-primary-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${model.accuracy_score * 100}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-600 dark:text-neutral-400 font-medium uppercase tracking-wide">Speed</span>
                <span className="text-neutral-900 dark:text-neutral-100 font-bold">{Math.round(model.speed_score * 100)}%</span>
              </div>
              <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary-600 to-primary-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${model.speed_score * 100}%` }}
                  transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
                />
              </div>
            </div>
          </div>
        </div>

        {isDownloading ? (
          <div className="flex flex-col gap-2 min-w-[200px] items-end">
            {isExtracting ? (
              <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="font-semibold text-sm">Extracting...</span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600 dark:text-neutral-400 font-medium">Downloading...</span>
                  <span className="text-neutral-900 dark:text-neutral-100 font-bold">
                    {downloadProgress ? `${Math.round(downloadProgress.percentage)}%` : '0%'}
                  </span>
                </div>
                <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-primary-600 to-primary-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${downloadProgress?.percentage || 0}%` }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  />
                </div>
                {downloadProgress && (
                  <div className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                    <span>{formatBytes(downloadProgress.downloaded)}</span>
                    <span>/</span>
                    <span>{formatBytes(downloadProgress.total)}</span>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <motion.button
            onClick={() => onSelect(model.id)}
            disabled={disabled}
            className={`px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center gap-2 ${
              isFeatured
                ? "bg-primary-600 hover:bg-primary-700 text-white shadow-md hover:shadow-lg"
                : "bg-neutral-800 hover:bg-neutral-900 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-white shadow-sm hover:shadow-md"
            } disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex-shrink-0`}
            whileHover={disabled ? {} : { scale: 1.05 }}
            whileTap={disabled ? {} : { scale: 0.95 }}
            type="button"
          >
            <ArrowDown className="w-4 h-4" />
            Download
          </motion.button>
        )}
      </div>
    </motion.div>
  );
};

export default ModelCard;
