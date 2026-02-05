import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

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
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
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
    (option) => option.value === selectedValue
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
    <div className={cn("relative", className)} ref={dropdownRef}>
      <button
        type="button"
        className={cn(
          "px-3 py-2 text-sm font-medium bg-card border border-border/50 rounded-lg min-w-[200px] text-left flex items-center justify-between transition-all shadow-sm",
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "hover:bg-muted/50 cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring/50"
        )}
        onClick={handleToggle}
        disabled={disabled}
      >
        <span className="truncate text-foreground">
          {selectedOption?.label || (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.15 }}
        >
          <ChevronDown className="h-4 w-4 ml-2 text-muted-foreground" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.1 }}
            className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border/50 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto"
          >
            {options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No options found
              </div>
            ) : (
              options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "w-full px-3 py-1.5 text-sm text-left transition-colors rounded-md mx-1 first:mt-1 last:mb-1",
                    selectedValue === option.value
                      ? "bg-muted text-foreground font-medium"
                      : "text-popover-foreground hover:bg-muted/70",
                    option.disabled && "opacity-50 cursor-not-allowed"
                  )}
                  style={{ width: "calc(100% - 8px)" }}
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
