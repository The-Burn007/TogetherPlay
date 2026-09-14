import React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "raised" | "deep" | "overlay" | "container";
  padding?: "none" | "sm" | "md" | "lg";
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "raised", padding = "md", children, ...props }, ref) => {
    const variantStyles = {
      raised: "bg-surface-raised border border-subtle-border shadow-md",
      deep: "bg-surface-deep border border-subtle-border",
      overlay: "bg-surface-overlay border border-accent-border shadow-lg",
      container: "bg-surface-container border border-subtle-border",
    }[variant];

    const paddingStyles = {
      none: "p-0",
      sm: "p-3",
      md: "p-4 sm:p-5",
      lg: "p-5 sm:p-6",
    }[padding];

    return (
      <div
        ref={ref}
        className={cn("rounded-xl transition-all relative", variantStyles, paddingStyles, className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";
