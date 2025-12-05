import React, { useState } from "react";
import { motion, MotionProps } from "framer-motion";

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof MotionProps> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className = "",
  variant = "primary",
  size = "md",
  disabled = false,
  ...props
}) => {
  // Generate wobble variant once during mount
  const [wobbleVariant] = useState(() => Math.floor(Math.random() * 3) + 1);

  const baseClasses =
    "font-bold focus:outline-none transition-all duration-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer inline-flex items-center justify-center border-3 border-pencil";

  const variantClasses = {
    primary:
      "bg-white text-pencil shadow-md hover:bg-red-marker hover:text-white active:shadow-sm active:translate-x-[2px] active:translate-y-[2px]",
    secondary:
      "bg-post-it text-pencil shadow-md hover:shadow-lg hover:-translate-y-[2px]",
    danger:
      "bg-red-marker text-white shadow-md hover:bg-white hover:text-red-marker hover:shadow-lg",
    ghost:
      "border-0 text-pencil hover:bg-old-paper hover:shadow-md",
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm rounded-wobbly",
    md: "px-4 py-2 text-sm rounded-wobbly-md",
    lg: "px-5 py-2.5 text-base rounded-wobbly-md",
  };

  // Random rotation for tap animation
  const randomRotation = () => Math.random() * 4 - 2;

  return (
    <motion.button
      whileTap={disabled ? {} : { scale: 0.96, rotate: randomRotation() }}
      transition={{ type: "spring", stiffness: 600, damping: 20 }}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      style={{
        borderRadius: `var(--wobble-${size === 'sm' ? 'sm' : 'md'}-${wobbleVariant})`
      }}
      disabled={disabled}
      {...(props as any)}
    >
      {children}
    </motion.button>
  );
};
