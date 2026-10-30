import type { DoctorPanelView } from "@/features/doctor/contracts";
import type { StaffTokenView } from "@/features/queue/contracts";

// Pure state changes for the doctor panel, so optimistic updates and their
// rollback are easy to test.

export type DoctorAction = { type: "start" | "complete"; tokenId: string };

// Why Start is unavailable, or null when the doctor can start a patient.
// The server enforces the same rule: one consultation at a time.
export function startBlockedReason(
  view: Pick<DoctorPanelView, "current">,
  pending: boolean,
): string | null {
  if (pending) return "Saving the last change…";
  if (view.current) return "Complete your current consultation first.";
  return null;
}

function without(
  tokens: readonly StaffTokenView[],
  id: string,
): StaffTokenView[] {
  return tokens.filter((token) => token.id !== id);
}

// In consultation: earliest start first, like the server's order.
function withInService(
  tokens: readonly StaffTokenView[],
  token: StaffTokenView,
): StaffTokenView[] {
  return [...without(tokens, token.id), token].sort((a, b) =>
    (a.serviceStartedAt ?? "").localeCompare(b.serviceStartedAt ?? ""),
  );
}

export function applyOptimistic(
  view: DoctorPanelView,
  action: DoctorAction,
  nowIso: string,
): DoctorPanelView {
  if (action.type === "start") {
    const token = view.called.find((t) => t.id === action.tokenId);
    if (!token) return view;
    const started: StaffTokenView = {
      ...token,
      status: "IN_SERVICE",
      serviceStartedAt: nowIso,
      assignedDoctorName: view.doctor.name,
    };
    return {
      ...view,
      current: started,
      called: without(view.called, action.tokenId),
      inService: withInService(view.inService, started),
    };
  }
  if (view.current?.id !== action.tokenId) return view;
  const done: StaffTokenView = {
    ...view.current,
    status: "COMPLETED",
    completedAt: nowIso,
  };
  return {
    ...view,
    current: null,
    inService: without(view.inService, action.tokenId),
    completedToday: [done, ...without(view.completedToday, action.tokenId)],
    seenToday: view.seenToday + 1,
  };
}

// Applies the token the server returned after an action.
export function applyResult(
  view: DoctorPanelView,
  token: StaffTokenView,
): DoctorPanelView {
  const called = without(view.called, token.id);
  if (token.status === "IN_SERVICE") {
    return {
      ...view,
      current: token,
      called,
      inService: withInService(view.inService, token),
    };
  }
  return {
    ...view,
    current: view.current?.id === token.id ? null : view.current,
    called,
    inService: without(view.inService, token.id),
    completedToday:
      token.status === "COMPLETED"
        ? [token, ...without(view.completedToday, token.id)]
        : view.completedToday,
  };
}
