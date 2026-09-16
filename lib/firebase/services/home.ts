import { coupleService } from "./couple";
import { authService } from "./auth";
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
  city: string;
  localTime: string;
  colorRole: "ember";
  avatarUrl?: string;
  weather?: string;
}

export interface HomePartnerData {
  displayName: string;
  city: string;
  localTime: string;
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
  affinityBonus: string;
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
  todayChallenge: HomeChallengeData;
  continueGame: HomeContinueGameData | null;
  suggestedGame: HomeSuggestedGameData;
  recentMemory: HomeRecentMemoryData | null;
  encryptionSeal: string;
  distanceKm: number;
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
    default:
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
  }
}

export class HomeService {
  async fetchLiveHomeData(userId: string): Promise<HomeSanctuaryState> {
    try {
      const userProfile = await authService.getUserProfile(userId);
      const userName = userProfile?.displayName || "Explorer";

      const couple = await coupleService.getUserCouple(userId);

      if (!couple || couple.memberIds.length < 2) {
        return getPresetHomeData("new_couple", userName);
      }

      const partnerId = couple.memberIds.find((id) => id !== userId);
      if (!partnerId) {
        return getPresetHomeData("new_couple", userName);
      }

      const partnerProfile = await authService.getUserProfile(partnerId);
      const partnerName = partnerProfile?.displayName || "Partner";

      let daysTogether = 42;
      if (couple.createdAt) {
        const diffMs = Date.now() - new Date(couple.createdAt).getTime();
        daysTogether = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      }

      let isOnline = false;
      let lastActiveAgo = "recent";
      if (partnerProfile?.lastActiveAt) {
        const lastActiveMs = new Date(partnerProfile.lastActiveAt).getTime();
        const inactiveMs = Date.now() - lastActiveMs;
        if (inactiveMs < 5 * 60 * 1000) {
          isOnline = true;
        } else {
          const hoursAgo = Math.floor(inactiveMs / (1000 * 60 * 60));
          lastActiveAgo = hoursAgo > 0 ? `${hoursAgo}h ago` : "recently";
        }
      }

      const greeting = getTimeOfDayGreeting(userName);

      return {
        presetKey: "live",
        coupleId: couple.coupleId,
        daysTogether,
        distanceKm: 9560,
        encryptionSeal: "End-to-End Encrypted Sanctuary",
        greetingText: greeting,
        presenceStatusHeadline: isOnline ? `${partnerName} is online.` : `${partnerName} is offline.`,
        presenceActionPrompt: isOnline ? "Play something?" : "Leave a whisper?",
        user: {
          displayName: userName,
          city: "London",
          localTime: new Intl.DateTimeFormat([], { hour: "2-digit", minute: "2-digit" }).format(new Date()),
          colorRole: "ember",
          avatarUrl: userProfile?.photoURL || "https://picsum.photos/seed/alex-profile-london/200/200",
          weather: "Rainy · 9°C",
        },
        partner: {
          displayName: partnerName,
          city: "Tokyo",
          localTime: "07:24",
          colorRole: "sage",
          avatarUrl: partnerProfile?.photoURL || "https://picsum.photos/seed/sam-profile-tokyo/200/200",
          presenceState: isOnline ? "online" : "offline",
          lastActiveAgo,
          weather: "Clear · 18°C",
          activityDetail: isOnline ? "Looking at shared sanctuary" : `Last active ${lastActiveAgo} in Tokyo`,
        },
        currentActivity: {
          type: isOnline ? "synced" : "quiet",
          title: "Tonight's Shared Moment",
          subtitle: "Find It First: Tokyo vs London · 5-min tactile photo duel.",
          badgeLabel: isOnline ? `${partnerName} is Online` : "Quiet Hours",
          badgeVariant: isOnline ? "sage" : "neutral",
          actionLabel: isOnline ? `Enter Shared Room With ${partnerName}` : "Leave a Whisper Note",
          actionHref: "/play/find-it-first",
          timeFormatted: isOnline ? "01:54" : "Offline",
        },
        todayChallenge: BASELINE_CHALLENGE,
        continueGame: BASELINE_CONTINUE_GAME,
        suggestedGame: BASELINE_SUGGESTED_GAME,
        recentMemory: BASELINE_MEMORY,
      };
    } catch (error) {
      console.warn("fetchLiveHomeData falling back to baseline:", error);
      return getPresetHomeData("partner_online", "Alex");
    }
  }
}

export const homeService = new HomeService();
