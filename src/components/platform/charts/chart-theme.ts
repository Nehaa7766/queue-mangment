import { TONE_HEX } from "@/components/dashboard/tone";

// Chart colours from the brand palette (docs/GUI_RULES.md §2): mocha for the
// main series, tan for the comparison, rose for a line drawn over bars.
export const SERIES_MAIN = TONE_HEX.brand;
export const SERIES_COMPARE = TONE_HEX.tan;
export const SERIES_LINE = TONE_HEX.rose;

// Axis text and grid lines take the wrapper's text colour (muted), so the
// charts follow the theme without colour values of their own.
export const CHART_WRAPPER = "text-muted-foreground";
export const AXIS_TICK = { fill: "currentColor", fontSize: 12 };
export const GRID_PROPS = {
  stroke: "currentColor",
  strokeOpacity: 0.12,
  vertical: false,
} as const;

export const HOVER_CURSOR = { fill: TONE_HEX.blush, fillOpacity: 0.35 };

export const TOOLTIP_STYLE = {
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  boxShadow: "var(--shadow-card)",
  fontSize: 12,
};
