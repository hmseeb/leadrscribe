import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, type MotionProps } from "framer-motion";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer border-2 border-border",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-md hover:bg-primary/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-xs",
        primary:
          "bg-primary text-primary-foreground shadow-md hover:bg-primary/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-xs",
        secondary:
          "bg-secondary text-secondary-foreground shadow-md hover:bg-secondary/80 active:translate-x-[2px] active:translate-y-[2px] active:shadow-xs",
        destructive:
          "bg-destructive text-destructive-foreground shadow-md hover:bg-destructive/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-xs",
        danger:
          "bg-destructive text-destructive-foreground shadow-md hover:bg-destructive/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-xs",
        outline:
          "bg-background text-foreground shadow-md hover:bg-accent hover:text-accent-foreground active:translate-x-[2px] active:translate-y-[2px] active:shadow-xs",
        ghost:
          "border-transparent hover:bg-muted hover:text-foreground",
        link:
          "text-primary underline-offset-4 hover:underline border-transparent",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4 py-2",
        lg: "h-10 px-6 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof MotionProps>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  children?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, disabled, children, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <motion.button
        whileTap={disabled ? undefined : { scale: 0.96 }}
        transition={{ type: "spring", stiffness: 600, damping: 20 }}
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled}
        {...(props as React.ComponentProps<typeof motion.button>)}
      >
        {children}
      </motion.button>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
