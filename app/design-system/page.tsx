"use client";

import React, { useState } from "react";
import { Container } from "@/components/layout/Container";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Avatar, DualPartnerPill } from "@/components/ui/Avatar";
import { PresenceIndicator } from "@/components/ui/PresenceIndicator";
import { PlayerBadge } from "@/components/ui/PlayerBadge";
import { Timer } from "@/components/ui/Timer";
import { ScoreBoard } from "@/components/ui/ScoreBoard";
import { Dialog } from "@/components/ui/Dialog";
import { Drawer } from "@/components/ui/Drawer";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { CardSkeleton, Skeleton } from "@/components/ui/LoadingSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import {
  Sparkles,
  Search,
  Bell,
  CheckCircle2,
  Clock,
  Zap,
  Sliders,
  Smartphone,
  Eye,
  Layers,
} from "lucide-react";

export default function DesignSystemPage() {
  const { showToast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(14);
  const [testInput, setTestInput] = useState("");

  return (
    <Container size="md" className="space-y-10 pb-32">
      {/* 1. Header & Architecture Philosophy */}
      <header className="flex flex-col space-y-2 border-b border-subtle-border pb-6">
        <div className="flex items-center justify-between text-[10px] font-mono">
          <span className="uppercase tracking-widest text-shared-amber font-semibold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-shared-amber animate-ping" />
            TogetherPlay Design System v1.0
          </span>
          <span className="text-on-surface-variant">Two People · One Shared Space</span>
        </div>
        <h1 className="text-3xl font-semibold text-canvas-cream tracking-tight">
          Visual Language &amp; Component Foundation
        </h1>
        <p className="text-sm text-on-surface-variant max-w-xl leading-relaxed">
          A tactile, intimate, and mature design system inspired by HorizonX. Built with warm obsidian surfaces, Player 1 Ember, Player 2 Sage, and Shared Amber resonance.
        </p>
      </header>

      {/* 2. Color Tokens */}
      <section className="flex flex-col space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-shared-amber" />
          <h2 className="text-lg font-semibold text-on-surface">1. Color Tokens &amp; Surfaces</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-surface-deep border border-subtle-border flex flex-col justify-between h-24">
            <span className="text-[10px] font-mono text-on-surface-variant uppercase">Canvas Deep</span>
            <span className="text-xs font-mono font-semibold text-canvas-cream">#0e0d10</span>
          </div>

          <div className="p-3 rounded-lg bg-surface-raised border border-subtle-border flex flex-col justify-between h-24">
            <span className="text-[10px] font-mono text-on-surface-variant uppercase">Surface Raised</span>
            <span className="text-xs font-mono font-semibold text-canvas-cream">#1a191d</span>
          </div>

          <div className="p-3 rounded-lg bg-player-one-ember border border-border-ember/40 flex flex-col justify-between h-24 text-canvas-cream">
            <span className="text-[10px] font-mono uppercase opacity-90">Player 1 (Ember)</span>
            <span className="text-xs font-mono font-semibold">#e05638</span>
          </div>

          <div className="p-3 rounded-lg bg-player-two-sage border border-border-sage/40 flex flex-col justify-between h-24 text-canvas-cream">
            <span className="text-[10px] font-mono uppercase opacity-90">Player 2 (Sage)</span>
            <span className="text-xs font-mono font-semibold">#4e7c69</span>
          </div>

          <div className="p-3 rounded-lg bg-shared-amber border border-border-amber/40 flex flex-col justify-between h-24 text-surface-deep">
            <span className="text-[10px] font-mono uppercase opacity-90">Shared Amber</span>
            <span className="text-xs font-mono font-semibold">#d99b38</span>
          </div>

          <div className="p-3 rounded-lg bg-surface-container border border-subtle-border flex flex-col justify-between h-24">
            <span className="text-[10px] font-mono text-on-surface-variant uppercase">Container High</span>
            <span className="text-xs font-mono font-semibold text-canvas-cream">#2d2b33</span>
          </div>

          <div className="p-3 rounded-lg bg-surface-overlay border border-accent-border flex flex-col justify-between h-24">
            <span className="text-[10px] font-mono text-on-surface-variant uppercase">Overlay Layer</span>
            <span className="text-xs font-mono font-semibold text-canvas-cream">#27252c</span>
          </div>

          <div className="p-3 rounded-lg bg-surface-container-highest border border-subtle-border flex flex-col justify-between h-24">
            <span className="text-[10px] font-mono text-on-surface-variant uppercase">Subtle Border</span>
            <span className="text-xs font-mono font-semibold text-canvas-cream">8% Opacity</span>
          </div>
        </div>
      </section>

      {/* 3. Typography Scale */}
      <section className="flex flex-col space-y-4">
        <h2 className="text-lg font-semibold text-on-surface">2. Typography Scale</h2>
        <Card variant="raised" className="p-5 space-y-4">
          <div className="border-b border-subtle-border pb-3">
            <span className="text-[10px] font-mono text-on-surface-variant uppercase">Display 2XL · Tight Tracking</span>
            <h1 className="text-3xl font-semibold text-canvas-cream tracking-tight mt-1">
              Two People. One Shared Space.
            </h1>
          </div>
          <div className="border-b border-subtle-border pb-3">
            <span className="text-[10px] font-mono text-on-surface-variant uppercase">Heading XL · 24px</span>
            <h2 className="text-2xl font-semibold text-on-surface tracking-tight mt-1">
              Find It First: Sensory Reflex Duel
            </h2>
          </div>
          <div className="border-b border-subtle-border pb-3">
            <span className="text-[10px] font-mono text-on-surface-variant uppercase">Heading LG · 18px</span>
            <h3 className="text-lg font-semibold text-on-surface mt-1">
              Evening Quick Spark: Nostalgia in Devon
            </h3>
          </div>
          <div>
            <span className="text-[10px] font-mono text-on-surface-variant uppercase">Monospace Telemetry · Tabular Numbers</span>
            <p className="text-xs font-mono text-shared-amber mt-1">
              9,560 KM · LONDON (23:24 GMT) ⇄ TOKYO (07:24 JST) · LATENCY 28MS
            </p>
          </div>
        </Card>
      </section>

      {/* 4. Buttons & Tactile Springs */}
      <section className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-on-surface">3. Buttons &amp; Motion Feedback</h2>
          <span className="text-xs font-mono text-on-surface-variant">whileTap: scale(0.97)</span>
        </div>

        <Card variant="raised" className="p-5 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="amber" onClick={() => showToast({ message: "Amber Action Triggered", variant: "nudge" })}>
              Shared Amber
            </Button>
            <Button variant="ember" onClick={() => showToast({ message: "Alex Action Triggered", variant: "turn" })}>
              Player 1 Ember
            </Button>
            <Button variant="sage" onClick={() => showToast({ message: "Sam Action Triggered", variant: "info" })}>
              Player 2 Sage
            </Button>
            <Button variant="surface">Surface Raised</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="amber" isLoading>
              Loading
            </Button>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button variant="amber" size="sm">
              Small (sm)
            </Button>
            <Button variant="amber" size="md">
              Medium (md)
            </Button>
            <Button variant="amber" size="lg">
              Large (lg)
            </Button>
          </div>
        </Card>
      </section>

      {/* 5. Inputs & Forms */}
      <section className="flex flex-col space-y-4">
        <h2 className="text-lg font-semibold text-on-surface">4. Tactile Inputs</h2>
        <Card variant="raised" className="p-5 space-y-4">
          <Input
            label="Partner Message"
            placeholder="Type a thought before Sam wakes up..."
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            helperText="Encrypted and synced directly over the London-Tokyo channel"
            iconPrefix={<Search className="w-4 h-4" />}
          />

          <Input
            label="Input Error State"
            defaultValue="Invalid Room Code"
            error="Room code expired 10 minutes ago"
          />
        </Card>
      </section>

      {/* 6. Avatars & Presence Indicators */}
      <section className="flex flex-col space-y-4">
        <h2 className="text-lg font-semibold text-on-surface">5. Avatars &amp; Presence Indicators</h2>
        <Card variant="raised" className="p-5 space-y-6">
          <div className="flex flex-wrap items-center justify-around gap-4 py-2">
            <Avatar
              name="Alex"
              colorRole="ember"
              size="lg"
              isOnline={true}
              city="London"
              time="23:24"
              imageUrl="https://picsum.photos/seed/alex-profile-london/200/200"
            />
            <DualPartnerPill
              partnerOneName="Alex"
              partnerTwoName="Sam"
              locationLabel="London & Tokyo"
            />
            <Avatar
              name="Sam"
              colorRole="sage"
              size="lg"
              isOnline={true}
              city="Tokyo"
              time="07:24"
              imageUrl="https://picsum.photos/seed/sam-profile-tokyo/200/200"
            />
          </div>

          <div className="pt-3 border-t border-subtle-border flex flex-wrap items-center justify-between gap-4">
            <PresenceIndicator
              state="online"
              colorRole="sage"
              label="Sam is in the Lobby"
              subLabel="Looking at game catalog"
              latencyMs={24}
            />

            <PresenceIndicator
              state="in_game"
              colorRole="ember"
              label="Alex is playing"
              subLabel="Round 2 of 3"
            />

            <PresenceIndicator
              state="idle"
              colorRole="amber"
              label="Shared Space Idle"
              subLabel="Awaiting connection"
            />
          </div>
        </Card>
      </section>

      {/* 7. Player Badges & Roles */}
      <section className="flex flex-col space-y-4">
        <h2 className="text-lg font-semibold text-on-surface">6. Player Badges &amp; Turn Indicators</h2>
        <Card variant="raised" className="p-5 flex flex-wrap items-center gap-3">
          <PlayerBadge
            name="Alex"
            colorRole="ember"
            roleLabel="Your Turn"
            isCurrentTurn={true}
            score={140}
          />
          <PlayerBadge
            name="Sam"
            colorRole="sage"
            roleLabel="Holding Clue"
            isCurrentTurn={false}
            score={160}
          />
          <PlayerBadge
            name="Shared Sync"
            colorRole="amber"
            roleLabel="42-Day Streak"
          />
        </Card>
      </section>

      {/* 8. Timers & Shared Scoreboard */}
      <section className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-on-surface">7. Timers &amp; Scoreboard HUD</h2>
          <Button
            variant="surface"
            size="sm"
            onClick={() => setTimerSeconds((prev) => (prev > 2 ? prev - 3 : 25))}
          >
            Adjust Time ({timerSeconds}s)
          </Button>
        </div>

        <ScoreBoard
          roundLabel="Round 3 of 5 · Sudden Death"
          distanceLabel="9,560 KM · LONDON ⇄ TOKYO"
          playerOneName="Alex"
          playerOneScore={140}
          playerOneStreak="+2 Streak"
          playerTwoName="Sam"
          playerTwoScore={160}
          playerTwoLead={true}
          remainingSeconds={timerSeconds}
          targetPrompt="FIND: VINTAGE POCKET WATCH OR CLOCKWORK ARTIFACT"
        />
      </section>

      {/* 9. Dialogs, Drawers & Modal Overlays */}
      <section className="flex flex-col space-y-4">
        <h2 className="text-lg font-semibold text-on-surface">8. Dialogs &amp; Bottom Drawers</h2>
        <Card variant="raised" className="p-5 flex flex-wrap items-center gap-3">
          <Button variant="amber" onClick={() => setIsDialogOpen(true)}>
            Open Dialog Modal
          </Button>
          <Button variant="surface" onClick={() => setIsDrawerOpen(true)}>
            Open Bottom Drawer
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              showToast({
                message: "Heartbeat pulse received from Sam in Tokyo",
                variant: "nudge",
              })
            }
          >
            Trigger Toast Notification
          </Button>
        </Card>

        {/* Live Modal Dialog */}
        <Dialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          title="Shared Game Confirmation"
          description="Sam has proposed a 4-minute Speed Duel session. Would you like to enter the room?"
          footer={
            <>
              <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>
                Decline
              </Button>
              <Button
                variant="amber"
                onClick={() => {
                  setIsDialogOpen(false);
                  showToast({ message: "Entering Shared Room...", variant: "turn" });
                }}
              >
                Accept &amp; Sync Camera
              </Button>
            </>
          }
        >
          <div className="p-3 bg-surface-deep border border-subtle-border rounded-lg text-xs font-mono space-y-1">
            <div className="flex justify-between text-on-surface-variant">
              <span>Game Mode:</span>
              <span className="text-on-surface font-semibold">Speed Duel (Sensory Reflex)</span>
            </div>
            <div className="flex justify-between text-on-surface-variant">
              <span>Rounds:</span>
              <span className="text-shared-amber font-semibold">3 Fast Rounds</span>
            </div>
          </div>
        </Dialog>

        {/* Live Bottom Drawer */}
        <Drawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          title="Couple Settings &amp; Meridian Telemetry"
          description="Manage tactile feedback, audio wake-up notes, and timezone calibrations."
          footer={
            <Button variant="amber" onClick={() => setIsDrawerOpen(false)} className="w-full">
              Done
            </Button>
          }
        >
          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 rounded-lg bg-surface-deep border border-subtle-border flex justify-between items-center">
              <span>Haptic Touch Pulse</span>
              <span className="font-mono text-player-two-sage font-semibold">Enabled</span>
            </div>
            <div className="p-3 rounded-lg bg-surface-deep border border-subtle-border flex justify-between items-center">
              <span>London-Tokyo Audio Relay</span>
              <span className="font-mono text-shared-amber font-semibold">28ms Latency</span>
            </div>
          </div>
        </Drawer>
      </section>

      {/* 10. Loading States, Skeletons & Empty States */}
      <section className="flex flex-col space-y-4">
        <h2 className="text-lg font-semibold text-on-surface">9. Loading States &amp; Shimmer Skeletons</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card variant="raised" className="p-5 flex flex-col items-center justify-center">
            <LoadingSpinner size="md" label="Synchronizing dual presence..." />
          </Card>

          <CardSkeleton />
        </div>

        <EmptyState
          title="No Unanswered Sparks"
          description="You and Sam have answered all daily intimacy prompts for today. Check back at 8:00 AM Tokyo dawn."
          actionLabel="View Sealed Memories"
          onAction={() => showToast({ message: "Opening Memories Archive...", variant: "info" })}
        />
      </section>
    </Container>
  );
}
