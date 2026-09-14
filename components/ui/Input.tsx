"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  iconPrefix?: React.ReactNode;
  iconSuffix?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      iconPrefix,
      iconSuffix,
      disabled,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);

    return (
      <div className="w-full flex flex-col space-y-1.5">
        {label ? (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-on-surface flex items-center justify-between"
          >
            <span>{label}</span>
            {error ? (
              <span className="text-[10px] font-mono text-status-error">{error}</span>
            ) : null}
          </label>
        ) : null}

        <div className="relative flex items-center w-full">
          {iconPrefix ? (
            <div className="absolute left-3 flex items-center justify-center text-on-surface-variant pointer-events-none">
              {iconPrefix}
            </div>
          ) : null}

          <input
            id={inputId}
            ref={ref}
            disabled={disabled}
            className={cn(
              "w-full h-10 rounded-lg bg-surface-deep border text-sm text-on-surface placeholder:text-on-surface-subtle transition-all outline-none",
              iconPrefix ? "pl-9" : "pl-3.5",
              iconSuffix ? "pr-9" : "pr-3.5",
              error
                ? "border-status-error focus:ring-1 focus:ring-status-error"
                : "border-subtle-border focus:border-shared-amber/60 focus:ring-2 focus:ring-shared-amber/15",
              disabled && "opacity-50 cursor-not-allowed",
              className
            )}
            {...props}
          />

          {iconSuffix ? (
            <div className="absolute right-3 flex items-center justify-center text-on-surface-variant">
              {iconSuffix}
            </div>
          ) : null}
        </div>

        {helperText && !error ? (
          <p className="text-[11px] font-mono text-on-surface-variant leading-tight">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";
