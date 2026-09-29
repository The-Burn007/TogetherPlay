import React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "brand" | "mint" | "amber" | "ember" | "sage" | "neutral" | "subtle";
  size?: "sm" | "md";
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = "brand",
  size = "sm",
  children,
  ...props
}) => {
  const sizeStyles = {
    sm: "text-[10px] px-2 py-0.5 tracking-wider uppercase font-semibold",
    md: "text-xs px-2.5 py-1 tracking-wide font-medium",
  }[size];

  const variantStyles = {
    brand: "bg-brand/15 text-brand border border-border-strong",
    mint: "bg-brand/15 text-brand border border-border-strong",
    amber: "bg-warning/15 text-warning border border-warning/25",
    ember: "bg-danger/15 text-danger border border-danger/25",
    sage: "bg-brand/15 text-brand border border-border",
    neutral: "bg-surface-raised text-text-secondary border border-border",
    subtle: "bg-surface text-text-primary border border-border",
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
