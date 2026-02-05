import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "primary" | "accent";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  const variants = {
    default:
      "bg-slate-800/80 text-slate-300 border-slate-700/50",
    primary:
      "bg-primary-500/10 text-primary-400 border-primary-500/30",
    accent:
      "bg-accent-500/10 text-accent-400 border-accent-500/30",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border backdrop-blur-sm",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
