import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "compact";
}

export const Input: React.FC<InputProps> = ({
  className = "",
  variant = "default",
  ...props
}) => {
  const baseClasses =
    "w-full bg-surface dark:bg-neutral-800 border border-border dark:border-neutral-700 rounded-lg text-sm font-medium text-text dark:text-neutral-100 placeholder:text-text-subtle transition-all duration-200 hover:border-primary-300 dark:hover:border-primary-700 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 shadow-sm focus:shadow-md";

  const variantClasses = {
    default: "px-3 py-2",
    compact: "px-2.5 py-1.5 text-sm",
  };

  return (
    <input
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
};