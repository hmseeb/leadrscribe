import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className, hover = true }: CardProps) {
  return (
    <div
      className={cn(
        "relative rounded-2xl bg-slate-900/50 border border-slate-800/50 p-6 backdrop-blur-sm",
        hover && "transition-all duration-300 hover:border-slate-700/50 hover:bg-slate-900/70 hover:shadow-lg hover:shadow-slate-900/50",
        className
      )}
    >
      {children}
    </div>
  );
}
