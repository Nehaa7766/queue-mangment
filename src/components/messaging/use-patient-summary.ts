"use client";

import { useEffect, useRef, useState } from "react";
import type { PatientMessagingSummary } from "@/features/messaging/contracts";
import { fetchPatientSummary } from "./api";
import { useRefresher } from "./refresher";
import type { StreamSubscribe } from "./stream";
import { useStreamListener } from "./use-messaging-stream";

export type PatientSummaryState = {
  data: PatientMessagingSummary | null;
  failed: boolean;
};

// The two chats on the patient's token page (unread counts, closed state,
// who answers the doctor chat). Refetched on every live event and reconnect.
export function usePatientSummary(
  publicTokenId: string,
  subscribe: StreamSubscribe,
  onFirstLoad?: (summary: PatientMessagingSummary) => void,
): PatientSummaryState & { refresh: () => void; retry: () => void } {
  const [state, setState] = useState<PatientSummaryState>({
    data: null,
    failed: false,
  });
  const loadedRef = useRef(false);
  const refresher = useRefresher(async () => {
    try {
      const data = await fetchPatientSummary(publicTokenId);
      setState({ data, failed: false });
      if (!loadedRef.current) {
        loadedRef.current = true;
        onFirstLoad?.(data);
      }
    } catch {
      setState((previous) => ({ ...previous, failed: true }));
    }
  }, 300);

  useEffect(() => {
    void refresher.run();
  }, [refresher]);

  useStreamListener(subscribe, {
    onEvent: () => refresher.schedule(),
    onOpen: () => refresher.schedule(),
  });

  return {
    ...state,
    refresh: () => refresher.schedule(),
    retry: () => void refresher.run(),
  };
}
