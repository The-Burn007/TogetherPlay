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
    md: "max-w-3xl lg:max-w-[860px]",
    lg: "max-w-5xl",
    full: "max-w-full",
  };

  return (
    <div
      className={cn(
        "w-full mx-auto px-4 sm:px-6 pt-4 sm:pt-6 md:pt-8 pb-20 md:pb-12 flex flex-col space-y-6",
        sizeMap[size],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
