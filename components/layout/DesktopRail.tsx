"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Radio,
  LogOut,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "next/navigation";

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
  const { user, signOut } = useAuth();

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

  const handlePartnerNudge = () => {
    showToast({
      message: "Haptic heartbeat sent to Sam's device in Tokyo",
      variant: "nudge",
    });
  };

  return (
    <aside
      className="hidden md:flex flex-col justify-between fixed top-0 bottom-0 left-0 z-40 w-20 lg:w-60 bg-surface-deep/95 border-r border-subtle-border backdrop-blur-xl transition-all duration-200"
      aria-label="Desktop Navigation Rail"
    >
      {/* Top: Brand & Private Couple Room Identity */}
      <div className="p-4 flex flex-col space-y-4">
        <Link
          href="/home"
          className="flex items-center gap-3 group px-2 py-1.5 rounded-xl hover:bg-surface-raised transition-colors"
        >
          {/* Couple Interlock Icon */}
          <div className="relative w-9 h-9 rounded-full bg-surface-raised border border-subtle-border flex items-center justify-center shrink-0 shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-player-one-ember -mr-1 shadow-sm" />
            <span className="w-2.5 h-2.5 rounded-full bg-player-two-sage -ml-1 shadow-sm" />
          </div>

          <div className="hidden lg:flex flex-col min-w-0">
            <span className="text-xs font-semibold text-canvas-cream tracking-tight group-hover:text-shared-amber transition-colors truncate">
              Alex &amp; Sam
            </span>
            <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider truncate">
              TogetherPlay #4209
            </span>
          </div>
        </Link>

        {/* Primary Navigation Items */}
        <nav className="flex flex-col space-y-1.5 pt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all select-none group",
                  item.isActive
                    ? "bg-surface-raised text-shared-amber border border-subtle-border shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-raised/60"
                )}
              >
                {/* Active Indicator Bar on Left */}
                {item.isActive ? (
                  <span className="absolute left-0 inset-y-2 w-1 rounded-r-full bg-shared-amber" />
                ) : null}

                <Icon
                  className={cn(
                    "w-5 h-5 shrink-0 transition-transform group-hover:scale-105",
                    item.isActive ? "text-shared-amber" : "text-on-surface-variant"
                  )}
                />
                <span className="hidden lg:inline text-xs font-medium tracking-tight">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom: Partner Presence Widget, Notifications & Settings */}
      <div className="p-3 flex flex-col space-y-3 border-t border-subtle-border">
        {/* Partner Presence Pod (Compact on md, full card on lg) */}
        <div className="p-2.5 rounded-xl bg-surface-raised border border-subtle-border flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-full bg-player-two-sage/20 border border-player-two-sage/40 flex items-center justify-center font-mono font-bold text-xs text-player-two-sage">
                S
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-player-two-sage border-2 border-surface-deep animate-pulse" />
            </div>

            <div className="hidden lg:flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-on-surface truncate">
                  Sam
                </span>
                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-player-two-sage/15 text-player-two-sage-text">
                  Online
                </span>
              </div>
              <span className="text-[10px] font-mono text-on-surface-variant truncate">
                Tokyo · 07:34 JST
              </span>
            </div>
          </div>

          <button
            onClick={handlePartnerNudge}
            title="Send tactile pulse to Sam"
            className="w-7 h-7 rounded-lg bg-surface-deep hover:bg-surface-overlay border border-subtle-border flex items-center justify-center text-player-one-ember hover:scale-105 transition-all cursor-pointer shrink-0"
            aria-label="Send partner pulse"
          >
            <Heart className="w-3.5 h-3.5 fill-player-one-ember/20 hover:fill-player-one-ember" />
          </button>
        </div>

        {/* Action Row: Notifications & Settings */}
        <div className="flex items-center justify-between px-1">
          {/* Notifications Button */}
          <button
            onClick={onOpenNotifications}
            className="relative flex items-center gap-2 p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-raised transition-all cursor-pointer"
            aria-label={`Whispers & notifications (${unreadCount} unread)`}
          >
            <div className="relative">
              <Bell className="w-4 h-4" />
              {unreadCount > 0 ? (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-shared-amber animate-pulse" />
              ) : null}
            </div>
            <span className="hidden lg:inline text-xs text-on-surface-variant font-medium">
              Whispers
            </span>
          </button>

          {/* Action Icons */}
          <div className="flex items-center gap-1">
            {/* Settings Link */}
            <Link
              href="/settings"
              className={cn(
                "p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-raised transition-all",
                pathname === "/settings" ? "text-shared-amber bg-surface-raised" : ""
              )}
              aria-label="Couple Settings"
              title="Settings"
            >
              <Sliders className="w-4 h-4" />
            </Link>

            {/* Sign Out Button */}
            <button
              onClick={handleSignOut}
              className="p-2 rounded-lg text-on-surface-variant hover:text-status-error hover:bg-surface-raised transition-all cursor-pointer"
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
