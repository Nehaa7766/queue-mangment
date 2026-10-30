import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { PageHeader } from "@/components/layout/page-header";
import {
  RECEPTION_ROLES,
  requireStaffPage,
} from "@/components/layout/staff-session";
import { TokenStatusPill } from "@/components/queue/status-pill";
import {
  displayName,
  formatClinicTime,
} from "@/components/queue/token-display";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getTokenDetails } from "@/features/analytics/queries";
import { cn } from "@/lib/utils";

type Params = PageProps<"/receptionist/tokens/[tokenId]">["params"];

export default function TokenDetailsPage({
  params,
}: PageProps<"/receptionist/tokens/[tokenId]">) {
  return (
    <Suspense fallback={<TokenSkeleton />}>
      <TokenDetails params={params} />
    </Suspense>
  );
}

async function TokenDetails({ params }: { params: Params }) {
  const context = await requireStaffPage(RECEPTION_ROLES);
  const { tokenId } = await params;
  if (!z.uuid().safeParse(tokenId).success) notFound();
  const details = await getTokenDetails(tokenId);
  if (!details) notFound();

  const { token, timeline } = details;
  const timeZone = context.clinic.timezone;
  const time = (iso: string | null) =>
    iso ? formatClinicTime(iso, timeZone) : "—";

  return (
    <>
      <PageHeader
        title={`Token ${token.tokenLabel}`}
        breadcrumbs={[
          { label: "Reception", href: "/receptionist" },
          { label: "Queue history", href: "/receptionist/history" },
          { label: `Token ${token.tokenLabel}` },
        ]}
        status={`${token.serviceName} · ${token.queueDate}`}
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section
          aria-labelledby="token-summary"
          className="flex flex-col self-start overflow-hidden rounded-card border border-border bg-card shadow-card sm:flex-row"
        >
          <div className="flex flex-col justify-center gap-1 border-b-2 border-dashed border-background bg-brand px-6 py-5 text-white sm:w-44 sm:border-r-2 sm:border-b-0">
            <span className="text-[11px] font-semibold tracking-[0.08em] text-brand-muted uppercase">
              Token
            </span>
            <span className="font-display text-5xl font-extrabold tabular-nums">
              {token.tokenLabel}
            </span>
          </div>
          <div className="flex flex-1 flex-col gap-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="token-summary" className="font-semibold">
                  {displayName(token.patientName)}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {token.serviceName}
                </p>
              </div>
              <TokenStatusPill status={token.status} />
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-muted-foreground">Joined</dt>
                <dd className="font-semibold tabular-nums">
                  {time(token.joinedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Called</dt>
                <dd className="font-semibold tabular-nums">
                  {time(token.calledAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">With doctor</dt>
                <dd className="font-semibold tabular-nums">
                  {time(token.serviceStartedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Done</dt>
                <dd className="font-semibold tabular-nums">
                  {time(token.completedAt)}
                </dd>
              </div>
            </dl>
            <p className="text-sm text-muted-foreground">
              {token.assignedDoctorName
                ? `Doctor: ${token.assignedDoctorName}`
                : "No doctor assigned yet"}
              {token.recallCount > 0 && ` · recalled ${token.recallCount}×`}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/receptionist/queue"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "h-10 rounded-btn",
                )}
              >
                Back to live queue
              </Link>
              <Link
                href="/receptionist/history"
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "h-10 rounded-btn",
                )}
              >
                Queue history
              </Link>
            </div>
          </div>
        </section>

        <DashboardCard
          title="Timeline"
          description="Every recorded step, oldest first"
        >
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No recorded actions for this token.
            </p>
          ) : (
            <ol className="flex flex-col">
              {timeline.map((event, index) => (
                <li key={event.id} className="flex gap-3">
                  <time
                    dateTime={event.createdAt}
                    className="w-12 shrink-0 pt-0.5 text-xs text-muted-foreground tabular-nums"
                  >
                    {event.time}
                  </time>
                  {/* Dot and connecting line, like a vertical timeline. */}
                  <span aria-hidden className="flex flex-col items-center">
                    <span className="mt-1 size-2.5 shrink-0 rounded-full bg-brand" />
                    {index < timeline.length - 1 && (
                      <span className="w-px flex-1 bg-border" />
                    )}
                  </span>
                  <div className="pb-4">
                    <p className="text-sm font-semibold">{event.title}</p>
                    {event.actorName && (
                      <p className="text-xs text-muted-foreground">
                        {event.actorName}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </DashboardCard>
      </div>
    </>
  );
}

function TokenSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-5">
      <Skeleton className="h-14 rounded-none" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Skeleton className="h-56 rounded-card" />
        <Skeleton className="h-56 rounded-card" />
      </div>
      <span className="sr-only">Loading token…</span>
    </div>
  );
}
