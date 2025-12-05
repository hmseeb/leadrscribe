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
      "bg-red-marker text-white border-2 border-pencil",
    success:
      "bg-success-500 text-white border-2 border-pencil",
    warning:
      "bg-warning-500 text-white border-2 border-pencil",
    error:
      "bg-red-marker text-white border-2 border-pencil",
    neutral:
      "bg-old-paper text-pencil border-2 border-pencil",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-wobbly text-xs font-bold rotate-slightly-right ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
};

export default Badge;
