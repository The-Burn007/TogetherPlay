import type { CoupleMemory } from "./types";

/**
 * Baseline couple memories for London & Tokyo couple.
 * Provides high-fidelity starter artifacts demonstrating all 5 memory types:
 * photos, game moments, milestones, relationship dates, and notes.
 */
export function getDefaultCoupleMemories(coupleId: string): CoupleMemory[] {
  return [
    {
      id: "mem_duel_watch_01",
      coupleId,
      type: "game_moment",
      title: "Speed Duel: Pocket Watch Discovery",
      date: "2026-09-14T23:18:00Z",
      dateLabel: "Yesterday · 23:18 GMT",
      context: "Tokyo midnight rain & London late evening tea. Sam spotted the brass pocket watch reflex in 0.12 seconds.",
      note: "We spent 20 minutes laughing afterward about how our apartment lamps reflected the exact same angle across 9,560 km.",
      gameActivity: {
        gameType: "speed_duel",
        gameTitle: "Speed Duel: Reflex Matrix",
        resultSummary: "Sam won round 3 by 0.12 seconds",
        scoreOrMetric: "Reaction: 230ms vs 242ms",
        winnerName: "Sam",
        roundsPlayed: 5,
      },
      createdBy: "usr_sam_tokyo",
      authorName: "Sam",
      createdAt: "2026-09-14T23:25:00Z",
    },
    {
      id: "mem_photo_window_02",
      coupleId,
      type: "photo",
      title: "Golden Hour Balcony & Morning Rain",
      date: "2026-09-12T17:40:00Z",
      dateLabel: "Sep 12, 2026 · 17:40 GMT",
      context: "Synchronized snap during our Sunday afternoon call. Alex caught the golden light touching the London brick chimneys while Sam's morning tea steamed.",
      note: "Holding our mugs to the camera at the same second. Felt like sitting on the same quiet sofa.",
      media: {
        storagePath: `couples/${coupleId}/memories/sunday_window_warmth.webp`,
        fileName: "sunday_window_warmth.webp",
        contentType: "image/webp",
        caption: "Golden hour light over London chimneys & Tokyo dawn mist.",
        ephemeralUrl: "https://picsum.photos/seed/alex-sam-tea-moment/800/600",
      },
      createdBy: "usr_alex_london",
      authorName: "Alex",
      createdAt: "2026-09-12T17:45:00Z",
    },
    {
      id: "mem_milestone_40days_03",
      coupleId,
      type: "milestone",
      title: "Crossed 40-Day Ritual Streak",
      date: "2026-09-10T21:00:00Z",
      dateLabel: "Sep 10, 2026 · Milestone",
      context: "Forty consecutive evenings of joining our sanctuary space across 8 timezones without missing a day.",
      note: "Distance doesn't shrink the world; shared consistency does.",
      milestoneData: {
        milestoneType: "streak",
        metricLabel: "Active Streak",
        metricValue: "40 Consecutive Days",
        badgeTitle: "Meridian Keepers",
      },
      createdBy: "usr_alex_london",
      authorName: "Alex",
      createdAt: "2026-09-10T21:05:00Z",
    },
    {
      id: "mem_date_first_reunion_04",
      coupleId,
      type: "relationship_date",
      title: "Autumn Shinjuku Garden Walk Planning",
      date: "2026-08-28T14:30:00Z",
      dateLabel: "Aug 28, 2026 · Date Marker",
      context: "Marked on our shared calendar for November 14th reunion in Tokyo. The exact maple grove we promised to visit.",
      note: "Flights booked. Countdown officially pinned in our thoughts.",
      relationshipDateData: {
        eventDate: "2026-11-14",
        location: "Shinjuku Gyoen National Garden, Tokyo",
        anniversaryYear: 2,
        reflection: "Our second autumn reunion. Marked in ink on both desks.",
      },
      createdBy: "usr_sam_tokyo",
      authorName: "Sam",
      createdAt: "2026-08-28T14:35:00Z",
    },
    {
      id: "mem_note_whisper_05",
      coupleId,
      type: "note",
      title: "Letter on the Midnight Train",
      date: "2026-08-15T15:20:00Z",
      dateLabel: "Aug 15, 2026 · Intimate Note",
      context: "Written on the Yamanote line heading back to the apartment after a long work evening.",
      note: "Opened TogetherPlay just to see your London weather indicator say 'Mild breeze · 18°C'. It felt comforting knowing the sky you were walking under. See you at 22:00 for our duel.",
      createdBy: "usr_sam_tokyo",
      authorName: "Sam",
      createdAt: "2026-08-15T15:25:00Z",
    },
  ];
}
