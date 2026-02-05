import React from "react";
import { motion } from "framer-motion";
import { ArrowDown, Loader2, X } from "lucide-react";
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
  onCancel?: (modelId: string) => void;
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
  onCancel,
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
      className={`w-full rounded-xl border p-4 shadow-sm ${
        isFeatured
          ? "bg-primary/10 border-primary/30"
          : "bg-card border-border/30"
      } ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-sans font-bold text-foreground">
              {model.name}
            </h3>
            {isFeatured && (
              <Badge variant="secondary">
                <span className="text-xs font-medium">Recommended</span>
              </Badge>
            )}
          </div>

          <p className="text-sm text-muted-foreground mb-1 text-left">
            {model.description}
          </p>

          <span className="text-xs text-muted-foreground">
            ~{formatModelSize(model.size_mb)}
          </span>
        </div>

        {isDownloading ? (
          <div className="flex items-center gap-3">
            <div className="flex flex-col gap-1.5 min-w-[180px] items-end">
              {isExtracting ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />
                  <span className="font-medium text-sm">Extracting...</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3 text-sm w-full">
                    <span className="text-muted-foreground text-xs">
                      {downloadProgress ? `${Math.round(downloadProgress.percentage)}%` : '0%'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {downloadProgress && `${formatBytes(downloadProgress.downloaded)} / ${formatBytes(downloadProgress.total)}`}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full border border-border/30 overflow-hidden w-full">
                    <motion.div
                      className="h-full bg-primary rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${downloadProgress?.percentage || 0}%` }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    />
                  </div>
                </>
              )}
            </div>
            {!isExtracting && onCancel && (
              <motion.button
                onClick={() => onCancel(model.id)}
                className="p-2 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                whileTap={{ scale: 0.95 }}
                title="Cancel download"
              >
                <X className="w-4 h-4" strokeWidth={2.5} />
              </motion.button>
            )}
          </div>
        ) : (
          <motion.button
            onClick={() => onSelect(model.id)}
            disabled={disabled}
            className={`px-4 py-2 rounded-lg border border-border/50 font-semibold text-sm transition-all duration-100 flex items-center gap-2 ${
              isFeatured
                ? "bg-secondary text-secondary-foreground hover:shadow-sm"
                : "bg-card text-foreground hover:bg-muted"
            } disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer`}
            whileTap={disabled ? {} : { scale: 0.98 }}
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
