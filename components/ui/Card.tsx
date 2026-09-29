import React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | "editorial"
    | "game_tile"
    | "memory_tile"
    | "presence"
    | "invitation"
    | "utility"
    | "raised"
    | "deep"
    | "overlay"
    | "container";
  padding?: "none" | "sm" | "md" | "lg" | "xl";
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "editorial", padding = "md", children, ...props }, ref) => {
    const variantStyles = {
      editorial:
        "bg-surface border border-border rounded-2xl shadow-elevation-md relative overflow-hidden transition-all duration-300",
      game_tile:
        "bg-surface hover:bg-surface-raised border border-border hover:border-brand/50 rounded-2xl shadow-elevation-sm hover:shadow-elevation-md transition-all duration-300 group",
      memory_tile:
        "bg-surface border border-border/80 rounded-xl shadow-elevation-sm hover:shadow-elevation-md hover:border-brand/40 transition-all duration-300",
      presence:
        "bg-surface border border-border-strong rounded-3xl shadow-elevation-lg relative overflow-hidden",
      invitation:
        "bg-surface-raised border border-border rounded-2xl shadow-elevation-md relative overflow-hidden",
      utility:
        "bg-surface border border-border rounded-xl shadow-elevation-sm",
      raised:
        "bg-surface-raised border border-border rounded-2xl shadow-elevation-md",
      deep:
        "bg-background-canvas border border-border-subtle rounded-xl",
      overlay:
        "bg-surface-overlay border border-border-strong rounded-2xl shadow-elevation-lg",
      container:
        "bg-surface border border-border rounded-2xl",
    }[variant];

    const paddingStyles = {
      none: "p-0",
      sm: "p-3",
      md: "p-5 sm:p-6",
      lg: "p-6 sm:p-8",
      xl: "p-8 sm:p-10",
    }[padding];

    return (
      <div
        ref={ref}
        className={cn(variantStyles, paddingStyles, className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";
