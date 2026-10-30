import type {
  StaffQueueView,
  StaffTokenView,
} from "@/features/queue/contracts";

// Pure state helpers for the live queue screen: optimistic updates before
// the server answers, and folding the server's token back into the view.

export type LiveQueueAction =
  | { type: "callNext" }
  | { type: "recall"; tokenId: string }
  | { type: "skip"; tokenId: string }
  | { type: "requeue"; tokenId: string }
  | { type: "pause" }
  | { type: "resume" };

const FINISHED = new Set(["COMPLETED", "SKIPPED", "CANCELLED"]);
const RECENT_LIMIT = 20;

function findToken(
  view: StaffQueueView,
  tokenId: string,
): StaffTokenView | undefined {
  return [...view.current, ...view.waiting, ...view.recent].find(
    (token) => token.id === tokenId,
  );
}

// Puts a token in the list that matches its status. Requeued tokens go to
// the back of the waiting list, matching the server's sortKey rule.
export function upsertToken(
  view: StaffQueueView,
  token: StaffTokenView,
): StaffQueueView {
  const without = (list: StaffTokenView[]) =>
    list.filter((t) => t.id !== token.id);
  const current = without(view.current);
  const waiting = without(view.waiting);
  let recent = without(view.recent);

  if (token.status === "WAITING") {
    waiting.push(token);
  } else if (FINISHED.has(token.status)) {
    recent = [token, ...recent].slice(0, RECENT_LIMIT);
  } else {
    current.push(token);
    current.sort((a, b) => (a.calledAt ?? "").localeCompare(b.calledAt ?? ""));
  }

  return {
    ...view,
    queue: { ...view.queue, waitingCount: waiting.length },
    current,
    waiting,
    recent,
  };
}

export function applyOptimistic(
  view: StaffQueueView,
  action: LiveQueueAction,
  nowIso: string,
): StaffQueueView {
  switch (action.type) {
    case "pause":
      return { ...view, queue: { ...view.queue, status: "PAUSED" } };
    case "resume":
      return { ...view, queue: { ...view.queue, status: "OPEN" } };
    case "callNext": {
      const next = view.waiting[0];
      return next
        ? upsertToken(view, { ...next, status: "CALLED", calledAt: nowIso })
        : view;
    }
    default: {
      const token = findToken(view, action.tokenId);
      if (!token) return view;
      if (action.type === "recall") {
        // The server restarts the grace period on recall.
        return upsertToken(view, {
          ...token,
          calledAt: nowIso,
          recallCount: token.recallCount + 1,
        });
      }
      if (action.type === "skip")
        return upsertToken(view, { ...token, status: "SKIPPED" });
      return upsertToken(view, { ...token, status: "WAITING" });
    }
  }
}

// Why Call next can't run right now, or null when it can.
export function callNextBlockedReason(
  view: StaffQueueView,
  callInFlight: boolean,
): string | null {
  if (view.queue.status === "PAUSED")
    return "The queue is paused. Resume it to call the next patient.";
  if (view.queue.status === "CLOSED") return "The queue is closed for today.";
  if (view.waiting.length === 0) return "No one is waiting.";
  if (callInFlight) return "Calling the next patient…";
  return null;
}

// The token shown on the Now serving ticket: the latest called patient
// reception is waiting for, otherwise the latest one with a doctor.
export function nowServingToken(view: StaffQueueView): StaffTokenView | null {
  const byLatestCall = (list: StaffTokenView[]) =>
    [...list].sort((a, b) =>
      (b.calledAt ?? "").localeCompare(a.calledAt ?? ""),
    )[0];
  return (
    byLatestCall(view.current.filter((t) => t.status === "CALLED")) ??
    byLatestCall(view.current.filter((t) => t.status === "IN_SERVICE")) ??
    null
  );
}
