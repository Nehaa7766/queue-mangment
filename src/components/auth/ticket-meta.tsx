"use client";

import { useSyncExternalStore } from "react";

// The sign-in page is prerendered, so the date and shift on the ticket are
// filled in by the browser after load (empty during the server render).
const subscribe = () => () => {};
const currentMinute = () => Math.floor(Date.now() / 60_000);
const notYet = () => -1;

function useNow(): Date | null {
  const minute = useSyncExternalStore(subscribe, currentMinute, notYet);
  return minute < 0 ? null : new Date(minute * 60_000);
}

// "Fri, 30 Oct".
export function TicketDate({ className }: { className?: string }) {
  const now = useNow();
  if (!now) return <p className={className}>&nbsp;</p>;
  const parts = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return (
    <p className={className}>
      {`${part("weekday")}, ${part("day")} ${part("month")}`}
    </p>
  );
}

// Morning, Afternoon, Evening or Night, from the device's clock.
export function TicketShift({ className }: { className?: string }) {
  const now = useNow();
  if (!now) return <p className={className}>&nbsp;</p>;
  const hour = now.getHours();
  const shift =
    hour >= 5 && hour < 12
      ? "Morning"
      : hour >= 12 && hour < 17
        ? "Afternoon"
        : hour >= 17 && hour < 21
          ? "Evening"
          : "Night";
  return <p className={className}>{shift}</p>;
}
