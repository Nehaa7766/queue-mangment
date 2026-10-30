"use client";

import { useEffect, useState } from "react";
import type { PublicTokenView } from "@/features/queue/contracts";
import { fetchPublicToken } from "./api-client";
import { CancelTokenButton } from "./cancel-token-button";
import { messages } from "./messages";
import { NotFoundCard } from "./not-found-card";
import { TokenStatusView } from "./token-status-view";

export const POLL_INTERVAL_MS = 15_000;

// Nothing changes after these, so polling stops.
const FINAL_STATUSES = new Set(["COMPLETED", "CANCELLED"]);

// Keeps the token page current: polls every 15 s while the tab is visible
// and refreshes as soon as the patient comes back to it.
export function TokenStatusLive({ initial }: { initial: PublicTokenView }) {
  const [token, setToken] = useState(initial);
  const [now, setNow] = useState(() => Date.parse(initial.updatedAt));
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [missing, setMissing] = useState(false);

  const isFinal = FINAL_STATUSES.has(token.status) || missing;
  const publicTokenId = initial.publicTokenId;

  useEffect(() => {
    if (isFinal) {
      return;
    }
    let cancelled = false;

    async function refresh() {
      setNow(Date.now());
      if (document.hidden) {
        return;
      }
      const result = await fetchPublicToken(publicTokenId);
      if (cancelled) {
        return;
      }
      if (result.ok) {
        setToken(result.data.token);
        setNow(Date.now());
        setRefreshFailed(false);
      } else if (result.code === "TOKEN_NOT_FOUND") {
        setMissing(true);
      } else {
        setRefreshFailed(true);
      }
    }

    function handleVisibility() {
      if (!document.hidden) {
        void refresh();
      }
    }

    const timer = window.setInterval(refresh, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isFinal, publicTokenId]);

  if (missing) {
    return (
      <NotFoundCard
        title={messages.token.notFoundTitle}
        body={messages.token.notFoundBody}
      />
    );
  }

  return (
    <TokenStatusView
      token={token}
      now={now}
      refreshFailed={refreshFailed}
      actions={
        token.status === "WAITING" ? (
          <CancelTokenButton
            publicTokenId={publicTokenId}
            onCancelled={setToken}
          />
        ) : null
      }
    />
  );
}
