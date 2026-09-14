"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, Gamepad2, BookOpen, Camera, User } from "lucide-react";

export const BottomNav: React.FC = () => {
  const pathname = usePathname();

  const navItems = [
    {
      id: "nav-home",
      label: "Home",
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
      label: "Memories",
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
      className="md:hidden fixed bottom-3 inset-x-0 z-40 px-3 flex justify-center pb-safe pointer-events-none"
      aria-label="Mobile Navigation"
    >
      <div className="pointer-events-auto w-full max-w-sm h-14 rounded-full bg-surface-raised/95 backdrop-blur-xl border border-subtle-border shadow-[0_6px_28px_rgba(0,0,0,0.65)] px-1.5 flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center w-14 h-11 rounded-full transition-all gap-0.5 select-none",
                item.isActive
                  ? "bg-surface-overlay text-shared-amber shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="text-[9px] font-mono tracking-wider uppercase">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
