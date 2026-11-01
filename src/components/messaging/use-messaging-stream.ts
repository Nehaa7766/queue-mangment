"use client";

import {
  useEffect,
  useEffectEvent,
  useState,
  useSyncExternalStore,
} from "react";
import type { MessagingEvent } from "@/features/messaging/contracts";
import {
  MessagingStream,
  type StreamSnapshot,
  type StreamSubscribe,
} from "./stream";

export type MessagingStreamHandle = {
  snapshot: StreamSnapshot;
  subscribe: StreamSubscribe;
};

const SERVER_SNAPSHOT: StreamSnapshot = { status: "connecting", since: 0 };
const serverSnapshot = () => SERVER_SNAPSHOT;

// Opens the stream while mounted. The URL is fixed for the hook's lifetime;
// give the component a `key` to switch streams.
export function useMessagingStream(url: string): MessagingStreamHandle {
  const [stream] = useState(() => new MessagingStream(url));
  useEffect(() => {
    stream.start();
    return () => stream.stop();
  }, [stream]);
  const snapshot = useSyncExternalStore(
    stream.subscribeStatus,
    stream.getSnapshot,
    serverSnapshot,
  );
  return { snapshot, subscribe: stream.subscribe };
}

// Calls the latest handlers for every event and every (re)connect.
export function useStreamListener(
  subscribe: StreamSubscribe,
  handlers: {
    onEvent?: (event: MessagingEvent) => void;
    onOpen?: () => void;
  },
): void {
  const onEvent = useEffectEvent((event: MessagingEvent) =>
    handlers.onEvent?.(event),
  );
  const onOpen = useEffectEvent(() => handlers.onOpen?.());
  useEffect(
    () =>
      subscribe({
        onEvent: (event) => onEvent(event),
        onOpen: () => onOpen(),
      }),
    [subscribe],
  );
}
