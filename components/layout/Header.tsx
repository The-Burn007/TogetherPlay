"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sliders, Bell, Heart, Layers } from "lucide-react";
import { DualPartnerPill } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { usePresence } from "@/lib/presence/usePresence";
import { PartnerPresenceBadge } from "@/components/ui/PartnerPresenceBadge";

export interface HeaderProps {
  onOpenNotifications?: () => void;
  unreadCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenNotifications,
  unreadCount = 2,
}) => {
  const pathname = usePathname();
  const { showToast } = useToast();
  const {
    partnerDisplayName,
    partnerCity,
    partnerState,
    partnerConnection,
    sendHeartbeatNudge,
  } = usePresence();

  const handlePartnerTap = async () => {
    await sendHeartbeatNudge();
    showToast({
      message: `Resonance heartbeat sent to ${partnerDisplayName} in ${partnerCity} (24ms)`,
      variant: "nudge",
    });
  };

  return (
    <header className="fixed top-0 inset-x-0 z-30 bg-surface-deep/85 backdrop-blur-xl border-b border-subtle-border pt-safe transition-all md:pl-20 lg:pl-60">
      <div className="h-14 md:h-16 max-w-4xl mx-auto px-4 sm:px-6 flex items-center justify-between">
        {/* Left: Couple Identity / Navigation Link */}
        <div className="flex items-center gap-2">
          <Link href="/home" className="hover:opacity-90 transition-opacity">
            <DualPartnerPill
              partnerOneName="Alex"
              partnerTwoName="Sam"
              locationLabel="London & Tokyo"
            />
          </Link>
        </div>

        {/* Center (Desktop only): Quiet Relationship Telemetry */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-surface-raised/80 border border-subtle-border text-[10px] font-mono text-on-surface-variant select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-shared-amber animate-pulse" />
          <span className="text-on-surface font-semibold">9,560 KM</span>
          <span className="opacity-40">|</span>
          <span>GMT ⇄ JST (+8h)</span>
          <span className="opacity-40">|</span>
          <span className="text-player-two-sage">24ms Sync</span>
        </div>

        {/* Right: Partner Presence Beacon, Notifications & Settings */}
        <div className="flex items-center gap-2">
          {/* Partner Live Presence Status Badge */}
          <PartnerPresenceBadge
            partnerName={partnerDisplayName}
            partnerCity={partnerCity}
            state={partnerState}
            connectionStatus={partnerConnection}
            variant="compact"
            onNudge={handlePartnerTap}
          />

          {/* Whispers & Notifications Button */}
          {onOpenNotifications ? (
            <button
              onClick={onOpenNotifications}
              className="relative w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-raised transition-all cursor-pointer"
              aria-label="Whispers and notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 ? (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-shared-amber animate-pulse" />
              ) : null}
            </button>
          ) : null}

          {/* Quick Settings Link */}
          <Link
            href="/settings"
            className={`w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-raised transition-all ${
              pathname === "/settings" ? "text-shared-amber bg-surface-raised" : ""
            }`}
            aria-label="Couple Settings"
          >
            <Sliders className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </header>
  );
};
