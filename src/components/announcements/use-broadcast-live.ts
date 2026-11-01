"use client";

import { useEffect, useRef } from "react";
import {
  MESSAGING_API,
  MESSAGING_EVENT_NAME,
  type MessagingEvent,
} from "@/features/messaging/contracts";

// Fallback poll while an announcement is sending, for when the event stream
// is down or a hint gets lost.
export const LIVE_POLL_MS = 5_000;

function parseHint(data: unknown): MessagingEvent | null {
  if (typeof data !== "string") return null;
  try {
    const value = JSON.parse(data) as MessagingEvent;
    return typeof value?.type === "string" ? value : null;
  } catch {
    return null;
  }
}

// While `active`, listens to the staff event stream and calls `onUpdate` for
// every hint that `matches`, and on every (re)connect, since hints sent while
// disconnected are lost (docs/MESSAGING.md §Live updates). The stream only
// carries hints, so `onUpdate` refetches through REST. A poll every 5 seconds
// covers a stream that is down; it skips a turn when a hint has just
// refreshed the data. Inactive, nothing is open.
export function useBroadcastLive({
  active,
  matches,
  onUpdate,
}: {
  active: boolean;
  matches: (event: MessagingEvent) => boolean;
  onUpdate: () => void;
}) {
  const latest = useRef({ matches, onUpdate });
  useEffect(() => {
    latest.current = { matches, onUpdate };
  });

  useEffect(() => {
    if (!active) return;
    let lastUpdate = Date.now();
    const update = () => {
      lastUpdate = Date.now();
      latest.current.onUpdate();
    };

    let source: EventSource | null = null;
    if (typeof EventSource === "function") {
      source = new EventSource(MESSAGING_API.staffEvents);
      source.addEventListener("open", update);
      source.addEventListener(MESSAGING_EVENT_NAME, (event) => {
        const hint = parseHint((event as MessageEvent).data);
        if (hint && latest.current.matches(hint)) update();
      });
    }

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastUpdate < LIVE_POLL_MS - 250) return;
      update();
    }, LIVE_POLL_MS);

    return () => {
      source?.close();
      window.clearInterval(timer);
    };
  }, [active]);
}
