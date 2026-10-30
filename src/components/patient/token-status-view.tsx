import type { ReactNode } from "react";
import { PatientDoctorNoticeBanner } from "@/components/doctor/doctor-notice";
import type { PublicTokenView } from "@/features/queue/contracts";
import { cn } from "@/lib/utils";
import { formatEta, formatUpdatedAgo } from "./format";
import { messages } from "./messages";
import { PatientStat } from "./patient-page";
import { TokenStatusPill } from "./status-pill";
import { TicketHero } from "./ticket-hero";

const t = messages.token;

function StatusMessage({ token }: { token: PublicTokenView }) {
  switch (token.status) {
    case "WAITING":
      return <WaitingMessage token={token} />;
    case "CALLED":
      return (
        <div className="flex flex-col gap-1 rounded-card border border-tone-amber/40 bg-status-wait p-4 text-status-wait-foreground">
          <p className="font-display text-2xl font-extrabold motion-safe:animate-pulse">
            {t.calledTitle}
          </p>
          <p className="text-base font-medium">{t.calledBody}</p>
        </div>
      );
    case "IN_SERVICE":
      return <Message title={t.inServiceTitle} body={t.inServiceBody} />;
    case "COMPLETED":
      return (
        <Message
          title={t.completedTitle}
          body={t.completedBody(token.clinicName)}
        />
      );
    case "SKIPPED":
      return <Message title={t.skippedTitle} body={t.skippedBody} />;
    case "CANCELLED":
      return <Message title={t.cancelledTitle} body={t.cancelledBody} />;
  }
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="font-display text-xl font-bold">{title}</p>
      <p className="text-base text-muted-foreground">{body}</p>
    </div>
  );
}

function WaitingMessage({ token }: { token: PublicTokenView }) {
  const ahead = token.peopleAhead ?? 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="font-display text-xl font-bold">
          {ahead === 0 ? t.nextTitle : t.waitingTitle}
        </p>
        <p className="text-base text-muted-foreground">
          {ahead === 0 ? t.nextBody : t.peopleAhead(ahead)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <PatientStat label={t.aheadLabel} value={ahead} />
        {token.estimate && (
          <PatientStat
            label={t.estimateLabel}
            value={formatEta(token.estimate)}
            note={token.estimate.isRough ? t.roughEstimate : undefined}
          />
        )}
      </div>
      {token.estimate && (
        <p className="text-sm text-muted-foreground">{t.estimateNote}</p>
      )}
    </div>
  );
}

function QueueBanner({ token }: { token: PublicTokenView }) {
  if (token.status !== "WAITING" || token.queueStatus === "OPEN") {
    return null;
  }
  return (
    <p className="rounded-card border border-border bg-status-off p-4 text-base text-status-off-foreground">
      {token.queueStatus === "PAUSED" ? t.pausedBanner : t.closedBanner}
    </p>
  );
}

const LIVE_STATUSES = new Set(["WAITING", "CALLED", "SKIPPED"]);

// What the patient sees for their token. Pure: the live wrapper supplies
// fresh data and the current time.
export function TokenStatusView({
  token,
  now,
  refreshFailed = false,
  actions,
}: {
  token: PublicTokenView;
  now: number;
  refreshFailed?: boolean;
  actions?: ReactNode;
}) {
  const isLive = LIVE_STATUSES.has(token.status);
  return (
    <TicketHero
      tokenLabel={token.tokenLabel}
      serviceName={token.serviceName}
      clinicName={token.clinicName}
    >
      <div aria-live="polite" className="flex flex-col gap-4">
        <TokenStatusPill status={token.status} />
        <QueueBanner token={token} />
        {token.status === "WAITING" && (
          <PatientDoctorNoticeBanner notice={token.doctorNotice} />
        )}
        <StatusMessage token={token} />
      </div>

      {isLive && (
        <p
          className={cn(
            "text-sm",
            refreshFailed ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {refreshFailed
            ? t.refreshFailed
            : `${formatUpdatedAgo(token.updatedAt, now)} · ${t.keepPageOpen}`}
        </p>
      )}

      {actions}
    </TicketHero>
  );
}
