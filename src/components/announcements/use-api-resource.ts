"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, apiRequest } from "@/components/queue/api-client";

export type ResourceState<T> =
  | { status: "loading" }
  | { status: "error"; error: ApiError }
  | {
      status: "ready";
      data: T;
      // When the data arrived, for "Today" labels without reading the clock
      // during render.
      loadedAt: number;
      // The last refresh failed; the data shown is from before it.
      stale: boolean;
    };

// Loads one GET endpoint and reloads it on demand. Reloads that arrive while
// a request is in flight are merged into one follow-up request, so a burst
// of live hints costs at most two requests.
export function useApiResource<T>(url: string) {
  const [state, setState] = useState<ResourceState<T>>({ status: "loading" });
  const busy = useRef(false);
  const again = useRef(false);
  const mounted = useRef(true);

  const reload = useCallback(async () => {
    if (busy.current) {
      again.current = true;
      return;
    }
    busy.current = true;
    try {
      do {
        again.current = false;
        try {
          const data = await apiRequest<T>(url);
          if (!mounted.current) return;
          setState({
            status: "ready",
            data,
            loadedAt: Date.now(),
            stale: false,
          });
        } catch (error) {
          if (!mounted.current) return;
          const apiError =
            error instanceof ApiError
              ? error
              : new ApiError(0, "INTERNAL_ERROR", "Something went wrong.");
          setState((current) =>
            current.status === "ready"
              ? { ...current, stale: true }
              : { status: "error", error: apiError },
          );
        }
      } while (again.current);
    } finally {
      busy.current = false;
    }
  }, [url]);

  // Shows the loading state again, e.g. for "Try again" on an error card.
  const retry = useCallback(() => {
    setState({ status: "loading" });
    void reload();
  }, [reload]);

  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => {
      mounted.current = false;
    };
  }, [reload]);

  return { state, reload, retry };
}
