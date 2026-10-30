// Accent colours for stat cards, footer stats and charts. Bars and lines use
// the bright shade; text uses a darker one that passes 4.5:1. "tan", "rose"
// and "blush" come from the brand palette and are for bars and lines only.
export type Tone =
  "brand" | "tan" | "rose" | "blush" | "amber" | "green" | "red" | "gray";

export const TONE_BAR: Record<Tone, string> = {
  brand: "bg-brand",
  tan: "bg-tan",
  rose: "bg-rose",
  blush: "bg-blush",
  amber: "bg-tone-amber",
  green: "bg-tone-green",
  red: "bg-tone-red",
  gray: "bg-muted-foreground",
};

export const TONE_TEXT: Record<Tone, string> = {
  brand: "text-brand",
  // The light palette shades fail contrast as text, so they read as brand.
  tan: "text-brand",
  rose: "text-brand",
  blush: "text-brand",
  amber: "text-status-wait-foreground",
  green: "text-status-done-foreground",
  red: "text-danger-text",
  gray: "text-muted-foreground",
};

// For Recharts, which needs colour values rather than classes.
export const TONE_HEX: Record<Tone, string> = {
  brand: "#86614f",
  tan: "#b98f76",
  rose: "#d5b3a7",
  blush: "#e7cec9",
  amber: "#d97706",
  green: "#16a34a",
  red: "#dc2626",
  gray: "#c4b8b2",
};
