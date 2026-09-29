"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { motion, type HTMLMotionProps } from "motion/react";

export interface ButtonProps
  extends Omit<HTMLMotionProps<"button">, "ref" | "children"> {
  children?: React.ReactNode;
  variant?:
    | "brand"
    | "mint"
    | "amber"
    | "ember"
    | "sage"
    | "surface"
    | "outline"
    | "ghost"
    | "game_action"
    | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "brand",
      size = "md",
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium tracking-tight select-none disabled:opacity-40 disabled:pointer-events-none transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2";

    const sizeStyles = {
      sm: "h-9 px-3.5 text-xs gap-1.5 rounded-lg",
      md: "h-11 px-5 py-2.5 text-sm gap-2 rounded-xl",
      lg: "h-12 px-7 py-3 text-base gap-2.5 rounded-xl font-semibold",
    }[size];

    const variantStyles = {
      brand:
        "bg-brand hover:bg-brand-hover text-text-on-mint font-semibold shadow-elevation-sm hover:shadow-mint-glow active:scale-[0.98] border border-brand-hover/40",
      mint:
        "bg-brand hover:bg-brand-hover text-text-on-mint font-semibold shadow-elevation-sm hover:shadow-mint-glow active:scale-[0.98] border border-brand-hover/40",
      amber:
        "bg-warning/20 hover:bg-warning/30 text-warning font-semibold shadow-elevation-sm border border-warning/40 active:scale-[0.98]",
      ember:
        "bg-player-one-ember/20 hover:bg-player-one-ember/30 text-player-one-ember font-semibold shadow-elevation-sm border border-player-one-ember/40 active:scale-[0.98]",
      sage:
        "bg-player-two-sage/20 hover:bg-player-two-sage/30 text-player-two-sage font-semibold shadow-elevation-sm border border-player-two-sage/40 active:scale-[0.98]",
      game_action:
        "bg-brand hover:bg-brand-hover text-text-on-mint font-bold tracking-normal uppercase text-xs shadow-elevation-md hover:shadow-mint-intense border-t border-brand-hover border-b-2 border-brand-active active:translate-y-0.5",
      surface:
        "bg-surface-secondary hover:bg-surface-interactive text-warm-cream border border-border hover:border-border-strong shadow-elevation-sm active:scale-[0.98]",
      outline:
        "border border-border hover:border-border-strong hover:bg-surface-secondary text-warm-cream active:scale-[0.98]",
      ghost:
        "hover:bg-surface-secondary text-soft-stone hover:text-warm-cream active:scale-[0.98]",
      danger:
        "bg-danger/20 hover:bg-danger/30 text-danger border border-danger/40 active:scale-[0.98]",
    }[variant];

    return (
      <motion.button
        ref={ref}
        disabled={disabled || isLoading}
        whileTap={{ scale: disabled || isLoading ? 1 : 0.98 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
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
