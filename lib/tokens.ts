/**
 * TogetherPlay Design System Tokens
 * 
 * Defines the core visual language:
 * - Palette: Warm Obsidian & Terracotta Slate
 * - Entities: Player 1 (Ember), Player 2 (Sage), Shared Space (Amber)
 * - Typography, Radii, Shadows, Motion Curves
 */

export const tokens = {
  colors: {
    surfaces: {
      deep: "#0e0d10",
      base: "#141316",
      raised: "#1a191d",
      container: "#212025",
      containerHigh: "#2d2b33",
      containerHighest: "#37353e",
      overlay: "#27252c",
      float: "#32303a",
    },
    player1: {
      ember: "#e05638",
      emberHover: "#eb674b",
      emberSubtle: "rgba(224, 86, 56, 0.12)",
      emberGlow: "rgba(224, 86, 56, 0.28)",
      emberText: "#f28b66",
    },
    player2: {
      sage: "#4e7c69",
      sageHover: "#5b8e7a",
      sageSubtle: "rgba(78, 124, 105, 0.14)",
      sageGlow: "rgba(78, 124, 105, 0.28)",
      sageText: "#7ca897",
    },
    shared: {
      amber: "#d99b38",
      amberHover: "#e6a847",
      amberSubtle: "rgba(217, 155, 56, 0.12)",
      amberGlow: "rgba(217, 155, 56, 0.28)",
      amberText: "#f2b24c",
    },
    text: {
      cream: "#fbf9f5",
      sand: "#ece7de",
      body: "#e6e1e4",
      variant: "#a39ea4",
      subtle: "#6c676e",
    },
    borders: {
      subtle: "rgba(251, 249, 245, 0.08)",
      accent: "rgba(251, 249, 245, 0.16)",
      amber: "rgba(217, 155, 56, 0.32)",
      ember: "rgba(224, 86, 56, 0.32)",
      sage: "rgba(78, 124, 105, 0.32)",
    },
  },
  radii: {
    xs: "4px",
    sm: "6px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    full: "9999px",
  },
  motion: {
    springs: {
      snappy: { type: "spring", stiffness: 400, damping: 30 },
      gentle: { type: "spring", stiffness: 260, damping: 24 },
      bouncy: { type: "spring", stiffness: 450, damping: 20 },
    },
    durations: {
      fast: 0.15,
      normal: 0.25,
      relaxed: 0.4,
    },
  },
} as const;

export type ColorTokens = typeof tokens.colors;
export type MotionTokens = typeof tokens.motion;
