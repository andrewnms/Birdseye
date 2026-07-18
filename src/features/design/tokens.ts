/** Core palette from design.md — the single source of truth for brand color. */
export const palette = {
  sky: "#4C8DFF",
  mint: "#6ED8C5",
  coral: "#FF8A70",
  cloud: "#F7F9FC",
  navy: "#16213E",
  teal: "#1E9C87",
  purple: "#8B7CF6",
  success: "#34C08B",
  signal: "#34E0A1",
  mutedText: "#5A6478",
  softText: "#64718F",
  stepLabel: "#8A94AB",
  line: "#E3E9F2",
  darkPill: "rgba(16, 26, 51, 0.76)",
  white: "#FFFFFF",
} as const;

/** Requested corner system: radius ≈ 0.33 × control height. */
export const radius = {
  button: 16, // 48px controls
  talk: 17, // 52px push-to-talk
  card: 22, // section cards
  chip: 14, // overlay chips and labels
} as const;

/** Signature gradients from design.md, as expo-linear-gradient props. */
export const gradients = {
  brandSweep: {
    colors: ["#26B49C", "#4C8DFF", "#8B7CF6"] as const,
    locations: [0, 0.48, 1] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0.35 },
  },
  voice: {
    colors: ["#4C8DFF", "#8B7CF6"] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
} as const;

/** Soft navy-tinted card shadow (design.md §7) for floating chrome. */
export const cardShadow = {
  shadowColor: "#16213E",
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.3,
  shadowRadius: 13,
  elevation: 8,
} as const;
