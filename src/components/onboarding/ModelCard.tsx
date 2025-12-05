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
      className={`w-full rounded-wobbly-lg border-3 border-pencil p-5 transition-all duration-100 rotate-slightly-left hover:rotate-0 ${
        isFeatured
          ? "bg-post-it shadow-lg"
          : "bg-white shadow-md"
      } ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, type: "spring", stiffness: 500 }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className={`text-xl font-kalam font-bold text-pencil`}>
              {model.name}
            </h3>
            {isFeatured && (
              <Badge variant="primary">
                <span className="text-xs font-semibold">Recommended</span>
              </Badge>
            )}
          </div>

          <p className="text-pencil text-sm mb-4">
            {model.description}
          </p>

          <div className="flex items-center gap-1.5 text-sm text-text-muted mb-4">
            <Download className="w-4 h-4" strokeWidth={2.5} />
            <span className="font-medium">{formatModelSize(model.size_mb)}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted font-medium uppercase tracking-wide">Accuracy</span>
                <span className="text-pencil font-bold">{Math.round(model.accuracy_score * 100)}%</span>
              </div>
              <div className="h-2 bg-old-paper border-2 border-pencil rounded-wobbly overflow-hidden">
                <motion.div
                  className="h-full bg-red-marker"
                  initial={{ width: 0 }}
                  animate={{ width: `${model.accuracy_score * 100}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted font-medium uppercase tracking-wide">Speed</span>
                <span className="text-pencil font-bold">{Math.round(model.speed_score * 100)}%</span>
              </div>
              <div className="h-2 bg-old-paper border-2 border-pencil rounded-wobbly overflow-hidden">
                <motion.div
                  className="h-full bg-red-marker"
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
              <div className="flex items-center gap-2 text-red-marker">
                <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2.5} />
                <span className="font-semibold text-sm">Extracting...</span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm w-full">
                  <span className="text-text-muted font-medium">Downloading...</span>
                  <span className="text-pencil font-bold">
                    {downloadProgress ? `${Math.round(downloadProgress.percentage)}%` : '0%'}
                  </span>
                </div>
                <div className="h-2 bg-old-paper border-2 border-pencil rounded-wobbly overflow-hidden w-full">
                  <motion.div
                    className="h-full bg-red-marker"
                    initial={{ width: 0 }}
                    animate={{ width: `${downloadProgress?.percentage || 0}%` }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  />
                </div>
                {downloadProgress && (
                  <div className="flex items-center gap-1 text-xs text-text-muted">
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
            className={`px-6 py-3 rounded-wobbly-md border-3 border-pencil font-bold text-sm transition-all duration-100 flex items-center gap-2 ${
              isFeatured
                ? "bg-red-marker text-white shadow-lg hover:shadow-md hover:translate-x-[2px] hover:translate-y-[2px]"
                : "bg-white text-pencil shadow-md hover:bg-red-marker hover:text-white"
            } disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex-shrink-0`}
            whileHover={disabled ? {} : { scale: 1.02 }}
            whileTap={disabled ? {} : { scale: 0.96, rotate: Math.random() * 4 - 2 }}
            type="button"
          >
            <ArrowDown className="w-4 h-4" strokeWidth={2.5} />
            Download
          </motion.button>
        )}
      </div>
    </motion.div>
  );
};

export default ModelCard;
