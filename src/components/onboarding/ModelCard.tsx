import React from "react";
import { motion } from "framer-motion";
import { Download } from "lucide-react";
import { ModelInfo } from "../../lib/types";
import { formatModelSize } from "../../lib/utils/format";
import Badge from "../ui/Badge";

interface ModelCardProps {
  model: ModelInfo;
  variant?: "default" | "featured";
  disabled?: boolean;
  className?: string;
  onSelect: (modelId: string) => void;
}

const ModelCard: React.FC<ModelCardProps> = ({
  model,
  variant = "default",
  disabled = false,
  className = "",
  onSelect,
}) => {
  const isFeatured = variant === "featured";

  const baseButtonClasses =
    "flex justify-between items-center rounded-xl p-4 px-5 text-left transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 cursor-pointer group";

  const variantClasses = isFeatured
    ? "border-2 border-primary-300 dark:border-primary-700 bg-gradient-to-br from-primary-50 to-primary-100/50 dark:from-primary-950/30 dark:to-primary-950/20 hover:border-primary-400 dark:hover:border-primary-600 hover:shadow-lg focus:ring-primary-500/20 shadow-md"
    : "border border-border dark:border-neutral-700 bg-surface dark:bg-neutral-800/50 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md focus:ring-primary-500/20 shadow-sm";

  return (
    <motion.button
      onClick={() => onSelect(model.id)}
      disabled={disabled}
      className={[baseButtonClasses, variantClasses, className]
        .filter(Boolean)
        .join(" ")}
      type="button"
      whileHover={disabled ? {} : { scale: 1.02, y: -2 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      <div className="flex flex-col items-start">
        <div className="flex items-center gap-3 mb-1.5">
          <h3 className={`text-lg font-semibold transition-colors ${isFeatured ? "text-primary-700 dark:text-primary-300" : "text-text dark:text-neutral-100 group-hover:text-primary-600 dark:group-hover:text-primary-400"}`}>
            {model.name}
          </h3>
          <DownloadSize sizeMb={model.size_mb} />
          {isFeatured && <Badge variant="primary">Recommended</Badge>}
        </div>
        <p className="text-text-muted dark:text-neutral-400 text-sm leading-relaxed">
          {model.description}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <p className="text-xs text-text-subtle dark:text-neutral-500 w-16 text-right font-medium">
            accuracy
          </p>
          <div className="w-24 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${model.accuracy_score * 100}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-xs text-text-subtle dark:text-neutral-500 w-16 text-right font-medium">
            speed
          </p>
          <div className="w-24 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${model.speed_score * 100}%` }}
              transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>
    </motion.button>
  );
};

const DownloadSize = ({ sizeMb }: { sizeMb: number }) => {
  return (
    <div className="flex items-center gap-1.5 text-xs text-text/60 tabular-nums">
      <Download
        aria-hidden="true"
        className="h-3.5 w-3.5 text-text/45"
        strokeWidth={1.75}
      />
      <span className="sr-only">Download size</span>
      <span className="font-medium text-text/70">
        {formatModelSize(sizeMb)}
      </span>
    </div>
  );
};

export default ModelCard;
