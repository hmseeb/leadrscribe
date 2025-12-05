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
    "w-full bg-white border-3 border-pencil rounded-wobbly text-base font-medium text-pencil placeholder:text-mid-gray/40 transition-all duration-100 hover:shadow-md focus:outline-none focus:border-blue-pen focus:shadow-lg focus:ring-2 focus:ring-blue-pen/30";

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
