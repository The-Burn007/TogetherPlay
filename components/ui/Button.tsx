"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { motion, type HTMLMotionProps } from "motion/react";

export interface ButtonProps
  extends Omit<HTMLMotionProps<"button">, "ref" | "children"> {
  children?: React.ReactNode;
  variant?:
    | "amber"
    | "ember"
    | "sage"
    | "surface"
    | "outline"
    | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "amber",
      size = "md",
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium tracking-tight rounded-lg select-none disabled:opacity-50 disabled:pointer-events-none transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shared-amber/50";

    const sizeStyles = {
      sm: "h-8 px-3 text-xs gap-1.5",
      md: "h-10 px-4 py-2 text-sm gap-2",
      lg: "h-12 px-6 py-3 text-base gap-2.5",
    }[size];

    const variantStyles = {
      amber:
        "bg-shared-amber hover:bg-shared-amber-hover text-surface-deep font-semibold shadow-md border border-border-amber/40",
      ember:
        "bg-player-one-ember hover:bg-player-one-ember-hover text-canvas-cream font-semibold shadow-md border border-border-ember/40",
      sage:
        "bg-player-two-sage hover:bg-player-two-sage-hover text-canvas-cream font-semibold shadow-md border border-border-sage/40",
      surface:
        "bg-surface-raised hover:bg-surface-overlay text-on-surface border border-subtle-border shadow-sm",
      outline:
        "border border-accent-border hover:bg-surface-raised text-on-surface",
      ghost:
        "hover:bg-surface-raised/60 text-on-surface-variant hover:text-on-surface",
    }[variant];

    return (
      <motion.button
        ref={ref}
        disabled={disabled || isLoading}
        whileTap={{ scale: disabled || isLoading ? 1 : 0.97 }}
        whileHover={{ scale: disabled || isLoading ? 1 : 1.01 }}
        transition={{ type: "spring", stiffness: 450, damping: 25 }}
        className={cn(baseStyles, sizeStyles, variantStyles, className)}
        {...props}
      >
        {isLoading ? (
          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5" />
        ) : null}
        {children}
      </motion.button>
    );
  }
);

Button.displayName = "Button";
