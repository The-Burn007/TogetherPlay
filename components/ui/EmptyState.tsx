import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { Sparkles } from "lucide-react";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = <Sparkles className="w-8 h-8 text-shared-amber" />,
  title,
  description,
  actionLabel,
  onAction,
  className,
}) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 rounded-xl bg-surface-raised border border-subtle-border",
        className
      )}
    >
      <div className="w-14 h-14 rounded-full bg-surface-overlay flex items-center justify-center mb-4 shadow-inner">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-on-surface mb-1.5">{title}</h3>
      <p className="text-sm text-on-surface-variant max-w-sm mb-5 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction ? (
        <Button variant="amber" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
};
