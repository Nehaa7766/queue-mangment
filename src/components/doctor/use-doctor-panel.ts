"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { apiRequest, ApiError } from "@/components/queue/api-client";
import { displayName } from "@/components/queue/token-display";
import {
  DOCTOR_API,
  type DoctorPanelView,
  type DoctorSelfView,
} from "@/features/doctor/contracts";
import { API, type StaffTokenResponse } from "@/features/queue/contracts";
import {
  applyOptimistic,
  applyResult,
  type DoctorAction,
} from "./doctor-panel-state";

export const POLL_MS = 15_000;

// The doctor's live panel: polls every 15 s while the tab is visible, and
// starts or completes consultations optimistically, rolling back on failure.
export function useDoctorPanel(initialView: DoctorPanelView) {
  const [view, setView] = useState(initialView);
  const [pending, setPending] = useState<DoctorAction | null>(null);
  const [lastSynced, setLastSynced] = useState(() =>
    Date.parse(initialView.generatedAt),
  );
  const [refreshFailed, setRefreshFailed] = useState(false);
  const pendingRef = useRef(false);
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const refresh = useCallback(async () => {
    try {
      const fresh = await apiRequest<DoctorPanelView>(DOCTOR_API.panel);
      // Don't overwrite an optimistic update that is still in flight.
      if (!pendingRef.current) {
        setView(fresh);
        setLastSynced(Date.now());
      }
      setRefreshFailed(false);
    } catch {
      setRefreshFailed(true);
    }
  }, []);

  useEffect(() => {
    const poll = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const id = window.setInterval(poll, POLL_MS);
    document.addEventListener("visibilitychange", poll);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [refresh]);

  const run = useCallback(
    async (action: DoctorAction): Promise<void> => {
      if (pendingRef.current) return;
      const before = viewRef.current;
      pendingRef.current = true;
      setPending(action);
      setView(applyOptimistic(before, action, new Date().toISOString()));
      try {
        const { token } = await apiRequest<StaffTokenResponse>(
          API.tokenAction(action.tokenId, action.type),
          { method: "POST" },
        );
        setView((current) => applyResult(current, token));
        const who = `${token.tokenLabel} · ${displayName(token.patientName)}`;
        if (action.type === "start") {
          toast.success(`Consultation started with ${who}.`);
        } else {
          toast.success(`Consultation with ${who} completed.`);
        }
      } catch (error) {
        setView(before);
        if (error instanceof ApiError && error.status === 409) {
          toast.warning(`${error.message} The list has been refreshed.`);
        } else {
          toast.error(
            error instanceof ApiError
              ? error.message
              : "Something went wrong. Please try again.",
          );
        }
      } finally {
        pendingRef.current = false;
        setPending(null);
        void refresh();
      }
    },
    [refresh],
  );

  // After the availability form saves, show the new status straight away.
  const setDoctor = useCallback((doctor: DoctorSelfView) => {
    setView((current) => ({ ...current, doctor }));
  }, []);

  return { view, pending, run, refresh, lastSynced, refreshFailed, setDoctor };
}

export type DoctorPanel = ReturnType<typeof useDoctorPanel>;
