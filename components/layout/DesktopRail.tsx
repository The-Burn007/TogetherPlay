"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  Gamepad2,
  BookOpen,
  Camera,
  User,
  Sliders,
  Bell,
  Heart,
  LogOut,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth/AuthContext";
import { motion } from "motion/react";

export interface DesktopRailProps {
  onOpenNotifications: () => void;
  unreadCount?: number;
}

export const DesktopRail: React.FC<DesktopRailProps> = ({
  onOpenNotifications,
  unreadCount = 2,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const { showToast } = useToast();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      showToast({
        message: "Signed out of your sanctuary session.",
        variant: "info",
      });
      router.replace("/login");
    } catch {
      showToast({
        message: "Failed to sign out.",
        variant: "error",
      });
    }
  };

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
      label: "Play Anthology",
      href: "/play",
      icon: Gamepad2,
      isActive: pathname.startsWith("/play"),
    },
    {
      id: "nav-memories",
      label: "Our History",
      href: "/memories",
      icon: BookOpen,
      isActive: pathname.startsWith("/memories"),
    },
    {
      id: "nav-moments",
      label: "Daily Moments",
      href: "/moments",
      icon: Camera,
      isActive: pathname.startsWith("/moments"),
    },
    {
      id: "nav-profile",
      label: "Couple Profile",
      href: "/profile",
      icon: User,
      isActive: pathname.startsWith("/profile"),
    },
  ];

  const handlePartnerNudge = () => {
    showToast({
      message: "Resonance heartbeat sent to Sam in Tokyo",
      variant: "nudge",
    });
  };

  return (
    <aside
      className="hidden md:flex flex-col justify-between fixed top-5 bottom-5 left-5 z-40 w-20 lg:w-60 bg-surface/90 border border-border rounded-3xl backdrop-blur-2xl p-3.5 shadow-elevation-lg select-none"
      aria-label="Sanctuary Navigation Dock"
    >
      {/* Top: Brand Monogram & Space Seal */}
      <div className="flex flex-col space-y-5">
        <Link
          href="/home"
          className="flex items-center gap-3 p-2 rounded-2xl hover:bg-surface-raised transition-colors group focus-visible:outline-2 focus-visible:outline-brand"
        >
          {/* Couple Interlocking Monogram */}
          <div className="relative w-10 h-10 rounded-2xl bg-background-canvas border border-border flex items-center justify-center shrink-0 shadow-sm">
            <span className="w-3 h-3 rounded-full bg-player-one-ember -mr-1.5 shadow-sm" />
            <span className="w-3 h-3 rounded-full bg-player-two-sage -ml-1.5 shadow-sm" />
            <span className="absolute w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
          </div>

          <div className="hidden lg:flex flex-col min-w-0">
            <span className="text-sm font-display font-medium text-text-primary tracking-tight group-hover:text-brand transition-colors truncate">
              TogetherPlay
            </span>
            <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider truncate">
              Two People · Room
            </span>
          </div>
        </Link>

        {/* Primary Navigation Items with Sliding Active Pill */}
        <nav className="flex flex-col space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-medium transition-all group focus-visible:outline-2 focus-visible:outline-brand",
                  item.isActive
                    ? "text-text-on-mint font-semibold"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-raised/70"
                )}
                aria-current={item.isActive ? "page" : undefined}
              >
                {/* Active Backdrop Pill with Layout Spring */}
                {item.isActive ? (
                  <motion.div
                    layoutId="desktop-active-pill"
                    className="absolute inset-0 bg-brand rounded-xl shadow-sm -z-0"
                    transition={{ type: "spring", stiffness: 450, damping: 30 }}
                  />
                ) : null}

                <Icon
                  className={cn(
                    "w-4 h-4 shrink-0 transition-transform group-hover:scale-105 z-10",
                    item.isActive ? "text-text-on-mint" : "text-text-muted group-hover:text-text-primary"
                  )}
                />
                <span className="hidden lg:inline z-10 tracking-tight">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom: Partner Presence Capsule & Controls */}
      <div className="flex flex-col space-y-3 pt-3 border-t border-border-subtle">
        {/* Partner Pulse Capsule */}
        <div className="p-2.5 rounded-2xl bg-background-canvas border border-border flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-full bg-surface-raised border border-player-two-sage/40 flex items-center justify-center font-mono font-bold text-xs text-player-two-sage">
                S
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-brand border-2 border-background-canvas animate-pulse" />
            </div>

            <div className="hidden lg:flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-text-primary truncate">
                  Sam
                </span>
                <span className="text-[9px] font-mono text-brand font-medium">
                  · Tokyo
                </span>
              </div>
              <span className="text-[10px] font-mono text-text-muted truncate">
                09:24 JST · Clear
              </span>
            </div>
          </div>

          <button
            onClick={handlePartnerNudge}
            title="Send tactile pulse to Sam"
            className="w-8 h-8 rounded-xl bg-surface-raised hover:bg-surface-overlay border border-border flex items-center justify-center text-brand hover:scale-105 transition-all cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-brand"
            aria-label="Send partner pulse"
          >
            <Heart className="w-3.5 h-3.5 fill-brand/20 hover:fill-brand" />
          </button>
        </div>

        {/* Action Row: Notifications & Settings */}
        <div className="flex items-center justify-between px-1">
          <button
            onClick={onOpenNotifications}
            className="relative flex items-center gap-1.5 p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-brand"
            aria-label={`Whispers and notifications (${unreadCount} unread)`}
          >
            <div className="relative">
              <Bell className="w-4 h-4" />
              {unreadCount > 0 ? (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-brand animate-pulse" />
              ) : null}
            </div>
            <span className="hidden lg:inline text-xs text-text-secondary font-medium">
              Whispers
            </span>
          </button>

          <div className="flex items-center gap-1">
            <Link
              href="/settings"
              className={cn(
                "p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-all focus-visible:outline-2 focus-visible:outline-brand",
                pathname === "/settings" ? "text-brand bg-surface border border-border" : ""
              )}
              aria-label="Couple Settings"
              title="Settings"
            >
              <Sliders className="w-4 h-4" />
            </Link>

            <button
              onClick={handleSignOut}
              className="p-2 rounded-xl text-text-secondary hover:text-danger hover:bg-surface-raised transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-danger"
              aria-label="Sign out"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
