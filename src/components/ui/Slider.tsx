import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { SettingContainer } from "./SettingContainer";
import { cn } from "../../lib/utils";

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  label: string;
  description: string;
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
  showValue?: boolean;
  formatValue?: (value: number) => string;
}

export const Slider: React.FC<SliderProps> = ({
  value,
  onChange,
  min,
  max,
  step = 0.01,
  disabled = false,
  label,
  description,
  descriptionMode = "tooltip",
  grouped = false,
  showValue = true,
  formatValue = (v) => v.toFixed(2),
}) => {
  return (
    <SettingContainer
      title={label}
      description={description}
      descriptionMode={descriptionMode}
      grouped={grouped}
      layout="horizontal"
      disabled={disabled}
    >
      <div className="w-full">
        <div className="flex items-center gap-3">
          <SliderPrimitive.Root
            className={cn(
              "relative flex w-full touch-none select-none items-center",
              disabled && "opacity-50"
            )}
            value={[value]}
            onValueChange={([v]) => onChange(v)}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
          >
            <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden bg-muted border border-border">
              <SliderPrimitive.Range className="absolute h-full bg-primary" />
            </SliderPrimitive.Track>
            <SliderPrimitive.Thumb className="block h-4 w-4 border-2 border-border bg-background shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" />
          </SliderPrimitive.Root>
          {showValue && (
            <span className="text-sm font-semibold text-foreground min-w-10 text-right">
              {formatValue(value)}
            </span>
          )}
        </div>
      </div>
    </SettingContainer>
  );
};

// Also export a standalone Slider component for use outside of settings
const StandaloneSlider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center",
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden bg-muted border border-border">
      <SliderPrimitive.Range className="absolute h-full bg-primary" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-4 w-4 border-2 border-border bg-background shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
));
StandaloneSlider.displayName = SliderPrimitive.Root.displayName;

export { StandaloneSlider };
