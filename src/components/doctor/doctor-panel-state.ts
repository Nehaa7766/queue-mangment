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

export function applyOptimistic(
  view: DoctorPanelView,
  action: DoctorAction,
  nowIso: string,
): DoctorPanelView {
  if (action.type === "start") {
    const token = view.called.find((t) => t.id === action.tokenId);
    if (!token) return view;
    return {
      ...view,
      current: {
        ...token,
        status: "IN_SERVICE",
        serviceStartedAt: nowIso,
        assignedDoctorName: view.doctor.name,
      },
      called: view.called.filter((t) => t.id !== action.tokenId),
    };
  }
  if (view.current?.id !== action.tokenId) return view;
  return { ...view, current: null, seenToday: view.seenToday + 1 };
}

// Applies the token the server returned after an action.
export function applyResult(
  view: DoctorPanelView,
  token: StaffTokenView,
): DoctorPanelView {
  const called = view.called.filter((t) => t.id !== token.id);
  if (token.status === "IN_SERVICE") {
    return { ...view, current: token, called };
  }
  return {
    ...view,
    current: view.current?.id === token.id ? null : view.current,
    called,
  };
}
