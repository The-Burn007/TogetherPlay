"use client";

import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";

export interface PageTransitionProps {
  children: React.ReactNode;
}

export const PageTransition: React.FC<PageTransitionProps> = ({ children }) => {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className="w-full flex-1 flex flex-col">{children}</div>;
  }

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{
        duration: 0.22,
        ease: [0.22, 1, 0.36, 1], // Gentle spring curve
      }}
      className="w-full flex-1 flex flex-col"
    >
      {children}
    </motion.div>
  );
};
