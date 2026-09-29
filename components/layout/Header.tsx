"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Sliders, Bell, LogOut, Radio } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { usePresence } from "@/lib/presence/usePresence";
import { useAuth } from "@/lib/auth/AuthContext";
import { cn } from "@/lib/utils";

export interface HeaderProps {
  onOpenNotifications?: () => void;
  unreadCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenNotifications,
  unreadCount = 2,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const { showToast } = useToast();
  const { signOut } = useAuth();
  const {
    partnerDisplayName,
    partnerCity,
    partnerState,
    sendHeartbeatNudge,
  } = usePresence();

  const handlePartnerTap = async () => {
    await sendHeartbeatNudge();
    showToast({
      message: `Resonance heartbeat sent to ${partnerDisplayName || "Sam"} in ${partnerCity || "Tokyo"}`,
      variant: "nudge",
    });
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      showToast({
        message: "Signed out of your sanctuary.",
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

  const navLinks = [
    { label: "Sanctuary", href: "/home", isActive: pathname === "/" || pathname === "/home" },
    { label: "Anthology", href: "/play", isActive: pathname.startsWith("/play") },
    { label: "Memories", href: "/memories", isActive: pathname.startsWith("/memories") },
    { label: "Moments", href: "/moments", isActive: pathname.startsWith("/moments") },
    { label: "Profile", href: "/profile", isActive: pathname.startsWith("/profile") },
  ];

  const isPartnerOnline = partnerState === "ONLINE" || partnerState === "IN_GAME";

  return (
    <header className="sticky top-0 inset-x-0 z-40 bg-surface/90 border-b border-border/80 backdrop-blur-xl select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Single text element wordmark in display face with couple mark */}
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/home"
            className="flex items-center gap-2.5 group focus-visible:outline-2 focus-visible:outline-brand rounded-lg"
            aria-label="TogetherPlay Home"
          >
            <div className="relative w-8 h-8 rounded-xl bg-background border border-border flex items-center justify-center shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-player-one-ember -mr-1 shadow-sm" />
              <span className="w-2.5 h-2.5 rounded-full bg-player-two-sage -ml-1 shadow-sm" />
              <span className="absolute w-1 h-1 rounded-full bg-brand animate-ping" />
            </div>
            <span className="font-display text-lg tracking-tight text-cream group-hover:text-cream transition-colors font-medium">
              TogetherPlay
            </span>
          </Link>
        </div>

        {/* Zone 2: 4–5 clean text navigation links (No capsule pills - Zero-Pill discipline) */}
        <nav className="hidden md:flex items-center gap-7 text-xs font-medium tracking-tight text-soft-sage">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "relative py-1 transition-colors hover:text-cream focus-visible:outline-2 focus-visible:outline-brand",
                link.isActive
                  ? "text-cream font-semibold"
                  : "text-soft-sage"
              )}
            >
              <span>{link.label}</span>
              {link.isActive && (
                <span className="absolute bottom-0 inset-x-0 h-0.5 bg-brand rounded-full" />
              )}
            </Link>
          ))}
        </nav>

        {/* Zone 3: 1–2 primary actions & partner presence */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Partner Presence Status Affordance */}
          <button
            onClick={handlePartnerTap}
            title={`Tap to send heartbeat pulse to ${partnerDisplayName || "partner"}`}
            className="hidden sm:flex items-center gap-2 py-1.5 px-3 rounded-xl bg-surface border border-border hover:border-soft-sage/40 transition-all text-xs font-mono text-soft-sage hover:text-cream group cursor-pointer focus-visible:outline-2 focus-visible:outline-brand"
            aria-label={`Send pulse to ${partnerDisplayName || "partner"}`}
          >
            <span
              className={cn(
                "w-2 h-2 rounded-full shrink-0",
                isPartnerOnline ? "bg-brand animate-pulse" : "bg-text-muted"
              )}
            />
            <span className="text-cream font-medium">
              {partnerDisplayName || "Sam"}
            </span>
            <span className="text-soft-sage font-tabular">· {partnerCity || "Tokyo"}</span>
            <Radio className="w-3.5 h-3.5 text-soft-sage group-hover:text-cream transition-colors ml-0.5" />
          </button>

          {/* Whispers & Notifications Button */}
          {onOpenNotifications && (
            <button
              onClick={onOpenNotifications}
              className="relative w-9 h-9 rounded-xl flex items-center justify-center text-soft-sage hover:text-cream hover:bg-surface-raised transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-brand"
              aria-label={`Whispers and notifications (${unreadCount} unread)`}
              title="Whispers & Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand shadow-sm animate-pulse" />
              )}
            </button>
          )}

          {/* Settings */}
          <Link
            href="/settings"
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center text-soft-sage hover:text-cream hover:bg-surface-raised transition-all focus-visible:outline-2 focus-visible:outline-brand",
              pathname === "/settings" ? "text-cream bg-surface-raised border border-border" : ""
            )}
            aria-label="Couple Settings"
            title="Settings"
          >
            <Sliders className="w-4 h-4" />
          </Link>

          {/* Sign Out */}
          <button
            onClick={handleSignOut}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-soft-sage hover:text-danger hover:bg-surface-raised transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-danger"
            aria-label="Sign out"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
