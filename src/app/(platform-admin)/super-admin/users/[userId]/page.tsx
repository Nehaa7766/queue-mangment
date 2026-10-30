import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ROLE_LABELS } from "@/components/layout/staff-nav";
import { DeleteButton } from "@/components/platform/delete-button";
import { RowActions } from "@/components/platform/icon-action";
import {
  UserStatusPill,
  formatDate,
  formatDateTime,
} from "@/components/platform/pills";
import { PlatformPageSkeleton } from "@/components/platform/platform-shell";
import { requirePlatformPage } from "@/components/platform/platform-session";
import {
  DetailList,
  DetailRow,
  EmptyState,
  SectionCard,
} from "@/components/platform/section-card";
import {
  EditUserButton,
  SendResetButton,
} from "@/components/platform/user-forms";
import { UserStatusButton } from "@/components/platform/user-status-button";
import { getUserDetail, type UserDetail } from "@/features/platform/users";

export const metadata: Metadata = { title: "User · QueueCare" };

type Params = PageProps<"/super-admin/users/[userId]">["params"];

const LINK = "font-medium text-brand underline-offset-4 hover:underline";

export default function UserDetailPage({
  params,
}: PageProps<"/super-admin/users/[userId]">) {
  return (
    <Suspense fallback={<PlatformPageSkeleton />}>
      <UserDetailView params={params} />
    </Suspense>
  );
}

async function UserDetailView({ params }: { params: Params }) {
  await requirePlatformPage();
  const user = await getUserDetail((await params).userId);
  if (!user) notFound();

  return (
    <>
      <PageHeader
        title={user.name}
        breadcrumbs={[
          { label: "Users", href: "/super-admin/users" },
          { label: user.name },
        ]}
        status={<UserStatusPill status={user.status} />}
        actions={user.isSuperAdmin ? undefined : <UserActions user={user} />}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Profile" bodyClassName="py-2">
          <DetailList>
            <DetailRow label="Email">{user.email}</DetailRow>
            <DetailRow label="Account">
              {user.isSuperAdmin ? "Super admin" : "Clinic user"}
            </DetailRow>
            <DetailRow label="Status">
              <UserStatusPill status={user.status} />
            </DetailRow>
            <DetailRow label="Joined">{formatDate(user.createdAt)}</DetailRow>
            <DetailRow label="Last sign-in">
              {user.lastSignInAt ? formatDateTime(user.lastSignInAt) : "—"}
            </DetailRow>
          </DetailList>
        </SectionCard>

        <SectionCard
          title="Clinic access"
          description={`${user.memberships.length} ${user.memberships.length === 1 ? "clinic" : "clinics"}`}
          bodyClassName="py-1"
        >
          {user.memberships.length === 0 ? (
            <EmptyState className="my-3">No clinic access.</EmptyState>
          ) : (
            <ul className="flex flex-col divide-y divide-divider">
              {user.memberships.map((membership) => (
                <li
                  key={`${membership.clinicId}-${membership.role}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                >
                  <span className="min-w-0">
                    <Link
                      href={`/super-admin/clinics/${membership.clinicId}`}
                      className={LINK}
                    >
                      {membership.clinicName}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      Since {formatDate(membership.since)}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    {ROLE_LABELS[membership.role]}
                    {membership.status === "ACTIVE"
                      ? ""
                      : ` · ${membership.status.toLowerCase()}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Recent actions"
          description="The latest things this person did on QueueCare."
          className="lg:col-span-2"
          bodyClassName="py-1"
        >
          {user.recentActions.length === 0 ? (
            <EmptyState className="my-3">Nothing recorded yet.</EmptyState>
          ) : (
            <ul className="flex flex-col divide-y divide-divider">
              {user.recentActions.map((action) => (
                <li
                  key={action.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 text-sm"
                >
                  <span className="min-w-0">
                    <span className="font-medium">{action.label}</span>
                    {action.context && (
                      <>
                        {" · "}
                        {action.href ? (
                          <Link href={action.href} className={LINK}>
                            {action.context}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">
                            {action.context}
                          </span>
                        )}
                      </>
                    )}
                  </span>
                  <span className="text-xs whitespace-nowrap text-muted-foreground">
                    {formatDateTime(action.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  );
}

// The same icon actions as the user's row on the Users page.
function UserActions({ user }: { user: UserDetail }) {
  return (
    <RowActions>
      <EditUserButton user={user} />
      {user.status === "ACTIVE" && (
        <SendResetButton userId={user.id} userName={user.name} />
      )}
      <UserStatusButton
        userId={user.id}
        name={user.name}
        status={user.status}
        isSelf={user.isSelf}
      />
      <DeleteButton
        compact
        url={`/api/platform/users/${user.id}`}
        itemName={user.name}
        description="This permanently removes the account and its sign-in. It can't be undone."
        blockedReason={user.deleteBlocker}
        successMessage={`${user.name} was deleted.`}
        redirectTo="/super-admin/users"
      />
    </RowActions>
  );
}
