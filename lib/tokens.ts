/**
 * TogetherPlay Design System Foundation Tokens
 * 
 * Primary Brand Anchors:
 * - FOREST GRAPHITE: #18251D (Dominant foundation for intimacy & digital sanctuary)
 * - ACID MINT:       #B7FF72 (Intentional focal accents, resonance & tactile actions)
 * 
 * Typography:
 * - Display:  Fraunces (Major headings, milestones, emotional game prompts)
 * - UI/Body:  IBM Plex Sans (Navigation, controls, stats, game HUD)
 * - Numerals: Tabular figures for scores, timers, sync clocks
 * 
 * Accessibility:
 * - WCAG AA compliant contrast ratios across all core pairings
 * - Explicit keyboard focus states & >=44px minimum touch targets
 * - Multi-cue status indicators (never relying solely on color)
 */

export const tokens = {
  brand: {
    forestGraphite: "#18251D",
    acidMint: "#B7FF72",
  },
  colors: {
    // Primary Brand Semantic Tokens
    brand: "#B7FF72",
    brandHover: "#C7FF8F",
    brandActive: "#A3F758",
    brandSubtle: "rgba(183, 255, 114, 0.12)",
    brandGlow: "rgba(183, 255, 114, 0.28)",

    // Foundation Canvas & Surfaces (Forest Graphite Ramp)
    background: "#18251D",
    backgroundCanvas: "#111A14",
    surface: "#1F2F25",
    surfaceRaised: "#283C30",
    surfaceMuted: "#141F18",
    surfaceOverlay: "#22352B",
    surfaceFloat: "#2E4438",

    // Typography & Text Contrasts
    textPrimary: "#F2F7F2",       // 14.8:1 contrast on #18251D (WCAG AAA)
    textSecondary: "#BDCBBE",     // 9.4:1 contrast on #18251D (WCAG AAA)
    textMuted: "#7E9382",         // 4.7:1 contrast on #18251D (WCAG AA)
    textOnDark: "#F2F7F2",        // Clean pale mint-white on dark backgrounds
    textOnMint: "#121E16",        // 13.9:1 contrast on #B7FF72 (WCAG AAA)

    // Structural Borders
    border: "rgba(183, 255, 114, 0.14)",
    borderStrong: "rgba(183, 255, 114, 0.32)",
    borderSubtle: "rgba(242, 247, 242, 0.08)",

    // Functional & Feedback Statuses (Harmonized)
    success: "#B7FF72",
    warning: "#FFD166",           // 11.4:1 contrast on #18251D (WCAG AAA)
    danger: "#FF6B6B",            // 5.8:1 contrast on #18251D (WCAG AA)
    info: "#64D2FF",              // 9.7:1 contrast on #18251D (WCAG AAA)

    // Backward-Compatible Aliases for Unredesigned Components
    surfaces: {
      deep: "#111A14",
      base: "#18251D",
      raised: "#1F2F25",
      container: "#233529",
      containerHigh: "#2C4234",
      containerHighest: "#375241",
      overlay: "#22352B",
      float: "#2E4438",
    },
    player1: {
      ember: "#e05638",
      emberHover: "#eb674b",
      emberSubtle: "rgba(224, 86, 56, 0.12)",
      emberGlow: "rgba(224, 86, 56, 0.28)",
      emberText: "#f28b66",
    },
    player2: {
      sage: "#5b8e7a",
      sageHover: "#699e89",
      sageSubtle: "rgba(91, 142, 122, 0.16)",
      sageGlow: "rgba(91, 142, 122, 0.32)",
      sageText: "#8dbfab",
    },
    shared: {
      amber: "#d99b38",
      amberHover: "#e6a847",
      amberSubtle: "rgba(217, 155, 56, 0.12)",
      amberGlow: "rgba(217, 155, 56, 0.28)",
      amberText: "#f2b24c",
    },
    text: {
      cream: "#F2F7F2",
      sand: "#BDCBBE",
      body: "#F2F7F2",
      variant: "#BDCBBE",
      subtle: "#7E9382",
    },
    borders: {
      subtle: "rgba(242, 247, 242, 0.08)",
      accent: "rgba(183, 255, 114, 0.24)",
      amber: "rgba(217, 155, 56, 0.32)",
      ember: "rgba(224, 86, 56, 0.32)",
      sage: "rgba(91, 142, 122, 0.32)",
    },
  },

  typography: {
    fontFamilies: {
      display: "var(--font-fraunces), 'Fraunces', Georgia, serif",
      body: "var(--font-ibm-plex-sans), 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      ui: "var(--font-ibm-plex-sans), 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      tabular: "var(--font-ibm-plex-sans), monospace",
    },
    scale: {
      displayXl: { fontSize: "3.5rem", lineHeight: "1.1", letterSpacing: "-0.02em" },   // 56px
      displayLg: { fontSize: "2.75rem", lineHeight: "1.15", letterSpacing: "-0.02em" }, // 44px
      displayMd: { fontSize: "2rem", lineHeight: "1.2", letterSpacing: "-0.015em" },    // 32px
      titleLg: { fontSize: "1.5rem", lineHeight: "1.3", letterSpacing: "-0.01em" },      // 24px
      titleMd: { fontSize: "1.25rem", lineHeight: "1.35", letterSpacing: "-0.005em" },   // 20px
      bodyLg: { fontSize: "1.125rem", lineHeight: "1.55", letterSpacing: "0em" },       // 18px
      bodyMd: { fontSize: "1rem", lineHeight: "1.5", letterSpacing: "0em" },            // 16px
      bodySm: { fontSize: "0.875rem", lineHeight: "1.45", letterSpacing: "0.01em" },    // 14px
      caption: { fontSize: "0.75rem", lineHeight: "1.4", letterSpacing: "0.02em" },     // 12px
    },
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },

  // 4px/8px Baseline Spacing Rhythm
  spacing: {
    "0": "0px",
    "0.5": "2px",
    "1": "4px",
    "2": "8px",
    "3": "12px",
    "4": "16px",
    "5": "20px",
    "6": "24px",
    "8": "32px",
    "10": "40px",
    "12": "48px",
    "16": "64px",
    "20": "80px",
    "24": "96px",
  },

  radii: {
    none: "0px",
    xs: "4px",
    sm: "6px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    "2xl": "24px",
    full: "9999px",
  },

  shadows: {
    sm: "0 1px 3px 0 rgba(0, 0, 0, 0.35)",
    md: "0 4px 12px 0 rgba(0, 0, 0, 0.45)",
    lg: "0 12px 28px -4px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(183, 255, 114, 0.1)",
    mintGlow: "0 0 20px 2px rgba(183, 255, 114, 0.22)",
    focus: "0 0 0 2px #18251D, 0 0 0 4px #B7FF72",
  },

  focus: {
    outlineWidth: "2px",
    outlineOffset: "2px",
    outlineColor: "#B7FF72",
    ringClass: "focus-visible:outline-2 focus-visible:outline-[#B7FF72] focus-visible:outline-offset-2",
  },

  accessibility: {
    minTouchTarget: "44px",
    contrastAudit: {
      "textPrimary on background": "14.8:1 (AAA Pass)",
      "textSecondary on background": "9.4:1 (AAA Pass)",
      "textMuted on background": "4.7:1 (AA Pass)",
      "textOnMint on brand": "13.9:1 (AAA Pass)",
      "warning on background": "11.4:1 (AAA Pass)",
      "danger on background": "5.8:1 (AA Pass)",
      "info on background": "9.7:1 (AAA Pass)",
    },
  },

  zIndex: {
    deep: -1,
    base: 0,
    raised: 10,
    sticky: 20,
    header: 30,
    drawer: 40,
    modalBackdrop: 50,
    modal: 60,
    popover: 70,
    toast: 80,
    tooltip: 90,
  },

  motion: {
    springs: {
      snappy: { type: "spring", stiffness: 420, damping: 30 },
      gentle: { type: "spring", stiffness: 260, damping: 24 },
      bouncy: { type: "spring", stiffness: 450, damping: 20 },
    },
    durations: {
      instant: 0.1,
      fast: 0.15,
      normal: 0.25,
      relaxed: 0.4,
    },
    easings: {
      standard: "cubic-bezier(0.2, 0.0, 0, 1.0)",
      decelerate: "cubic-bezier(0.0, 0.0, 0.2, 1)",
      accelerate: "cubic-bezier(0.4, 0.0, 1, 1)",
    },
  },
} as const;

export type ColorTokens = typeof tokens.colors;
export type TypographyTokens = typeof tokens.typography;
export type SpacingTokens = typeof tokens.spacing;
export type RadiiTokens = typeof tokens.radii;
export type MotionTokens = typeof tokens.motion;
export type ZIndexTokens = typeof tokens.zIndex;

