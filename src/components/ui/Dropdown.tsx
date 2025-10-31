import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface DropdownProps {
  options: DropdownOption[];
  className?: string;
  selectedValue: string | null;
  onSelect: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onRefresh?: () => void;
}

export const Dropdown: React.FC<DropdownProps> = ({
  options,
  selectedValue,
  onSelect,
  className = "",
  placeholder = "Select an option...",
  disabled = false,
  onRefresh,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(
    (option) => option.value === selectedValue,
  );

  const handleSelect = (value: string) => {
    onSelect(value);
    setIsOpen(false);
  };

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen && onRefresh) onRefresh();
    setIsOpen(!isOpen);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        className={`px-3 py-2 text-sm font-medium bg-surface dark:bg-neutral-800 border border-border dark:border-neutral-700 rounded-lg min-w-[200px] text-left flex items-center justify-between transition-all duration-200 shadow-sm ${
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "hover:border-primary-300 dark:hover:border-primary-700 cursor-pointer hover:shadow-md focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
        }`}
        onClick={handleToggle}
        disabled={disabled}
      >
        <span className="truncate text-text dark:text-neutral-100">
          {selectedOption?.label || (
            <span className="text-text-subtle">{placeholder}</span>
          )}
        </span>
        <motion.svg
          className="w-4 h-4 ml-2 text-text-subtle"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </motion.svg>
      </button>
      <AnimatePresence>
        {isOpen && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-2 bg-surface dark:bg-neutral-800 border border-border dark:border-neutral-700 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto backdrop-blur-sm"
          >
            {options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-text-subtle">
                No options found
              </div>
            ) : (
              options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`w-full px-3 py-2 text-sm text-left hover:bg-primary-50 dark:hover:bg-primary-950/30 transition-colors duration-150 first:rounded-t-lg last:rounded-b-lg ${
                    selectedValue === option.value
                      ? "bg-primary-100 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300 font-medium"
                      : "text-text dark:text-neutral-100"
                  } ${option.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                  onClick={() => handleSelect(option.value)}
                  disabled={option.disabled}
                >
                  <span className="truncate">{option.label}</span>
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
