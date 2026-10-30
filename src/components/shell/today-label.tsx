"use client";

import { useShellInfo } from "./shell-context";

// "Thu, 30 Oct 2026" in the clinic's timezone, from the request time the
// server passed down, so the server render and hydration print the same text.
// Built from parts because whole-string formats differ between ICU versions.
export function TodayLabel() {
  const { now, timezone } = useShellInfo();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).formatToParts(new Date(now));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return (
    <time dateTime={new Date(now).toISOString()}>
      {`${part("weekday")}, ${part("day")} ${part("month")} ${part("year")}`}
    </time>
  );
}
