import {
  CircleCheckIcon,
  ClipboardListIcon,
  ClockIcon,
  ListOrderedIcon,
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
import { Suspense, type ReactNode } from "react";
import { QueueFlowChart } from "@/components/charts/queue-flow-chart";
import {
  DashboardCard,
  StatStrip,
} from "@/components/dashboard/dashboard-card";
import { HighlightCard } from "@/components/dashboard/highlight-card";
import { ListRow, TokenBadge } from "@/components/dashboard/list-row";
import { SparkCard } from "@/components/dashboard/spark-card";
import { StatCard } from "@/components/dashboard/stat-card";
import type { Tone } from "@/components/dashboard/tone";
import { AutoRefresh } from "@/components/layout/auto-refresh";
import { PageHeader } from "@/components/layout/page-header";
import {
  RECEPTION_ROLES,
  requireStaffPage,
} from "@/components/layout/staff-session";
import { QueueStatusPill } from "@/components/queue/status-pill";
import {
  QUEUE_STATUS_DISPLAY,
  displayName,
  minutesSince,
} from "@/components/queue/token-display";
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

// Whole-number percentage, 0 when there is nothing to divide by.
function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

async function Dashboard() {
  const context = await requireStaffPage(RECEPTION_ROLES);
  const view = await getDashboardView(context.clinic.id);
  const now = Date.parse(view.generatedAt);
  const card = view.queueCard;
  const liveHref = card
    ? `/receptionist/queue?queue=${card.queueId}`
    : "/receptionist/queue";

  return (
    <>
      <AutoRefresh seconds={30} />
      <PageHeader
        title="Dashboard"
        breadcrumbs={[
          { label: "Reception", href: "/receptionist" },
          { label: "Dashboard" },
        ]}
        status={
          card ? <QueueStatusPill status={card.status} /> : "No queues today"
        }
        actions={
          <Link
            href={liveHref}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-9 rounded-btn",
            )}
          >
            <ListOrderedIcon aria-hidden />
            Live queue
          </Link>
        }
      />

      <div className="flex flex-col gap-5">
        <KpiRow view={view} />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <FlowCard view={view} />
          <NowServingCard view={view} now={now} liveHref={liveHref} />
        </div>

        <QueueTrends view={view} />

        <RecentActivity activity={view.recentActivity} />
      </div>
    </>
  );
}

function KpiRow({ view }: { view: DashboardView }) {
  const { kpis, waitTargetMinutes: target } = view;
  const diff = kpis.waitingNow - kpis.waitingLastHour;
  const average = kpis.averageWaitMinutes;
  // Green within three quarters of the target, amber close to it, red over.
  const waitTone: Tone =
    average === null || average <= target * 0.75
      ? "green"
      : average <= target
        ? "amber"
        : "red";

  return (
    <section
      aria-label="Today at a glance"
      className="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 xl:grid-cols-4"
    >
      <StatCard
        icon={UsersIcon}
        value={kpis.waitingNow}
        label="Waiting now"
        footerLabel="vs last hour"
        footerValue={
          // Fewer people waiting is good news. Arrow and sign, never colour alone.
          <span
            className={cn(
              diff > 0
                ? "text-danger-text"
                : diff < 0
                  ? "text-status-done-foreground"
                  : "text-muted-foreground",
            )}
          >
            {diff > 0 ? `↗ +${diff}` : diff < 0 ? `↘ ${diff}` : "→ 0"}
          </span>
        }
        progress={percent(kpis.waitingNow, kpis.totalToday)}
        tone="brand"
      />
      <StatCard
        icon={UserCheckIcon}
        value={kpis.servedToday}
        label="Served today"
        footerLabel={`of ${kpis.totalToday} patients today`}
        footerValue={`${percent(kpis.servedToday, kpis.totalToday)}%`}
        progress={percent(kpis.servedToday, kpis.totalToday)}
        tone="green"
      />
      <StatCard
        icon={ClockIcon}
        value={average === null ? "—" : `${average}m`}
        label="Average wait"
        footerLabel={`Target ${target} min`}
        footerValue={
          average === null
            ? "No calls yet"
            : average > target
              ? "Over target"
              : "Within target"
        }
        progress={average === null ? 0 : percent(average, target)}
        tone={waitTone}
      />
      <StatCard
        icon={UserXIcon}
        value={kpis.noShowsToday}
        label="No-shows"
        footerLabel={`of ${kpis.calledToday} called`}
        footerValue={`${percent(kpis.noShowsToday, kpis.calledToday)}%`}
        progress={percent(kpis.noShowsToday, kpis.calledToday)}
        tone="red"
      />
    </section>
  );
}

// Hidden on phones: charts don't fit at 390px (docs/GUI_RULES.md §6).
function FlowCard({ view }: { view: DashboardView }) {
  const { kpis } = view;
  return (
    <DashboardCard
      title="Queue flow today"
      description="Patients joined and served each hour"
      className="hidden md:flex"
      footer={
        <StatStrip
          stats={[
            { label: "Waiting", value: kpis.waitingNow, tone: "brand" },
            { label: "Served", value: kpis.servedToday, tone: "green" },
            { label: "Skipped", value: kpis.noShowsToday, tone: "red" },
            {
              label: "Average wait",
              value:
                kpis.averageWaitMinutes === null
                  ? "—"
                  : `${kpis.averageWaitMinutes} min`,
              tone: "amber",
            },
          ]}
        />
      }
    >
      <QueueFlowChart data={view.flow} />
    </DashboardCard>
  );
}

function NowServingCard({
  view,
  now,
  liveHref,
}: {
  view: DashboardView;
  now: number;
  liveHref: string;
}) {
  const card = view.queueCard;
  let list: ReactNode;
  if (!card) {
    list = (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No queues are open today. Queues open with the clinic&apos;s hours.
      </p>
    );
  } else if (card.upNext.length === 0) {
    list = (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No one is waiting.
      </p>
    );
  } else {
    list = card.upNext.map((token, index) => {
      const waited = minutesSince(token.joinedAt, now);
      const overTarget = waited > view.waitTargetMinutes;
      return (
        <ListRow
          key={token.id}
          href={`/receptionist/tokens/${token.id}`}
          leading={
            <TokenBadge
              label={token.tokenLabel}
              tone={index === 0 ? "brand" : "muted"}
            />
          }
          title={displayName(token.patientName)}
          subtitle={
            index === 0 ? `${token.serviceName} · next up` : token.serviceName
          }
          trailing={
            <span className={cn(overTarget && "text-danger-text")}>
              {waited}m
            </span>
          }
          trailingSub={overTarget ? "over target" : "waited"}
        />
      );
    });
  }

  return (
    <HighlightCard
      value={card?.nowServing?.tokenLabel ?? "—"}
      label={card ? `Now serving · ${card.serviceName}` : "Now serving"}
      badge={card ? `${card.waitingCount} waiting` : undefined}
      series={view.flow.map((point) => point.waiting)}
      footer={{ href: liveHref, label: "Open live queue" }}
    >
      {list}
    </HighlightCard>
  );
}

// Palette tones for the sparklines, in order.
const TREND_TONES: Tone[] = ["brand", "tan", "rose", "green"];
// Literal class names so Tailwind finds them.
const TREND_COLUMNS = [
  "",
  "",
  "sm:grid-cols-2",
  "sm:grid-cols-2 xl:grid-cols-3",
  "sm:grid-cols-2 xl:grid-cols-4",
];

// One small card per queue today: served out of everyone today, a sparkline
// of consultations finished per hour, and how many are still waiting.
function QueueTrends({ view }: { view: DashboardView }) {
  const queues = view.queues.slice(0, 4);
  if (queues.length === 0) return null;
  return (
    <section
      aria-label="Queues today"
      className={cn("grid gap-5", TREND_COLUMNS[queues.length])}
    >
      {queues.map((queue, index) => (
        <SparkCard
          key={queue.queueId}
          icon={ClipboardListIcon}
          title={queue.serviceName}
          subtitle={`Tokens ${queue.tokenPrefix} · ${QUEUE_STATUS_DISPLAY[queue.status].label}`}
          value={`${queue.served}/${queue.total}`}
          series={queue.servedByHour}
          tone={TREND_TONES[index % TREND_TONES.length]}
          trend={{ label: `${queue.waiting} waiting`, caption: "served today" }}
        />
      ))}
    </section>
  );
}

const ACTIVITY_STYLE: Record<
  ActivityKind,
  { icon: LucideIcon; className: string }
> = {
  joined: { icon: UserPlusIcon, className: "bg-brand-tint text-brand" },
  walkIn: { icon: UserPlusIcon, className: "bg-brand-tint text-brand" },
  called: { icon: PhoneCallIcon, className: "bg-brand-tint text-brand" },
  recalled: { icon: PhoneCallIcon, className: "bg-brand-tint text-brand" },
  skipped: {
    icon: UserXIcon,
    className: "bg-status-miss text-status-miss-foreground",
  },
  requeued: { icon: RotateCcwIcon, className: "bg-brand-tint text-brand" },
  cancelled: {
    icon: XIcon,
    className: "bg-status-off text-status-off-foreground",
  },
  started: { icon: StethoscopeIcon, className: "bg-brand text-white" },
  completed: {
    icon: CircleCheckIcon,
    className: "bg-status-done text-status-done-foreground",
  },
  paused: {
    icon: PauseIcon,
    className: "bg-status-wait text-status-wait-foreground",
  },
  resumed: {
    icon: PlayIcon,
    className: "bg-status-done text-status-done-foreground",
  },
  closed: {
    icon: XIcon,
    className: "bg-status-off text-status-off-foreground",
  },
  other: { icon: ClockIcon, className: "bg-muted text-muted-foreground" },
};

function RecentActivity({
  activity,
}: {
  activity: DashboardView["recentActivity"];
}) {
  return (
    <DashboardCard
      id="activity"
      title="Recent activity"
      description="Calls, walk-ins and no-shows in the last 24 hours"
      bodyClassName="px-5 py-1"
    >
      {activity.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nothing yet today. Calls, walk-ins and no-shows will show here.
        </p>
      ) : (
        <ul className="grid divide-y divide-divider lg:grid-cols-2 lg:gap-x-8 lg:divide-y-0">
          {activity.map((item) => {
            const style = ACTIVITY_STYLE[item.kind];
            return (
              <li
                key={item.id}
                className="flex items-center gap-3 py-3 lg:border-b lg:border-divider"
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full",
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
    </DashboardCard>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-5">
      <Skeleton className="h-14 rounded-none" />
      <div className="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-card" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Skeleton className="hidden h-96 rounded-card md:block" />
        <Skeleton className="h-96 rounded-card" />
      </div>
      <Skeleton className="h-64 rounded-card" />
      <span className="sr-only">Loading the dashboard…</span>
    </div>
  );
}
