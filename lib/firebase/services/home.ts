import { coupleService } from "./couple";
import { authService } from "./auth";
import { presenceService } from "./presence";
import { roomService } from "./rooms";
import { memoryService } from "./memories";
import type { GameType } from "@/types/domain";

export type HomePresetKey =
  | "live"
  | "partner_online"
  | "partner_offline"
  | "partner_in_game"
  | "partner_in_call"
  | "partner_away"
  | "no_previous_games"
  | "no_memories"
  | "new_couple";

export interface HomeUserData {
  displayName: string;
  city?: string;
  localTime?: string;
  colorRole: "ember";
  avatarUrl?: string;
  weather?: string;
}

export interface HomePartnerData {
  displayName: string;
  city?: string;
  localTime?: string;
  colorRole: "sage";
  avatarUrl?: string;
  presenceState: "online" | "offline" | "in_game" | "in_call" | "away";
  lastActiveAgo?: string;
  weather?: string;
  activityDetail?: string;
}

export interface HomeActivityData {
  type: "game" | "call" | "synced" | "quiet" | "awaiting_partner";
  title: string;
  subtitle: string;
  badgeLabel: string;
  badgeVariant: "amber" | "sage" | "ember" | "neutral";
  actionLabel: string;
  actionHref: string;
  secondaryActionLabel?: string;
  timeFormatted?: string;
}

export interface HomeChallengeData {
  id: string;
  question: string;
  partnerAnswered: boolean;
  partnerAnsweredAgo?: string;
  partnerAnswer?: string;
  userAnswer?: string;
  revealed: boolean;
}

export interface HomeContinueGameData {
  id: string;
  gameType: GameType;
  title: string;
  subtitle: string;
  roundLabel: string;
  progressPercent: number;
  actionLabel: string;
  href: string;
}

export interface HomeSuggestedGameData {
  id: string;
  gameType: GameType;
  title: string;
  subtitle: string;
  description: string;
  durationLabel: string;
  tags: string[];
  badgeLabel: string;
  badgeVariant: "amber" | "sage" | "ember" | "neutral";
  affinityBonus?: string;
  href: string;
}

export interface HomeRecentMemoryData {
  id: string;
  title: string;
  dateLabel: string;
  tag: string;
  tagVariant: "amber" | "sage" | "ember";
  description: string;
  imageUrl?: string;
  audioNote?: {
    title: string;
    duration: string;
  };
  highlightStat?: string;
}

export type SanctuaryConnectionStatus =
  | "no_couple"
  | "incomplete_couple"
  | "incomplete_partner_profile"
  | "connected";

export interface HomeSanctuaryState {
  presetKey: HomePresetKey;
  coupleId: string;
  daysTogether: number;
  user: HomeUserData;
  partner: HomePartnerData | null;
  greetingText: string;
  presenceStatusHeadline: string;
  presenceActionPrompt: string;
  currentActivity: HomeActivityData;
  todayChallenge?: HomeChallengeData | null;
  continueGame: HomeContinueGameData | null;
  suggestedGame?: HomeSuggestedGameData | null;
  recentMemory: HomeRecentMemoryData | null;
  encryptionSeal: string;
  distanceKm?: number;
  connectionStatus?: SanctuaryConnectionStatus;
}

export function getTimeOfDayGreeting(displayName: string): string {
  const hour = new Date().getHours();
  if (hour < 12) return `Good morning, ${displayName}`;
  if (hour < 18) return `Good afternoon, ${displayName}`;
  return `Good evening, ${displayName}`;
}

const BASELINE_SUGGESTED_GAME: HomeSuggestedGameData = {
  id: "find_it_first",
  gameType: "find_it_first",
  title: "Find It First: Tokyo vs London",
  subtitle: "5-min tactile photo duel",
  description: "Real-world artifact detection duel with haptic clues through dual camera feeds.",
  durationLabel: "4 mins",
  tags: ["Dual Camera", "Reflex", "Co-op"],
  badgeLabel: "Tonight's Duel",
  badgeVariant: "amber",
  affinityBonus: "+150 Affinity",
  href: "/play/find-it-first",
};

const BASELINE_CONTINUE_GAME: HomeContinueGameData = {
  id: "speed_duel_active",
  gameType: "speed_duel",
  title: "Speed Duel: The Great Meridian",
  subtitle: "Round 2 of 3 · Match Point",
  roundLabel: "Alex leads 1 - 0",
  progressPercent: 66,
  actionLabel: "Resume Duel",
  href: "/play",
};

const BASELINE_CHALLENGE: HomeChallengeData = {
  id: "spark_daily_01",
  question: "What song instantly takes you back to our rainy road trip through Devon?",
  partnerAnswered: true,
  partnerAnsweredAgo: "40m ago",
  partnerAnswer: "Bon Iver — Holocene on that foggy highway exit",
  userAnswer: "",
  revealed: false,
};

const BASELINE_MEMORY: HomeRecentMemoryData = {
  id: "mem_recent_duel",
  title: "Speed Duel: Tokyo Win",
  dateLabel: "Yesterday",
  tag: "Photo Duel",
  tagVariant: "amber",
  description: "Sam found the vintage tram ticket 0.12s before Alex spotted the red telephone booth.",
  imageUrl: "https://picsum.photos/seed/togetherplay-snap-finish/500/300",
  highlightStat: "0.12s difference",
};

export function getPresetHomeData(key: HomePresetKey, customUserName?: string): HomeSanctuaryState {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Preset demo data is strictly disabled in production. Home data must be loaded authoritatively via HomeService.fetchLiveHomeData()."
    );
  }

  if (key === "live") {
    throw new Error(
      "getPresetHomeData cannot be called with 'live'. Production and live sanctuary data must be loaded authoritatively via HomeService.fetchLiveHomeData()."
    );
  }

  const userName = customUserName || "Alex";
  const greeting = getTimeOfDayGreeting(userName);

  switch (key) {
    case "partner_offline":
      return {
        presetKey: "partner_offline",
        coupleId: "cpl_tokyo_london_4209",
        daysTogether: 42,
        distanceKm: 9560,
        encryptionSeal: "End-to-End Encrypted Sanctuary",
        greetingText: greeting,
        presenceStatusHeadline: "Sam is offline.",
        presenceActionPrompt: "Leave a whisper?",
        user: {
          displayName: userName,
          city: "London",
          localTime: "23:24",
          colorRole: "ember",
          avatarUrl: "https://picsum.photos/seed/alex-profile-london/200/200",
          weather: "Rainy · 9°C",
        },
        partner: {
          displayName: "Sam",
          city: "Tokyo",
          localTime: "07:24",
          colorRole: "sage",
          avatarUrl: "https://picsum.photos/seed/sam-profile-tokyo/200/200",
          presenceState: "offline",
          lastActiveAgo: "2h ago",
          weather: "Clear · 18°C",
          activityDetail: "Last active 2h ago in Tokyo",
        },
        currentActivity: {
          type: "quiet",
          title: "Sanctuary Quiet",
          subtitle: "Sam was last active 2 hours ago. Leave an audio whisper or photo note for morning wakeup.",
          badgeLabel: "Quiet Hours",
          badgeVariant: "neutral",
          actionLabel: "Leave a Whisper Note",
          actionHref: "/memories",
          timeFormatted: "Offline",
        },
        todayChallenge: BASELINE_CHALLENGE,
        continueGame: BASELINE_CONTINUE_GAME,
        suggestedGame: BASELINE_SUGGESTED_GAME,
        recentMemory: BASELINE_MEMORY,
      };

    case "partner_in_game":
      return {
        presetKey: "partner_in_game",
        coupleId: "cpl_tokyo_london_4209",
        daysTogether: 42,
        distanceKm: 9560,
        encryptionSeal: "End-to-End Encrypted Sanctuary",
        greetingText: greeting,
        presenceStatusHeadline: "Sam is in game.",
        presenceActionPrompt: "Join Sam?",
        user: {
          displayName: userName,
          city: "London",
          localTime: "23:24",
          colorRole: "ember",
          avatarUrl: "https://picsum.photos/seed/alex-profile-london/200/200",
          weather: "Rainy · 9°C",
        },
        partner: {
          displayName: "Sam",
          city: "Tokyo",
          localTime: "07:24",
          colorRole: "sage",
          avatarUrl: "https://picsum.photos/seed/sam-profile-tokyo/200/200",
          presenceState: "in_game",
          weather: "Clear · 18°C",
          activityDetail: "Playing Find It First (Round 2)",
        },
        currentActivity: {
          type: "game",
          title: "Find It First: Tokyo vs London",
          subtitle: "Sam is in Round 2 lobby right now holding Sage clues. Jump in to detect the next clue!",
          badgeLabel: "Live Match",
          badgeVariant: "amber",
          actionLabel: "Join Sam in Round 2",
          actionHref: "/play/find-it-first",
          timeFormatted: "01:54",
        },
        todayChallenge: BASELINE_CHALLENGE,
        continueGame: BASELINE_CONTINUE_GAME,
        suggestedGame: BASELINE_SUGGESTED_GAME,
        recentMemory: BASELINE_MEMORY,
      };

    case "partner_in_call":
      return {
        presetKey: "partner_in_call",
        coupleId: "cpl_tokyo_london_4209",
        daysTogether: 42,
        distanceKm: 9560,
        encryptionSeal: "End-to-End Encrypted Sanctuary",
        greetingText: greeting,
        presenceStatusHeadline: "Sam is in call.",
        presenceActionPrompt: "Join audio?",
        user: {
          displayName: userName,
          city: "London",
          localTime: "23:24",
          colorRole: "ember",
          avatarUrl: "https://picsum.photos/seed/alex-profile-london/200/200",
          weather: "Rainy · 9°C",
        },
        partner: {
          displayName: "Sam",
          city: "Tokyo",
          localTime: "07:24",
          colorRole: "sage",
          avatarUrl: "https://picsum.photos/seed/sam-profile-tokyo/200/200",
          presenceState: "in_call",
          weather: "Clear · 18°C",
          activityDetail: "Connected in sanctuary audio room",
        },
        currentActivity: {
          type: "call",
          title: "Sanctuary Voice Channel",
          subtitle: "Encrypted audio link open. Low-latency relay across London & Tokyo.",
          badgeLabel: "Call Active",
          badgeVariant: "sage",
          actionLabel: "Rejoin Voice Call",
          actionHref: "/play",
          timeFormatted: "12:45",
        },
        todayChallenge: BASELINE_CHALLENGE,
        continueGame: BASELINE_CONTINUE_GAME,
        suggestedGame: BASELINE_SUGGESTED_GAME,
        recentMemory: BASELINE_MEMORY,
      };

    case "partner_away":
      return {
        presetKey: "partner_away",
        coupleId: "cpl_tokyo_london_4209",
        daysTogether: 42,
        distanceKm: 9560,
        encryptionSeal: "End-to-End Encrypted Sanctuary",
        greetingText: greeting,
        presenceStatusHeadline: "Sam is away.",
        presenceActionPrompt: "Leave a whisper?",
        user: {
          displayName: userName,
          city: "London",
          localTime: "23:24",
          colorRole: "ember",
          avatarUrl: "https://picsum.photos/seed/alex-profile-london/200/200",
          weather: "Rainy · 9°C",
        },
        partner: {
          displayName: "Sam",
          city: "Tokyo",
          localTime: "07:24",
          colorRole: "sage",
          avatarUrl: "https://picsum.photos/seed/sam-profile-tokyo/200/200",
          presenceState: "away",
          weather: "Clear · 18°C",
          activityDetail: "Stepped away from screen",
        },
        currentActivity: {
          type: "quiet",
          title: "Sam is Away",
          subtitle: "Sam stepped away a few moments ago. Leave a whisper or send a soft nudge.",
          badgeLabel: "Away",
          badgeVariant: "amber",
          actionLabel: "Send Heartbeat Nudge",
          actionHref: "/home",
          timeFormatted: "Away",
        },
        todayChallenge: BASELINE_CHALLENGE,
        continueGame: BASELINE_CONTINUE_GAME,
        suggestedGame: BASELINE_SUGGESTED_GAME,
        recentMemory: BASELINE_MEMORY,
      };

    case "no_previous_games":
      return {
        presetKey: "no_previous_games",
        coupleId: "cpl_tokyo_london_4209",
        daysTogether: 42,
        distanceKm: 9560,
        encryptionSeal: "End-to-End Encrypted Sanctuary",
        greetingText: greeting,
        presenceStatusHeadline: "Sam is online.",
        presenceActionPrompt: "Play something?",
        user: {
          displayName: userName,
          city: "London",
          localTime: "23:24",
          colorRole: "ember",
          avatarUrl: "https://picsum.photos/seed/alex-profile-london/200/200",
          weather: "Rainy · 9°C",
        },
        partner: {
          displayName: "Sam",
          city: "Tokyo",
          localTime: "07:24",
          colorRole: "sage",
          avatarUrl: "https://picsum.photos/seed/sam-profile-tokyo/200/200",
          presenceState: "online",
          weather: "Clear · 18°C",
          activityDetail: "Browsing game catalog",
        },
        currentActivity: {
          type: "synced",
          title: "Sanctuary Synced",
          subtitle: "Both connected in the sanctuary. Pick your very first game together to open your shared scores.",
          badgeLabel: "Connected",
          badgeVariant: "sage",
          actionLabel: "Pick First Game",
          actionHref: "/play",
          timeFormatted: "Ready",
        },
        todayChallenge: BASELINE_CHALLENGE,
        continueGame: null,
        suggestedGame: {
          ...BASELINE_SUGGESTED_GAME,
          title: "First Duel: Find It First",
          badgeLabel: "Recommended Starter",
        },
        recentMemory: BASELINE_MEMORY,
      };

    case "no_memories":
      return {
        presetKey: "no_memories",
        coupleId: "cpl_tokyo_london_4209",
        daysTogether: 42,
        distanceKm: 9560,
        encryptionSeal: "End-to-End Encrypted Sanctuary",
        greetingText: greeting,
        presenceStatusHeadline: "Sam is online.",
        presenceActionPrompt: "Play something?",
        user: {
          displayName: userName,
          city: "London",
          localTime: "23:24",
          colorRole: "ember",
          avatarUrl: "https://picsum.photos/seed/alex-profile-london/200/200",
          weather: "Rainy · 9°C",
        },
        partner: {
          displayName: "Sam",
          city: "Tokyo",
          localTime: "07:24",
          colorRole: "sage",
          avatarUrl: "https://picsum.photos/seed/sam-profile-tokyo/200/200",
          presenceState: "online",
          weather: "Clear · 18°C",
          activityDetail: "Looking at shared room",
        },
        currentActivity: {
          type: "synced",
          title: "Tonight's Shared Moment",
          subtitle: "Find It First: Tokyo vs London · 5-min tactile photo duel.",
          badgeLabel: "Sam is Ready",
          badgeVariant: "sage",
          actionLabel: "Enter Room With Sam",
          actionHref: "/play/find-it-first",
          timeFormatted: "02:00",
        },
        todayChallenge: BASELINE_CHALLENGE,
        continueGame: BASELINE_CONTINUE_GAME,
        suggestedGame: BASELINE_SUGGESTED_GAME,
        recentMemory: null,
      };

    case "new_couple":
      return {
        presetKey: "new_couple",
        coupleId: "cpl_new_sanctuary",
        daysTogether: 1,
        distanceKm: 0,
        encryptionSeal: "Private Couple Sanctuary",
        greetingText: `Welcome, ${userName}`,
        presenceStatusHeadline: "Waiting for your partner.",
        presenceActionPrompt: "Ready to connect?",
        user: {
          displayName: userName,
          city: "London",
          localTime: "23:24",
          colorRole: "ember",
          avatarUrl: "https://picsum.photos/seed/alex-profile-london/200/200",
          weather: "Mild",
        },
        partner: null,
        currentActivity: {
          type: "awaiting_partner",
          title: "Your Space is Created",
          subtitle: "You and your person are creating your own space. Send your invitation link so they can join.",
          badgeLabel: "1 of 2 Joined",
          badgeVariant: "amber",
          actionLabel: "Send Invitation Link",
          actionHref: "/onboarding/invite",
          timeFormatted: "Pending",
        },
        todayChallenge: {
          id: "welcome_spark",
          question: "What is your favorite memory together from the past month?",
          partnerAnswered: false,
          revealed: false,
        },
        continueGame: null,
        suggestedGame: {
          ...BASELINE_SUGGESTED_GAME,
          title: "Starter Game: Find It First",
          badgeLabel: "First Duel",
          description: "Once your partner connects, this quick 4-minute camera duel will be ready instantly.",
        },
        recentMemory: null,
      };

    case "partner_online":
      return {
        presetKey: "partner_online",
        coupleId: "cpl_tokyo_london_4209",
        daysTogether: 42,
        distanceKm: 9560,
        encryptionSeal: "End-to-End Encrypted Sanctuary",
        greetingText: greeting,
        presenceStatusHeadline: "Sam is online.",
        presenceActionPrompt: "Play something?",
        user: {
          displayName: userName,
          city: "London",
          localTime: "23:24",
          colorRole: "ember",
          avatarUrl: "https://picsum.photos/seed/alex-profile-london/200/200",
          weather: "Rainy · 9°C",
        },
        partner: {
          displayName: "Sam",
          city: "Tokyo",
          localTime: "07:24",
          colorRole: "sage",
          avatarUrl: "https://picsum.photos/seed/sam-profile-tokyo/200/200",
          presenceState: "online",
          weather: "Clear · 18°C",
          activityDetail: "Looking at shared sanctuary",
        },
        currentActivity: {
          type: "synced",
          title: "Tonight's Shared Moment",
          subtitle: "Find It First: Tokyo vs London · 5-min tactile photo duel.",
          badgeLabel: "Sam is In Lobby",
          badgeVariant: "sage",
          actionLabel: "Enter Shared Room With Sam",
          actionHref: "/play/find-it-first",
          timeFormatted: "01:54",
        },
        todayChallenge: BASELINE_CHALLENGE,
        continueGame: BASELINE_CONTINUE_GAME,
        suggestedGame: BASELINE_SUGGESTED_GAME,
        recentMemory: BASELINE_MEMORY,
      };

    default:
      throw new Error(
        `getPresetHomeData cannot provide data for '${key}'. Preset data is only available for development/testing preset states.`
      );
  }
}

export const LIVE_DEFAULT_SUGGESTED_GAME: HomeSuggestedGameData = {
  id: "find_it_first",
  gameType: "find_it_first",
  title: "Find It First",
  subtitle: "5-min tactile photo duel",
  description: "Real-world artifact detection duel with haptic clues through dual camera feeds.",
  durationLabel: "4 mins",
  tags: ["Dual Camera", "Reflex", "Co-op"],
  badgeLabel: "Featured Duel",
  badgeVariant: "amber",
  affinityBonus: "+150 Affinity",
  href: "/play/find-it-first",
};

export class HomeService {
  async fetchLiveHomeData(userId: string): Promise<HomeSanctuaryState> {
    try {
      const userProfile = await authService.getUserProfile(userId);
      const userName = userProfile?.displayName || "Explorer";
      const greeting = getTimeOfDayGreeting(userName);

      // 1. Authoritative User local time & city (derived strictly from user's timezone)
      let userCity: string | undefined = undefined;
      let userLocalTime: string | undefined = undefined;

      if (userProfile?.timezone) {
        try {
          userLocalTime = new Intl.DateTimeFormat([], {
            timeZone: userProfile.timezone,
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date());
          const tzParts = userProfile.timezone.split("/");
          if (tzParts.length > 1) {
            userCity = tzParts[tzParts.length - 1].replace(/_/g, " ");
          }
        } catch {
          userLocalTime = undefined;
          userCity = undefined;
        }
      }

      const user: HomeUserData = {
        displayName: userName,
        city: userCity,
        localTime: userLocalTime,
        colorRole: "ember",
        avatarUrl: userProfile?.photoURL || undefined,
        weather: undefined,
      };

      const couple = await coupleService.getUserCouple(userId);

      // State 1: Authenticated but no couple yet
      if (!couple) {
        return {
          presetKey: "new_couple",
          connectionStatus: "no_couple",
          coupleId: "",
          daysTogether: 0,
          distanceKm: undefined,
          encryptionSeal: "Private Couple Sanctuary",
          greetingText: greeting,
          presenceStatusHeadline: "No partner connected yet.",
          presenceActionPrompt: "Connect with your partner",
          user,
          partner: null,
          currentActivity: {
            type: "awaiting_partner",
            title: "Connect with Your Partner",
            subtitle:
              "Create a shared sanctuary space and invite your partner to begin your journey together.",
            badgeLabel: "Not Connected",
            badgeVariant: "neutral",
            actionLabel: "Connect with Your Partner",
            actionHref: "/onboarding/invite",
          },
          todayChallenge: null,
          continueGame: null,
          suggestedGame: null,
          recentMemory: null,
        };
      }

      // State 2: Authenticated with incomplete couple (waiting for partner to accept invite)
      if (couple.memberIds.length < 2) {
        return {
          presetKey: "new_couple",
          connectionStatus: "incomplete_couple",
          coupleId: couple.coupleId,
          daysTogether: 1,
          distanceKm: undefined,
          encryptionSeal: "Private Couple Sanctuary",
          greetingText: greeting,
          presenceStatusHeadline: "Waiting for your partner.",
          presenceActionPrompt: "Ready to connect?",
          user,
          partner: null,
          currentActivity: {
            type: "awaiting_partner",
            title: "Your Space is Created",
            subtitle:
              "You and your person are creating your own space. Send your invitation link so they can join.",
            badgeLabel: "1 of 2 Joined",
            badgeVariant: "amber",
            actionLabel: "Send Invitation Link",
            actionHref: "/onboarding/invite",
          },
          todayChallenge: null,
          continueGame: null,
          suggestedGame: null,
          recentMemory: null,
        };
      }

      // State 3: Valid live couple data (both partners connected)
      const partnerId = couple.memberIds.find((id) => id !== userId);
      if (!partnerId) {
        return {
          presetKey: "new_couple",
          connectionStatus: "incomplete_couple",
          coupleId: couple.coupleId,
          daysTogether: 1,
          distanceKm: undefined,
          encryptionSeal: "Private Couple Sanctuary",
          greetingText: greeting,
          presenceStatusHeadline: "Waiting for your partner.",
          presenceActionPrompt: "Ready to connect?",
          user,
          partner: null,
          currentActivity: {
            type: "awaiting_partner",
            title: "Your Space is Created",
            subtitle: "Send your invitation link so your partner can join.",
            badgeLabel: "1 of 2 Joined",
            badgeVariant: "amber",
            actionLabel: "Send Invitation Link",
            actionHref: "/onboarding/invite",
          },
          todayChallenge: null,
          continueGame: null,
          suggestedGame: null,
          recentMemory: null,
        };
      }

      // 2. Authoritative Partner Profile
      const partnerProfile = await authService.getUserProfile(partnerId);
      if (!partnerProfile || !partnerProfile.displayName) {
        return {
          presetKey: "live",
          connectionStatus: "incomplete_partner_profile",
          coupleId: couple.coupleId,
          daysTogether: 1,
          distanceKm: undefined,
          encryptionSeal: "Private Couple Sanctuary",
          greetingText: greeting,
          presenceStatusHeadline: "Partner profile setup in progress.",
          presenceActionPrompt: "Awaiting partner profile",
          user,
          partner: {
            displayName: partnerProfile?.displayName || "Partner",
            colorRole: "sage",
            presenceState: "offline",
            activityDetail: "Setting up profile",
          },
          currentActivity: {
            type: "awaiting_partner",
            title: "Partner Joined · Profile In Progress",
            subtitle: "Your partner has joined the sanctuary and is completing their profile.",
            badgeLabel: "Profile Incomplete",
            badgeVariant: "amber",
            actionLabel: "Sanctuary Settings",
            actionHref: "/settings",
          },
          todayChallenge: null,
          continueGame: null,
          suggestedGame: null,
          recentMemory: null,
        };
      }

      const partnerName = partnerProfile.displayName;

      // 3. Authoritative Partner Timezone & Local Time
      let partnerCity: string | undefined = undefined;
      let partnerLocalTime: string | undefined = undefined;

      if (partnerProfile?.timezone) {
        try {
          partnerLocalTime = new Intl.DateTimeFormat([], {
            timeZone: partnerProfile.timezone,
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date());
          const tzParts = partnerProfile.timezone.split("/");
          if (tzParts.length > 1) {
            partnerCity = tzParts[tzParts.length - 1].replace(/_/g, " ");
          }
        } catch {
          partnerLocalTime = undefined;
          partnerCity = undefined;
        }
      }

      // 4. Authoritative Presence & State
      const partnerPresence = presenceService.getUserPresence(partnerId);
      let isOnline = false;
      let presenceState: "online" | "offline" | "in_game" | "in_call" | "away" = "offline";
      let lastActiveAgo: string | undefined = undefined;

      if (partnerPresence) {
        if (partnerPresence.state === "IN_GAME") {
          presenceState = "in_game";
          isOnline = true;
        } else if (partnerPresence.state === "IN_CALL") {
          presenceState = "in_call";
          isOnline = true;
        } else if (partnerPresence.state === "AWAY") {
          presenceState = "away";
          isOnline = false;
        } else if (partnerPresence.state === "ONLINE" || partnerPresence.connectionStatus === "online") {
          presenceState = "online";
          isOnline = true;
        } else {
          presenceState = "offline";
          isOnline = false;
        }

        if (partnerPresence.lastSeenMs) {
          const elapsedMs = Math.max(0, Date.now() - partnerPresence.lastSeenMs);
          const mins = Math.floor(elapsedMs / (1000 * 60));
          const hours = Math.floor(mins / 60);
          if (mins < 1) lastActiveAgo = "just now";
          else if (hours < 1) lastActiveAgo = `${mins}m ago`;
          else if (hours < 24) lastActiveAgo = `${hours}h ago`;
          else lastActiveAgo = `${Math.floor(hours / 24)}d ago`;
        }
      } else if (partnerProfile?.lastActiveAt) {
        const lastActiveMs = new Date(partnerProfile.lastActiveAt).getTime();
        if (!isNaN(lastActiveMs)) {
          const inactiveMs = Math.max(0, Date.now() - lastActiveMs);
          if (inactiveMs < 5 * 60 * 1000) {
            presenceState = "online";
            isOnline = true;
          } else {
            presenceState = "offline";
            isOnline = false;
          }
          const mins = Math.floor(inactiveMs / (1000 * 60));
          const hours = Math.floor(mins / 60);
          if (mins < 1) lastActiveAgo = "just now";
          else if (hours < 1) lastActiveAgo = `${mins}m ago`;
          else if (hours < 24) lastActiveAgo = `${hours}h ago`;
          else lastActiveAgo = `${Math.floor(hours / 24)}d ago`;
        }
      }

      let partnerActivityDetail: string | undefined = undefined;
      if (partnerPresence?.currentActivity) {
        partnerActivityDetail = partnerPresence.currentActivity;
      } else if (isOnline) {
        partnerActivityDetail = "Connected in sanctuary";
      } else if (lastActiveAgo) {
        partnerActivityDetail = `Last active ${lastActiveAgo}`;
      }

      const partner: HomePartnerData = {
        displayName: partnerName,
        city: partnerCity,
        localTime: partnerLocalTime,
        colorRole: "sage",
        avatarUrl: partnerProfile?.photoURL || undefined,
        presenceState,
        lastActiveAgo,
        weather: undefined,
        activityDetail: partnerActivityDetail,
      };

      // 5. Authoritative Days Together
      let daysTogether = 1;
      const refDate = couple.relationshipStartDate || couple.createdAt;
      if (refDate) {
        const diffMs = Date.now() - new Date(refDate).getTime();
        if (!isNaN(diffMs)) {
          daysTogether = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        }
      }

      // 6. Authoritative Game Session Check
      let activeSession = null;
      try {
        activeSession = await roomService.getActiveSession(couple.coupleId);
      } catch {
        activeSession = null;
      }

      let continueGame: HomeContinueGameData | null = null;
      if (activeSession && activeSession.status !== "game_end" && activeSession.status !== "results") {
        const readableTitle = activeSession.gameType
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
        continueGame = {
          id: activeSession.gameId,
          gameType: activeSession.gameType,
          title: readableTitle,
          subtitle: "Active session",
          roundLabel: "In Progress",
          progressPercent: 50,
          actionLabel: "Resume Game",
          href: `/play/${activeSession.gameType}?gameId=${activeSession.gameId}`,
        };
      }

      // 7. Authoritative Current Activity
      let currentActivity: HomeActivityData;
      if (continueGame) {
        currentActivity = {
          type: "game",
          title: continueGame.title,
          subtitle: `${partnerName} and you have an active game session in progress.`,
          badgeLabel: "Active Game",
          badgeVariant: "amber",
          actionLabel: "Resume Game Session",
          actionHref: continueGame.href,
        };
      } else if (presenceState === "in_call") {
        currentActivity = {
          type: "call",
          title: "Sanctuary Voice Channel",
          subtitle: `${partnerName} is connected in the voice link.`,
          badgeLabel: "Call Active",
          badgeVariant: "sage",
          actionLabel: "Join Voice Call",
          actionHref: "/play",
        };
      } else if (isOnline) {
        currentActivity = {
          type: "synced",
          title: "Sanctuary Synced",
          subtitle: `${partnerName} is online in the sanctuary. Pick a game or activity to start together.`,
          badgeLabel: `${partnerName} Online`,
          badgeVariant: "sage",
          actionLabel: `Play with ${partnerName}`,
          actionHref: "/play",
        };
      } else {
        currentActivity = {
          type: "quiet",
          title: "Sanctuary Quiet",
          subtitle: `${partnerName} is currently away. Leave a whisper note or shared thought.`,
          badgeLabel: "Quiet Hours",
          badgeVariant: "neutral",
          actionLabel: "Leave a Whisper Note",
          actionHref: "/memories",
        };
      }

      // 8. Authoritative Memories
      let recentMemory: HomeRecentMemoryData | null = null;
      try {
        const coupleMemories = await memoryService.getMemories(couple.coupleId);
        if (coupleMemories && coupleMemories.length > 0) {
          const latest = coupleMemories[0];
          recentMemory = {
            id: latest.id,
            title: latest.title,
            dateLabel: latest.dateLabel || "Recent",
            tag: latest.type === "game_moment" ? "Game" : latest.type === "milestone" ? "Milestone" : "Memory",
            tagVariant: "sage",
            description: latest.context || latest.note || "",
            imageUrl: latest.media?.ephemeralUrl || undefined,
            highlightStat: latest.milestoneData?.metricValue || undefined,
          };
        }
      } catch {
        recentMemory = null;
      }

      return {
        presetKey: "live",
        connectionStatus: "connected",
        coupleId: couple.coupleId,
        daysTogether,
        distanceKm: undefined,
        encryptionSeal: "End-to-End Encrypted Sanctuary",
        greetingText: greeting,
        presenceStatusHeadline: isOnline ? `${partnerName} is online.` : `${partnerName} is offline.`,
        presenceActionPrompt: isOnline ? "Play something?" : "Leave a whisper?",
        user,
        partner,
        currentActivity,
        todayChallenge: null,
        continueGame,
        suggestedGame: null,
        recentMemory,
      };
    } catch (error) {
      console.warn("fetchLiveHomeData failed:", error);
      throw error;
    }
  }
}

export const homeService = new HomeService();
