import {
  CircleCheckIcon,
  ClockIcon,
  PauseIcon,
  PhoneCallIcon,
  PlayIcon,
  RotateCcwIcon,
  StethoscopeIcon,
  UserCheckIcon,
  UserPlusIcon,
  UserXIcon,
  UsersIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { QueueFlowChart } from "@/components/charts/queue-flow-chart";
import { WaitingDonut } from "@/components/charts/waiting-donut";
import { AutoRefresh } from "@/components/layout/auto-refresh";
import { PageHeader } from "@/components/layout/page-header";
import {
  RECEPTION_ROLES,
  requireStaffPage,
} from "@/components/layout/staff-session";
import { KpiCard, type KpiTrend } from "@/components/queue/kpi-card";
import { MiniTicketRow } from "@/components/queue/mini-ticket-row";
import { NowServingTicket } from "@/components/queue/now-serving-ticket";
import { QueueStatusPill } from "@/components/queue/status-pill";
import { formatClinicDay } from "@/components/queue/token-display";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  ActivityKind,
  DashboardView,
} from "@/features/analytics/dashboard";
import { getDashboardView } from "@/features/analytics/queries";
import { cn } from "@/lib/utils";

export default function ReceptionDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const context = await requireStaffPage(RECEPTION_ROLES);
  const view = await getDashboardView(context.clinic.id);
  const now = Date.parse(view.generatedAt);

  return (
    <>
      <AutoRefresh seconds={30} />
      <PageHeader
        title="Dashboard"
        status={
          <span className="inline-flex flex-wrap items-center gap-2">
            {view.queueCard ? (
              <QueueStatusPill status={view.queueCard.status} />
            ) : (
              <span>No queues today</span>
            )}
            <span>
              {formatClinicDay(view.generatedAt, view.clinic.timezone)}
            </span>
          </span>
        }
      />

      <section
        aria-label="Today at a glance"
        className="grid grid-cols-2 gap-3.5 lg:grid-cols-4"
      >
        <KpiCard
          label="Waiting now"
          value={view.kpis.waitingNow}
          icon={UsersIcon}
          trend={waitingTrend(view)}
        />
        <KpiCard
          label="Served today"
          value={view.kpis.servedToday}
          icon={UserCheckIcon}
          caption="Consultations completed"
        />
        <KpiCard
          label="Average wait"
          value={
            view.kpis.averageWaitMinutes === null
              ? "—"
              : `${view.kpis.averageWaitMinutes}m`
          }
          icon={ClockIcon}
          caption={averageWaitCaption(view)}
        />
        <KpiCard
          label="No-shows"
          value={view.kpis.noShowsToday}
          icon={UserXIcon}
          caption="Skipped today"
        />
      </section>

      <div className="mt-3.5 hidden gap-3.5 md:grid lg:grid-cols-[minmax(0,1fr)_340px]">
        <section
          aria-labelledby="flow-title"
          className="rounded-card border border-border bg-card p-5"
        >
          <h2 id="flow-title" className="mb-3 font-display text-base font-bold">
            Queue flow overview
          </h2>
          <QueueFlowChart data={view.flow} />
        </section>
        <section
          aria-labelledby="service-title"
          className="rounded-card border border-border bg-card p-5"
        >
          <h2
            id="service-title"
            className="mb-3 font-display text-base font-bold"
          >
            Waiting by service
          </h2>
          <WaitingDonut
            slices={view.waitingByService.map((service) => ({
              label: service.serviceName,
              value: service.waiting,
            }))}
          />
        </section>
      </div>

      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <RecentActivity activity={view.recentActivity} />
        <QueueCard view={view} now={now} />
      </div>
    </>
  );
}

function waitingTrend(view: DashboardView): KpiTrend {
  const diff = view.kpis.waitingNow - view.kpis.waitingLastHour;
  return {
    direction: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
    value: diff > 0 ? `+${diff}` : String(diff),
    // Fewer people waiting is good news.
    good: diff < 0,
    comparison: "vs last hour",
  };
}

function averageWaitCaption(view: DashboardView): string {
  const average = view.kpis.averageWaitMinutes;
  const target = view.waitTargetMinutes;
  if (average === null) return `No one called yet · target ${target}m`;
  return average > target
    ? `Over the ${target}m target`
    : `Within the ${target}m target`;
}

const ACTIVITY_STYLE: Record<
  ActivityKind,
  { icon: LucideIcon; className: string }
> = {
  joined: { icon: UserPlusIcon, className: "bg-cream text-slate" },
  walkIn: { icon: UserPlusIcon, className: "bg-cream text-slate" },
  called: { icon: PhoneCallIcon, className: "bg-slate-tint text-slate" },
  recalled: { icon: PhoneCallIcon, className: "bg-slate-tint text-slate" },
  skipped: { icon: UserXIcon, className: "bg-terracotta text-charcoal" },
  requeued: { icon: RotateCcwIcon, className: "bg-slate-tint text-slate" },
  cancelled: {
    icon: XIcon,
    className: "bg-status-off text-status-off-foreground",
  },
  started: { icon: StethoscopeIcon, className: "bg-slate text-white" },
  completed: {
    icon: CircleCheckIcon,
    className: "bg-status-done text-status-done-foreground",
  },
  paused: { icon: PauseIcon, className: "bg-sand text-charcoal" },
  resumed: {
    icon: PlayIcon,
    className: "bg-status-done text-status-done-foreground",
  },
  closed: {
    icon: XIcon,
    className: "bg-status-off text-status-off-foreground",
  },
  other: { icon: ClockIcon, className: "bg-slate-tint text-slate" },
};

function RecentActivity({
  activity,
}: {
  activity: DashboardView["recentActivity"];
}) {
  return (
    <section
      id="activity"
      aria-labelledby="activity-title"
      className="scroll-mt-20 rounded-card border border-border bg-card p-5"
    >
      <h2 id="activity-title" className="mb-3 font-display text-base font-bold">
        Recent activity
      </h2>
      {activity.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nothing yet today. Calls, walk-ins and no-shows will show here.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-divider">
          {activity.map((item) => {
            const style = ACTIVITY_STYLE[item.kind];
            return (
              <li key={item.id} className="flex items-center gap-3 py-2.5">
                <span
                  aria-hidden
                  className={cn(
                    "flex size-[34px] shrink-0 items-center justify-center rounded-full",
                    style.className,
                  )}
                >
                  <style.icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{item.title}</p>
                  {item.detail && (
                    <p className="truncate text-xs text-muted-foreground">
                      {item.detail}
                    </p>
                  )}
                </div>
                <time
                  dateTime={item.createdAt}
                  className="text-xs text-muted-foreground tabular-nums"
                >
                  {item.time}
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function QueueCard({ view, now }: { view: DashboardView; now: number }) {
  const card = view.queueCard;
  return (
    <section
      aria-labelledby="queue-card-title"
      className="flex flex-col gap-3 rounded-card border border-border bg-card p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="queue-card-title" className="font-display text-base font-bold">
          Queue{card && ` · ${card.serviceName}`}
        </h2>
        {card && (
          <span className="rounded-full bg-terracotta px-2 text-xs font-semibold text-charcoal tabular-nums">
            {card.waitingCount} waiting
          </span>
        )}
      </div>
      {!card ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No queues are open today. Queues open with the clinic&apos;s hours.
        </p>
      ) : (
        <>
          <NowServingTicket
            compact
            now={now}
            gracePeriodSeconds={0}
            token={
              card.nowServing && {
                ...card.nowServing,
                assignedDoctorName: null,
                recallCount: 0,
              }
            }
          />
          <h3 className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            Up next
          </h3>
          {card.upNext.length === 0 ? (
            <p className="text-sm text-muted-foreground">No one is waiting.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {card.upNext.map((token, index) => (
                <MiniTicketRow
                  key={token.id}
                  token={token}
                  isNext={index === 0}
                  now={now}
                  waitTargetMinutes={view.waitTargetMinutes}
                  href={`/receptionist/tokens/${token.id}`}
                />
              ))}
            </ol>
          )}
        </>
      )}
      <Link
        href={
          card
            ? `/receptionist/queue?queue=${card.queueId}`
            : "/receptionist/queue"
        }
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-10 rounded-btn",
        )}
      >
        Open live queue
      </Link>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-3.5">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-4 w-56" />
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-card" />
        ))}
      </div>
      <Skeleton className="hidden h-72 rounded-card md:block" />
      <Skeleton className="h-64 rounded-card" />
      <span className="sr-only">Loading the dashboard…</span>
    </div>
  );
}
