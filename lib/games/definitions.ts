import type {
  CameraChallengePrompt,
  CoupleRaceTile,
} from "@/types/domain";

export const CAMERA_CHALLENGES: CameraChallengePrompt[] = [
  {
    id: "cam_blue_object",
    title: "Show something blue.",
    category: "scavenger",
    description: "Search your surroundings and hold up an unmistakably blue object to the camera.",
    hint: "Books, clothing, mugs, or pens count!",
    countdownSeconds: 3,
    durationSeconds: 20,
  },
  {
    id: "cam_copy_pose",
    title: "Copy your partner's pose.",
    category: "pose",
    description: "Study your partner's exact stance or gesture and match it mirror-image in your frame.",
    hint: "Freeze once you have matched each other.",
    countdownSeconds: 3,
    durationSeconds: 20,
  },
  {
    id: "cam_funniest_face",
    title: "Make your funniest face.",
    category: "expression",
    description: "Hold nothing back. Channel your most absurd, dramatic, or hilarious expression.",
    hint: "No laughing until both partner captures are locked in!",
    countdownSeconds: 3,
    durationSeconds: 15,
  },
  {
    id: "cam_gift_from_partner",
    title: "Find something your partner gave you.",
    category: "memory",
    description: "Retrieve a memento, letter, gift, or souvenir your partner gave you across the miles.",
    hint: "Even small tokens or shared keepsakes count.",
    countdownSeconds: 3,
    durationSeconds: 30,
  },
  {
    id: "cam_first_profile_pic",
    title: "Recreate your first profile picture.",
    category: "expression",
    description: "Do you remember your earliest avatar or profile photo when you two met? Re-enact that exact face.",
    hint: "Angle, smirk, or tilt included!",
    countdownSeconds: 3,
    durationSeconds: 20,
  },
  {
    id: "cam_heart_hands",
    title: "Complete the heart across screens.",
    category: "synchrony",
    description: "Place your half of a hand-heart on your screen edge to connect with your partner's half.",
    hint: "Align your fingers along the seam between your frames.",
    countdownSeconds: 3,
    durationSeconds: 20,
  },
  {
    id: "cam_favorite_drink",
    title: "Show your drink or snack.",
    category: "scavenger",
    description: "Raise your current cup of tea, coffee, water, or treat for a long-distance toast.",
    hint: "Cheers across the timezones!",
    countdownSeconds: 3,
    durationSeconds: 20,
  },
  {
    id: "cam_sweetest_smile",
    title: "Give your warmest, sweetest smile.",
    category: "expression",
    description: "Look straight into the lens as if your partner is sitting directly across the table from you.",
    hint: "Hold the gaze together until the timer finishes.",
    countdownSeconds: 3,
    durationSeconds: 15,
  },
];

export const COUPLE_RACE_TILES: CoupleRaceTile[] = [
  { index: 0, type: "START", name: "Meridian Arch", description: "The grand brass start & lap line (+50 lap bonus)", bonusPoints: 50 },
  { index: 1, type: "REGULAR", name: "Cobblestone Way", description: "Smooth hand-laid pavers through the gardens" },
  { index: 2, type: "BOOST", name: "Zephyr Current", description: "Swift tailwind sweeps you +2 tiles forward", bonusPoints: 25, stepOffset: 2 },
  { index: 3, type: "REGULAR", name: "Amber Lantern", description: "Warm lamplight beside the fountain court" },
  { index: 4, type: "POWER_CACHE", name: "Scriptorium Vault", description: "Unlocks an authoritative tactical power card" },
  { index: 5, type: "REGULAR", name: "Ivy Trellis", description: "Climbing jasmine overlooking the central lawns" },
  { index: 6, type: "HARMONY_SYNC", name: "Twin Fountains", description: "If partner is within 3 tiles, both earn harmony bonus", bonusPoints: 75 },
  { index: 7, type: "REGULAR", name: "Carved Steps", description: "Polished sandstone ascending the terrace" },
  { index: 8, type: "SCENIC_REST", name: "Tea Pavilion", description: "A peaceful respite overlooking the hills (+40 pts)", bonusPoints: 40 },
  { index: 9, type: "REGULAR", name: "Sunlit Terrace", description: "Open mosaic tiles basking in afternoon light" },
  { index: 10, type: "BOOST", name: "Canopy Glide", description: "Suspended brass cable advances you +2 tiles", bonusPoints: 25, stepOffset: 2 },
  { index: 11, type: "REGULAR", name: "Mossy Milestone", description: "Carved stone marking the halfway quadrant" },
  { index: 12, type: "POWER_CACHE", name: "Alchemist's Desk", description: "Unlocks an authoritative tactical power card" },
  { index: 13, type: "REGULAR", name: "Whispering Bridge", description: "Arched wooden bridge spanning the water garden" },
  { index: 14, type: "CHALLENGE_GATE", name: "Winds of Chance", description: "Requires roll of 4+ to cross cleanly, else step back 1", stepOffset: -1 },
  { index: 15, type: "REGULAR", name: "Starlit Glade", description: "Soft grass fringed by illuminated magnolia" },
  { index: 16, type: "HARMONY_SYNC", name: "Reflection Pool", description: "Resonance node: partner proximity rewards both", bonusPoints: 75 },
  { index: 17, type: "REGULAR", name: "Marble Colonnade", description: "Fluted stone pillars framing the north fairway" },
  { index: 18, type: "BOOST", name: "Swift Stream", description: "Fast river current surges your piece +2 tiles", bonusPoints: 25, stepOffset: 2 },
  { index: 19, type: "REGULAR", name: "Rosewood Bench", description: "Quiet shaded alcove beneath ancient pines" },
  { index: 20, type: "POWER_CACHE", name: "Reliquary Niche", description: "Unlocks an authoritative tactical power card" },
  { index: 21, type: "REGULAR", name: "Grand Vista", description: "Panoramic vantage point across both worlds" },
  { index: 22, type: "SCENIC_REST", name: "Observatory Balcony", description: "Lookout terrace tracking celestial arcs (+40 pts)", bonusPoints: 40 },
  { index: 23, type: "REGULAR", name: "Bell Tower Foot", description: "Final approach before crossing the Meridian Arch" },
];

export interface ArtifactDefinition {
  id: string;
  name: string;
  code: string;
  clue: string;
  category: "horology" | "navigation" | "antiquarian" | "correspondence" | "optics" | "curio";
}

export const ARTIFACT_CATALOG: ArtifactDefinition[] = [
  { id: "watch", name: "Pocket Watch", code: "#01", clue: "Precision horology with mechanical escapement", category: "horology" },
  { id: "compass", name: "Brass Compass", code: "#02", clue: "Magnetic needle attuned to true north", category: "navigation" },
  { id: "key", name: "Skeleton Key", code: "#03", clue: "Ornate iron bit suited for heavy deadbolts", category: "antiquarian" },
  { id: "seal", name: "Wax Seal", code: "#04", clue: "Vermilion crest pressed into warm beeswax", category: "correspondence" },
  { id: "pen", name: "Gold Nib Pen", code: "#05", clue: "Hand-ground iridium tip for maritime logs", category: "correspondence" },
  { id: "hourglass", name: "Brass Hourglass", code: "#06", clue: "Granular silicon sifting through twin globes", category: "horology" },
  { id: "prism", name: "Crystal Prism", code: "#07", clue: "Optical flint refracting white sunlight", category: "optics" },
  { id: "book", name: "Leather Tome", code: "#08", clue: "Hand-stitched folio bound in aged vellum", category: "antiquarian" },
  { id: "camera", name: "Twin Lens", code: "#09", clue: "Reflex viewfinder with brass aperture wheel", category: "optics" },
  { id: "bell", name: "Desk Bell", code: "#10", clue: "Domed bronze resonator with spring striker", category: "curio" },
  { id: "monocle", name: "Framed Monocle", code: "#11", clue: "Polished convex glass with galleried rim", category: "optics" },
  { id: "mug", name: "Clay Mug", code: "#12", clue: "Stoneware vessel fired with salt glaze", category: "curio" },
  { id: "postcard", name: "Airmail Post", code: "#13", clue: "Franked postmark from an overseas harbor", category: "correspondence" },
  { id: "sextant", name: "Nautical Sextant", code: "#14", clue: "Graduated silver arc for celestial sights", category: "navigation" },
  { id: "armillary", name: "Armillary Ring", code: "#15", clue: "Concentric rings modeling the ecliptic sphere", category: "navigation" },
  { id: "lamp", name: "Brass Lantern", code: "#16", clue: "Beveled glass cage sheltering a warm flame", category: "curio" },
];
