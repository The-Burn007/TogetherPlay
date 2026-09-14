import React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "amber" | "ember" | "sage" | "neutral" | "subtle";
  size?: "sm" | "md";
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = "amber",
  size = "sm",
  children,
  ...props
}) => {
  const sizeStyles = {
    sm: "text-[10px] px-2 py-0.5 tracking-wider uppercase font-semibold",
    md: "text-xs px-2.5 py-1 tracking-wide font-medium",
  }[size];

  const variantStyles = {
    amber: "bg-shared-amber/15 text-shared-amber border border-shared-amber/25",
    ember: "bg-player-one-ember/15 text-player-one-ember border border-player-one-ember/25",
    sage: "bg-player-two-sage/20 text-player-two-sage border border-player-two-sage/30",
    neutral: "bg-surface-container-high text-on-surface-variant border border-subtle-border",
    subtle: "bg-surface-overlay text-canvas-cream/80 border border-subtle-border",
  }[variant];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full whitespace-nowrap",
        sizeStyles,
        variantStyles,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
