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
        className={`px-3 py-2 text-sm font-medium bg-white border-3 border-pencil rounded-wobbly min-w-[200px] text-left flex items-center justify-between transition-all duration-100 shadow-md ${
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "hover:border-blue-pen cursor-pointer hover:shadow-lg focus:outline-none focus:border-blue-pen focus:ring-2 focus:ring-blue-pen/30"
        }`}
        onClick={handleToggle}
        disabled={disabled}
      >
        <span className="truncate text-pencil">
          {selectedOption?.label || (
            <span className="text-text-subtle">{placeholder}</span>
          )}
        </span>
        <motion.svg
          className="w-4 h-4 ml-2 text-text-subtle"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          viewBox="0 0 24 24"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.15 }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
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
            transition={{ duration: 0.1 }}
            className="absolute top-full left-0 right-0 mt-2 bg-white border-3 border-pencil rounded-wobbly-lg shadow-xl z-50 max-h-60 overflow-y-auto"
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
                  className={`w-full px-3 py-2 text-sm text-left hover:bg-post-it transition-colors duration-100 first:rounded-t-wobbly-lg last:rounded-b-wobbly-lg ${
                    selectedValue === option.value
                      ? "bg-old-paper text-pencil font-bold"
                      : "text-pencil"
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
