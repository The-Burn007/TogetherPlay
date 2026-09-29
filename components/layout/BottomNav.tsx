"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, Gamepad2, BookOpen, Camera, User } from "lucide-react";
import { motion } from "motion/react";

export const BottomNav: React.FC = () => {
  const pathname = usePathname();

  const navItems = [
    {
      id: "nav-home",
      label: "Sanctuary",
      href: "/home",
      icon: Home,
      isActive: pathname === "/" || pathname === "/home",
    },
    {
      id: "nav-play",
      label: "Play",
      href: "/play",
      icon: Gamepad2,
      isActive: pathname.startsWith("/play"),
    },
    {
      id: "nav-memories",
      label: "History",
      href: "/memories",
      icon: BookOpen,
      isActive: pathname.startsWith("/memories"),
    },
    {
      id: "nav-moments",
      label: "Moments",
      href: "/moments",
      icon: Camera,
      isActive: pathname.startsWith("/moments"),
    },
    {
      id: "nav-profile",
      label: "Profile",
      href: "/profile",
      icon: User,
      isActive: pathname.startsWith("/profile"),
    },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-4 inset-x-4 z-40"
      aria-label="Sanctuary Mobile Navigation"
    >
      <div className="w-full max-w-md mx-auto h-16 rounded-2xl bg-surface-charcoal/95 border border-border-strong/40 backdrop-blur-2xl shadow-elevation-lg px-2 flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "relative tp-touch-target flex flex-col items-center justify-center flex-1 h-12 rounded-xl transition-all select-none focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-1",
                item.isActive
                  ? "text-warm-cream font-semibold"
                  : "text-soft-sage hover:text-soft-stone active:scale-95"
              )}
              aria-current={item.isActive ? "page" : undefined}
            >
              {/* Subtle Warm Interactive Plinth for Active Tab */}
              {item.isActive ? (
                <motion.div
                  layoutId="mobile-active-bg"
                  className="absolute inset-0 bg-surface-interactive/70 border border-border rounded-xl -z-0"
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                />
              ) : null}

              <Icon
                className={cn(
                  "w-5 h-5 shrink-0 transition-transform z-10",
                  item.isActive ? "text-warm-cream scale-105" : "text-soft-sage"
                )}
              />
              <span
                className={cn(
                  "text-[10px] tracking-tight mt-0.5 z-10",
                  item.isActive ? "text-warm-cream font-semibold" : "text-soft-sage"
                )}
              >
                {item.label}
              </span>

              {/* Controlled Acid Mint Indicator Dot */}
              {item.isActive && (
                <motion.span
                  layoutId="mobile-active-dot"
                  className="w-1 h-1 rounded-full bg-brand mt-0.5 z-10"
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
