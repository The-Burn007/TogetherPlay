import React from "react";
import { cn } from "@/lib/utils";

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg" | "full";
}

export const Container: React.FC<ContainerProps> = ({
  className,
  size = "sm",
  children,
  ...props
}) => {
  const sizeMap = {
    sm: "max-w-xl",
    md: "max-w-2xl",
    lg: "max-w-4xl",
    full: "max-w-full",
  };

  return (
    <div
      className={cn(
        "w-full mx-auto px-4 sm:px-6 pt-18 md:pt-20 pb-24 md:pb-12 flex flex-col space-y-6",
        sizeMap[size],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
