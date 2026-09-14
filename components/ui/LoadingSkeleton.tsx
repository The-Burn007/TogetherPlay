import React from "react";
import { cn } from "@/lib/utils";

export const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-surface-container-high/60 before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-surface-container-highest/40 before:to-transparent",
        className
      )}
      {...props}
    />
  );
};

export const CardSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      className={cn(
        "rounded-xl bg-surface-raised border border-subtle-border p-5 space-y-4",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <div className="flex items-center justify-between pt-2">
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
    </div>
  );
};
