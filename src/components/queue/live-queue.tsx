"use client";

import { PauseIcon, PlayIcon, UserPlusIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { QueueDoctorBanner } from "@/components/doctor/doctor-notice";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  API,
  type StaffQueueResponse,
  type StaffQueueSummary,
  type StaffQueueView,
  type StaffTokenResponse,
  type StaffTokenView,
} from "@/features/queue/contracts";
import { cn } from "@/lib/utils";
import { apiRequest, ApiError } from "./api-client";
import {
  applyOptimistic,
  callNextBlockedReason,
  nowServingToken,
  upsertToken,
  type LiveQueueAction,
} from "./live-queue-state";
import { MiniTicketRow } from "./mini-ticket-row";
import { NowServingTicket } from "./now-serving-ticket";
import { QueueStatusPill, TokenStatusPill } from "./status-pill";
import { displayName } from "./token-display";
import { useNow } from "./use-now";
import { WalkInForm } from "./walk-in-form";

const POLL_MS = 10_000;

type Confirm = { type: "skip"; token: StaffTokenView } | { type: "pause" };

function actionUrl(queueId: string, action: LiveQueueAction): string {
  switch (action.type) {
    case "callNext":
      return API.callNext(queueId);
    case "pause":
      return API.pauseQueue(queueId);
    case "resume":
      return API.resumeQueue(queueId);
    default:
      return API.tokenAction(action.tokenId, action.type);
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
    target.closest("[role=dialog],[role=alertdialog]") !== null
  );
}

// Live queue for one service (docs/PLAN.md §12.7, §12.10): polls every 10 s,
// updates optimistically and rolls back with an error toast on failure.
export function LiveQueue({
  initialView,
  queues,
  initialNow,
}: {
  initialView: StaffQueueView;
  queues: StaffQueueSummary[];
  initialNow: number;
}) {
  const [view, setView] = useState(initialView);
  const [pending, setPending] = useState<LiveQueueAction["type"] | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [lastSynced, setLastSynced] = useState(initialNow);
  const now = useNow(initialNow);
  const pendingRef = useRef(false);
  // Latest view for actions started later, e.g. from an Undo toast.
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  const queueId = view.queue.queueId;

  const refresh = useCallback(async () => {
    try {
      const fresh = await apiRequest<StaffQueueView>(API.queueTokens(queueId));
      // Don't overwrite an optimistic update that is still in flight.
      if (!pendingRef.current) {
        setView(fresh);
        setLastSynced(Date.now());
      }
    } catch {
      // Polling failures are silent; the next poll retries.
    }
  }, [queueId]);

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

  // Undo buttons in toasts call the latest `run` through this ref.
  const runRef = useRef<(action: LiveQueueAction) => Promise<void>>(
    async () => {},
  );
  const run = useCallback(
    async (action: LiveQueueAction): Promise<void> => {
      if (pendingRef.current) return;
      const before = viewRef.current;
      pendingRef.current = true;
      setPending(action.type);
      setView(applyOptimistic(before, action, new Date().toISOString()));
      try {
        const result = await apiRequest<
          StaffTokenResponse | StaffQueueResponse
        >(actionUrl(queueId, action), { method: "POST" });
        if ("token" in result) {
          setView((current) => upsertToken(current, result.token));
        } else {
          setView((current) => ({
            ...current,
            queue: { ...current.queue, status: result.queue.status },
          }));
        }
        announce(action, result, before.settings.allowRequeue, (next) =>
          runRef.current(next),
        );
      } catch (error) {
        setView(before);
        if (error instanceof ApiError && error.status === 409) {
          toast.warning(`${error.message} The queue has been refreshed.`);
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
    [queueId, refresh],
  );
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  const blockedReason = callNextBlockedReason(view, pending === "callNext");
  const featured = nowServingToken(view);
  const others = view.current.filter((token) => token.id !== featured?.id);

  // Keyboard shortcut N for Call next (docs/GUI_RULES.md §7).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "n" || event.repeat) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableTarget(event.target) || confirm || walkInOpen) return;
      if (blockedReason) return;
      event.preventDefault();
      void run({ type: "callNext" });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [blockedReason, confirm, run, walkInOpen]);

  const paused = view.queue.status === "PAUSED";
  const secondsSinceSync = Math.max(0, Math.round((now - lastSynced) / 1000));

  return (
    <div className="flex flex-col gap-4">
      {queues.length > 1 && (
        <nav aria-label="Services" className="flex flex-wrap gap-2">
          {queues.map((queue) => {
            const active = queue.queueId === queueId;
            return (
              <Link
                key={queue.queueId}
                href={`/receptionist/queue?queue=${queue.queueId}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-10 items-center gap-2 rounded-btn border px-3.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active
                    ? "border-slate bg-slate text-white"
                    : "border-border bg-card hover:bg-accent",
                )}
              >
                <span className="font-display font-extrabold">
                  {queue.tokenPrefix}
                </span>
                {queue.serviceName}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs font-semibold tabular-nums",
                    active
                      ? "bg-sand text-charcoal"
                      : "bg-terracotta text-charcoal",
                  )}
                >
                  {active ? view.queue.waitingCount : queue.waitingCount}
                </span>
              </Link>
            );
          })}
        </nav>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <QueueStatusPill status={view.queue.status} />
        <span className="text-xs text-muted-foreground tabular-nums">
          {view.queue.serviceName} · {view.queue.waitingCount} waiting · updated{" "}
          {secondsSinceSync < 5 ? "just now" : `${secondsSinceSync}s ago`}
        </span>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            className="h-10 rounded-btn"
            onClick={() => setWalkInOpen(true)}
          >
            <UserPlusIcon />
            Walk-in
          </Button>
          {view.queue.status !== "CLOSED" &&
            (paused ? (
              <Button
                variant="outline"
                className="h-10 rounded-btn"
                disabled={pending !== null}
                onClick={() => void run({ type: "resume" })}
              >
                <PlayIcon />
                Resume
              </Button>
            ) : (
              <Button
                variant="outline"
                className="h-10 rounded-btn"
                disabled={pending !== null}
                onClick={() => setConfirm({ type: "pause" })}
              >
                <PauseIcon />
                Pause
              </Button>
            ))}
        </div>
      </div>

      {paused && (
        <div
          role="status"
          className="rounded-card border border-border bg-status-off px-4 py-3 text-sm text-status-off-foreground"
        >
          The queue is paused. Patients can&apos;t join and no one can be called
          until you resume.
        </div>
      )}

      <QueueDoctorBanner
        doctors={view.doctors ?? []}
        serviceName={view.queue.serviceName}
        now={now}
      />

      <NowServingTicket
        token={featured}
        now={now}
        gracePeriodSeconds={view.settings.gracePeriodSeconds}
        actions={
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                className="h-14 rounded-btn px-5 text-base font-semibold sm:h-11 sm:text-sm"
                disabled={blockedReason !== null}
                aria-describedby={
                  blockedReason ? "call-next-reason" : undefined
                }
                aria-keyshortcuts="N"
                onClick={() => void run({ type: "callNext" })}
              >
                Call next
                <kbd className="ml-1 hidden rounded border border-charcoal/30 px-1.5 text-xs font-medium sm:inline">
                  N
                </kbd>
              </Button>
              {featured?.status === "CALLED" && (
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <Button
                    variant="outline"
                    className="h-11 rounded-btn px-5"
                    disabled={pending !== null}
                    onClick={() =>
                      void run({ type: "recall", tokenId: featured.id })
                    }
                  >
                    Recall
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 rounded-btn px-5"
                    disabled={pending !== null}
                    onClick={() =>
                      setConfirm({ type: "skip", token: featured })
                    }
                  >
                    Skip
                  </Button>
                </div>
              )}
            </div>
            {blockedReason && (
              <p
                id="call-next-reason"
                className="text-xs text-muted-foreground"
              >
                {blockedReason}
              </p>
            )}
          </div>
        }
      />

      {others.length > 0 && (
        <section
          aria-labelledby="also-called"
          className="rounded-card border border-border bg-card p-4"
        >
          <h2
            id="also-called"
            className="mb-2 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase"
          >
            Also called or with a doctor
          </h2>
          <ul className="flex flex-col divide-y divide-divider">
            {others.map((token) => (
              <li
                key={token.id}
                className="flex flex-wrap items-center gap-3 py-2"
              >
                <span className="font-display font-extrabold tabular-nums">
                  {token.tokenLabel}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {displayName(token.patientName)}
                </span>
                <TokenStatusPill status={token.status} />
                {token.status === "CALLED" && (
                  <span className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 rounded-btn"
                      disabled={pending !== null}
                      onClick={() =>
                        void run({ type: "recall", tokenId: token.id })
                      }
                    >
                      Recall
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 rounded-btn"
                      disabled={pending !== null}
                      onClick={() => setConfirm({ type: "skip", token })}
                    >
                      Skip
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="up-next" className="flex flex-col gap-2">
          <h2
            id="up-next"
            className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase"
          >
            Up next · {view.waiting.length}
          </h2>
          {view.waiting.length === 0 ? (
            <p className="rounded-card border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
              No one is waiting. New patients appear here as they join.
            </p>
          ) : (
            <ol className="flex flex-col gap-2">
              {view.waiting.map((token, index) => (
                <MiniTicketRow
                  key={token.id}
                  token={token}
                  isNext={index === 0}
                  now={now}
                  waitTargetMinutes={view.settings.waitTargetMinutes}
                  href={`/receptionist/tokens/${token.id}`}
                />
              ))}
            </ol>
          )}
        </section>

        <section aria-labelledby="recent" className="flex flex-col gap-2">
          <h2
            id="recent"
            className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase"
          >
            Recently finished
          </h2>
          {view.recent.length === 0 ? (
            <p className="rounded-card border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
              Finished, skipped and cancelled tokens show here.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-divider rounded-card border border-border bg-card px-4">
              {view.recent.map((token) => (
                <li key={token.id} className="flex items-center gap-3 py-2.5">
                  <span className="font-display font-extrabold tabular-nums">
                    {token.tokenLabel}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {displayName(token.patientName)}
                  </span>
                  <TokenStatusPill status={token.status} />
                  {token.status === "SKIPPED" && view.settings.allowRequeue && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 rounded-btn"
                      disabled={pending !== null}
                      onClick={() =>
                        void run({ type: "requeue", tokenId: token.id })
                      }
                    >
                      Requeue
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.type === "skip"
                ? `Skip ${confirm.token.tokenLabel}?`
                : "Pause the queue?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.type === "skip"
                ? `${displayName(confirm.token.patientName)} will be marked as a no-show.${view.settings.allowRequeue ? " You can requeue them later." : ""}`
                : "New patients can't join and no one can be called until you resume. People already waiting keep their place."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              onClick={() => {
                const current = confirm;
                setConfirm(null);
                if (current?.type === "skip") {
                  void run({ type: "skip", tokenId: current.token.id });
                } else if (current?.type === "pause") {
                  void run({ type: "pause" });
                }
              }}
            >
              {confirm?.type === "skip" ? "Skip patient" : "Pause queue"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={walkInOpen} onOpenChange={setWalkInOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Register walk-in</SheetTitle>
            <SheetDescription>
              Add a patient who is at the desk.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            <WalkInForm
              queues={queues.map((queue) =>
                queue.queueId === queueId
                  ? { ...queue, status: view.queue.status }
                  : queue,
              )}
              defaultQueueId={queueId}
              onCreated={() => {
                setWalkInOpen(false);
                void refresh();
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Success feedback, with Undo where the API can reverse the action.
function announce(
  action: LiveQueueAction,
  result: StaffTokenResponse | StaffQueueResponse,
  allowRequeue: boolean,
  run: (action: LiveQueueAction) => Promise<void>,
) {
  if ("queue" in result) {
    if (action.type === "pause") {
      toast("Queue paused.", {
        action: { label: "Undo", onClick: () => void run({ type: "resume" }) },
      });
    } else {
      toast.success("Queue resumed.");
    }
    return;
  }
  const { token } = result;
  const who = `${token.tokenLabel} · ${displayName(token.patientName)}`;
  switch (action.type) {
    case "callNext":
      toast.success(`Called ${who}.`);
      break;
    case "recall":
      toast(`Recalled ${who}.`);
      break;
    case "skip":
      toast(`Skipped ${who}.`, {
        action: allowRequeue
          ? {
              label: "Requeue",
              onClick: () => void run({ type: "requeue", tokenId: token.id }),
            }
          : undefined,
      });
      break;
    case "requeue":
      toast.success(`${who} is back in the queue.`);
      break;
  }
}
