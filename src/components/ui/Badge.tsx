import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "primary" | "success" | "warning" | "error" | "neutral";
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "primary",
  className = "",
}) => {
  const variantClasses = {
    primary:
      "bg-primary-100 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300",
    success:
      "bg-success-500/10 text-success-600 dark:bg-success-500/20 dark:text-success-500",
    warning:
      "bg-warning-500/10 text-warning-600 dark:bg-warning-500/20 dark:text-warning-500",
    error:
      "bg-error-500/10 text-error-600 dark:bg-error-500/20 dark:text-error-500",
    neutral:
      "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
};

export default Badge;
