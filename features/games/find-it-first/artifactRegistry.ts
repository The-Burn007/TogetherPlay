import React from "react";
import {
  Watch,
  Compass,
  Key,
  Shield,
  PenTool,
  Hourglass,
  Diamond,
  Book,
  Camera,
  Bell,
  Eye,
  Coffee,
  Mail,
  Navigation,
  Globe,
  Flame,
} from "lucide-react";

export interface ArtifactMeta {
  id: string;
  name: string;
  code: string;
  clue: string;
  category: "horology" | "navigation" | "antiquarian" | "correspondence" | "optics" | "curio";
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
}

export const ARTIFACT_CATALOG_MAP: Record<string, ArtifactMeta> = {
  watch: {
    id: "watch",
    name: "Pocket Watch",
    code: "#01",
    clue: "Precision horology with mechanical escapement",
    category: "horology",
    icon: Watch,
    accentColor: "from-amber-700/30 to-amber-900/40",
  },
  compass: {
    id: "compass",
    name: "Brass Compass",
    code: "#02",
    clue: "Magnetic needle attuned to true north",
    category: "navigation",
    icon: Compass,
    accentColor: "from-yellow-700/30 to-amber-900/40",
  },
  key: {
    id: "key",
    name: "Skeleton Key",
    code: "#03",
    clue: "Ornate iron bit suited for heavy deadbolts",
    category: "antiquarian",
    icon: Key,
    accentColor: "from-stone-700/30 to-stone-900/40",
  },
  seal: {
    id: "seal",
    name: "Wax Seal",
    code: "#04",
    clue: "Vermilion crest pressed into warm beeswax",
    category: "correspondence",
    icon: Shield,
    accentColor: "from-red-900/30 to-amber-950/40",
  },
  pen: {
    id: "pen",
    name: "Gold Nib Pen",
    code: "#05",
    clue: "Hand-ground iridium tip for maritime logs",
    category: "correspondence",
    icon: PenTool,
    accentColor: "from-amber-600/30 to-yellow-900/40",
  },
  hourglass: {
    id: "hourglass",
    name: "Brass Hourglass",
    code: "#06",
    clue: "Granular silicon sifting through twin globes",
    category: "horology",
    icon: Hourglass,
    accentColor: "from-amber-800/30 to-orange-950/40",
  },
  prism: {
    id: "prism",
    name: "Crystal Prism",
    code: "#07",
    clue: "Optical flint refracting white sunlight",
    category: "optics",
    icon: Diamond,
    accentColor: "from-cyan-900/30 to-blue-950/40",
  },
  book: {
    id: "book",
    name: "Leather Tome",
    code: "#08",
    clue: "Hand-stitched folio bound in aged vellum",
    category: "antiquarian",
    icon: Book,
    accentColor: "from-amber-950/40 to-stone-900/40",
  },
  camera: {
    id: "camera",
    name: "Twin Lens",
    code: "#09",
    clue: "Reflex viewfinder with brass aperture wheel",
    category: "optics",
    icon: Camera,
    accentColor: "from-stone-800/30 to-stone-950/40",
  },
  bell: {
    id: "bell",
    name: "Desk Bell",
    code: "#10",
    clue: "Domed bronze resonator with spring striker",
    category: "curio",
    icon: Bell,
    accentColor: "from-yellow-700/30 to-amber-900/40",
  },
  monocle: {
    id: "monocle",
    name: "Framed Monocle",
    code: "#11",
    clue: "Polished convex glass with galleried rim",
    category: "optics",
    icon: Eye,
    accentColor: "from-amber-900/30 to-stone-900/40",
  },
  mug: {
    id: "mug",
    name: "Clay Mug",
    code: "#12",
    clue: "Stoneware vessel fired with salt glaze",
    category: "curio",
    icon: Coffee,
    accentColor: "from-amber-900/30 to-stone-900/40",
  },
  postcard: {
    id: "postcard",
    name: "Airmail Post",
    code: "#13",
    clue: "Franked postmark from an overseas harbor",
    category: "correspondence",
    icon: Mail,
    accentColor: "from-blue-900/30 to-slate-900/40",
  },
  sextant: {
    id: "sextant",
    name: "Nautical Sextant",
    code: "#14",
    clue: "Graduated silver arc for celestial sights",
    category: "navigation",
    icon: Navigation,
    accentColor: "from-teal-900/30 to-slate-900/40",
  },
  armillary: {
    id: "armillary",
    name: "Armillary Ring",
    code: "#15",
    clue: "Concentric rings modeling the ecliptic sphere",
    category: "navigation",
    icon: Globe,
    accentColor: "from-yellow-800/30 to-amber-950/40",
  },
  lamp: {
    id: "lamp",
    name: "Brass Lantern",
    code: "#16",
    clue: "Beveled glass cage sheltering a warm flame",
    category: "curio",
    icon: Flame,
    accentColor: "from-orange-800/30 to-amber-950/40",
  },
};

export function getArtifactMeta(id: string): ArtifactMeta {
  return (
    ARTIFACT_CATALOG_MAP[id] || {
      id,
      name: id
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
      code: "#--",
      clue: "An antiquarian heirloom",
      category: "curio",
      icon: Diamond,
      accentColor: "from-stone-800/30 to-stone-900/40",
    }
  );
}
