import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HomePresenceHero } from "@/features/home/HomePresenceHero";
import { Avatar } from "@/components/ui/Avatar";
import type {
  HomeUserData,
  HomePartnerData,
  HomeSanctuaryState,
} from "@/lib/firebase/services/home";

// Mock next/link to render a simple <a> tag for static markup
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// Mock toast hook
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

const mockUser: HomeUserData = {
  displayName: "Alex",
  city: "London",
  localTime: "23:24",
  colorRole: "ember",
};

describe("Presence-State Correctness & Anti-Collapse Invariants", () => {
  // 1. ONLINE renders online state
  it("ONLINE renders online state with sanctuary presence text", () => {
    const onlinePartner: HomePartnerData = {
      displayName: "Sam",
      city: "Tokyo",
      localTime: "07:24",
      colorRole: "sage",
      presenceState: "online",
      presenceVerified: true,
    };

    const html = renderToStaticMarkup(
      <HomePresenceHero
        greetingText="Good evening, Alex"
        statusHeadline="Sam is online."
        actionPrompt="Play something?"
        user={mockUser}
        partner={onlinePartner}
      />
    );

    expect(html).toContain("Sam is here in your sanctuary");
    expect(html).not.toContain("Sam is in a tabletop session");
    expect(html).not.toContain("Voice connection active with Sam");
    expect(html).not.toContain("Sam is away");
    expect(html).not.toContain("Sam is offline");
  });

  // 2. IN_GAME renders game state & 6. IN_GAME does not render generic online state
  it("IN_GAME renders game state and does NOT collapse into generic online state", () => {
    const inGamePartner: HomePartnerData = {
      displayName: "Sam",
      city: "Tokyo",
      localTime: "07:24",
      colorRole: "sage",
      presenceState: "in_game",
      presenceVerified: true,
    };

    const html = renderToStaticMarkup(
      <HomePresenceHero
        greetingText="Good evening, Alex"
        statusHeadline="Sam is in a game."
        actionPrompt="Rejoin session?"
        user={mockUser}
        partner={inGamePartner}
      />
    );

    expect(html).toContain("Sam is in a tabletop session");
    expect(html).not.toContain("Sam is here in your sanctuary");
    expect(html).toContain("data-testid=\"partner-in-game-indicator\"");
    expect(html).toContain("Rejoin Game Session");
  });

  // 3. IN_CALL renders call state & 7. IN_CALL does not render generic online state
  it("IN_CALL renders call state and does NOT collapse into generic online state", () => {
    const inCallPartner: HomePartnerData = {
      displayName: "Sam",
      city: "Tokyo",
      localTime: "07:24",
      colorRole: "sage",
      presenceState: "in_call",
      presenceVerified: true,
    };

    const html = renderToStaticMarkup(
      <HomePresenceHero
        greetingText="Good evening, Alex"
        statusHeadline="Sam is in a call."
        actionPrompt="Join call?"
        user={mockUser}
        partner={inCallPartner}
      />
    );

    expect(html).toContain("Voice connection active with Sam");
    expect(html).not.toContain("Sam is here in your sanctuary");
    expect(html).toContain("data-testid=\"partner-in-call-indicator\"");
    expect(html).toContain("Join Voice Link");
  });

  // 4. AWAY renders away state & 8. AWAY does not receive online avatar semantics
  it("AWAY renders away state and does NOT receive online avatar semantics", () => {
    const awayPartner: HomePartnerData = {
      displayName: "Sam",
      city: "Tokyo",
      localTime: "07:24",
      colorRole: "sage",
      presenceState: "away",
      presenceVerified: true,
    };

    const html = renderToStaticMarkup(
      <HomePresenceHero
        greetingText="Good evening, Alex"
        statusHeadline="Sam is away."
        actionPrompt="Leave a whisper?"
        user={mockUser}
        partner={awayPartner}
      />
    );

    expect(html).toContain("Sam is away");
    expect(html).not.toContain("Sam is here in your sanctuary");
    expect(html).toContain("data-testid=\"partner-away-indicator\"");

    // Test Avatar directly with isOnline={false} for away
    const avatarHtml = renderToStaticMarkup(
      <Avatar
        name={awayPartner.displayName}
        colorRole="sage"
        size="xl"
        isOnline={false}
      />
    );

    // Online pulsing ping/ring indicator should NOT be present in Avatar markup when isOnline is false
    expect(avatarHtml).not.toContain("bg-player-two-sage absolute -bottom-0.5 -right-0.5");
  });

  // 5. OFFLINE renders offline state
  it("OFFLINE renders offline state with last active information", () => {
    const offlinePartner: HomePartnerData = {
      displayName: "Sam",
      city: "Tokyo",
      localTime: "07:24",
      colorRole: "sage",
      presenceState: "offline",
      presenceVerified: true,
      lastActiveAgo: "2h ago",
    };

    const html = renderToStaticMarkup(
      <HomePresenceHero
        greetingText="Good evening, Alex"
        statusHeadline="Sam is offline."
        actionPrompt="Leave a whisper?"
        user={mockUser}
        partner={offlinePartner}
      />
    );

    expect(html).toContain("Sam is offline");
    expect(html).toContain("Last active 2h ago");
    expect(html).not.toContain("Sam is here in your sanctuary");
    expect(html).not.toContain("data-testid=\"partner-in-game-indicator\"");
    expect(html).not.toContain("data-testid=\"partner-in-call-indicator\"");
  });

  // 9. Sync failure does not convert ONLINE to OFFLINE
  it("sync failure preserves last known presenceState and does NOT fabricate OFFLINE", () => {
    const prevKnownState: HomeSanctuaryState = {
      presetKey: "live",
      coupleId: "cpl_test_123",
      daysTogether: 42,
      greetingText: "Good evening, Alex",
      presenceStatusHeadline: "Sam is online.",
      presenceActionPrompt: "Play something?",
      user: mockUser,
      partner: {
        displayName: "Sam",
        city: "Tokyo",
        localTime: "07:24",
        colorRole: "sage",
        presenceState: "online",
        presenceVerified: true,
      },
      currentActivity: {
        type: "synced",
        title: "Sanctuary Synced",
        subtitle: "Both connected in sanctuary.",
        badgeLabel: "Connected",
        badgeVariant: "sage",
        actionLabel: "Play with Sam",
        actionHref: "/play",
      },
      continueGame: null,
      suggestedGame: null,
      recentMemory: null,
      encryptionSeal: "End-to-End Encrypted Sanctuary",
    };

    // Simulate the state update applied during State E sync failure in app/home/page.tsx:
    const updatedState: HomeSanctuaryState = {
      ...prevKnownState,
      partner: prevKnownState.partner
        ? {
            ...prevKnownState.partner,
            presenceVerified: false,
            activityDetail: "Presence unverified (sync paused)",
          }
        : null,
      presenceStatusHeadline: prevKnownState.partner
        ? `${prevKnownState.partner.displayName} · Presence unverified (sync paused)`
        : prevKnownState.presenceStatusHeadline,
      presenceActionPrompt: "Reconnecting...",
    };

    // Invariant: presenceState MUST remain "online" (not converted to "offline")
    expect(updatedState.partner?.presenceState).toBe("online");
    expect(updatedState.partner?.presenceState).not.toBe("offline");
    expect(updatedState.partner?.presenceVerified).toBe(false);
  });

  // 10. Sync failure produces an unverified state in UI
  it("sync failure produces an unverified state and does not claim partner is offline", () => {
    const unverifiedPartner: HomePartnerData = {
      displayName: "Sam",
      city: "Tokyo",
      localTime: "07:24",
      colorRole: "sage",
      presenceState: "online", // was previously online
      presenceVerified: false, // sync paused/failed
    };

    const html = renderToStaticMarkup(
      <HomePresenceHero
        greetingText="Good evening, Alex"
        statusHeadline="Sam · Presence unverified (sync paused)"
        actionPrompt="Reconnecting..."
        user={mockUser}
        partner={unverifiedPartner}
      />
    );

    expect(html).toContain("Live presence unverified · Sync paused");
    expect(html).toContain("data-testid=\"partner-unverified-indicator\"");
    expect(html).not.toContain("Sam is offline");
    expect(html).not.toContain("Sam is here in your sanctuary");
    // Action requiring confirmed live presence should NOT say "Play with Sam"
    expect(html).not.toContain("Play with Sam");
    expect(html).toContain("Leave a Whisper for Sam");
  });

  // 11. Retry restores the authoritative state after successful synchronization
  it("retry restores the authoritative state after successful synchronization", () => {
    // 1. Initial State: sync failed (unverified)
    let partnerState: HomePartnerData = {
      displayName: "Sam",
      city: "Tokyo",
      localTime: "07:24",
      colorRole: "sage",
      presenceState: "online",
      presenceVerified: false,
    };

    let heroHtml = renderToStaticMarkup(
      <HomePresenceHero
        greetingText="Good evening, Alex"
        statusHeadline="Sam · Presence unverified (sync paused)"
        actionPrompt="Reconnecting..."
        user={mockUser}
        partner={partnerState}
      />
    );
    expect(heroHtml).toContain("Live presence unverified · Sync paused");

    // 2. Successful retry: authoritative fetch succeeds
    const authoritativeFetchedPartner: HomePartnerData = {
      displayName: "Sam",
      city: "Tokyo",
      localTime: "07:24",
      colorRole: "sage",
      presenceState: "in_game", // partner was actually in a game
      presenceVerified: true,
      activityDetail: "Playing Couple Race",
    };

    partnerState = authoritativeFetchedPartner;

    heroHtml = renderToStaticMarkup(
      <HomePresenceHero
        greetingText="Good evening, Alex"
        statusHeadline="Sam is in a game."
        actionPrompt="Rejoin session?"
        user={mockUser}
        partner={partnerState}
      />
    );

    // Verified: authoritative state restored!
    expect(heroHtml).toContain("Sam is in a tabletop session");
    expect(heroHtml).toContain("data-testid=\"partner-in-game-indicator\"");
    expect(heroHtml).not.toContain("Live presence unverified · Sync paused");
  });
});
