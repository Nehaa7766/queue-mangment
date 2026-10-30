import type { Metadata } from "next";
import { Suspense } from "react";
import { ROLE_LABELS } from "@/components/layout/staff-nav";
import { SearchForm, firstParam } from "@/components/platform/filter-chips";
import { UserStatusPill, formatDate } from "@/components/platform/pills";
import {
  PlatformPageHeader,
  PlatformPageSkeleton,
} from "@/components/platform/platform-shell";
import { requirePlatformPage } from "@/components/platform/platform-session";
import { EmptyState } from "@/components/platform/section-card";
import { UserStatusButton } from "@/components/platform/user-status-button";
import { listUsers } from "@/features/platform/users";

export const metadata: Metadata = { title: "Users · QueueCare" };

type SearchParams = PageProps<"/super-admin/users">["searchParams"];

export default function UsersPage({
  searchParams,
}: PageProps<"/super-admin/users">) {
  return (
    <Suspense fallback={<PlatformPageSkeleton />}>
      <Users searchParams={searchParams} />
    </Suspense>
  );
}

async function Users({ searchParams }: { searchParams: SearchParams }) {
  const admin = await requirePlatformPage();
  const search =
    firstParam((await searchParams).q)
      ?.trim()
      .slice(0, 80) || undefined;
  const users = await listUsers({ search });

  return (
    <>
      <PlatformPageHeader
        title="Users"
        description="Staff and platform accounts. Deactivating signs a user out everywhere."
      />
      <div className="mb-4">
        <SearchForm
          action="/super-admin/users"
          label="Search users"
          placeholder="Name or email"
          defaultValue={search}
        />
      </div>

      {users.length === 0 ? (
        <EmptyState>No users match this search.</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y divide-divider rounded-card border border-border bg-card">
          {users.map((user) => (
            <li
              key={user.id}
              className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold">
                  {user.name}
                  {user.platformRole === "SUPER_ADMIN" && (
                    <span className="ml-2 rounded-full bg-slate-tint px-2 py-0.5 text-xs font-semibold text-slate">
                      Super admin
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user.email} · joined {formatDate(user.createdAt)}
                </p>
                {user.memberships.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {user.memberships
                      .map((m) => `${ROLE_LABELS[m.role]}, ${m.clinicName}`)
                      .join(" · ")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <UserStatusPill status={user.status} />
                <UserStatusButton
                  userId={user.id}
                  name={user.name}
                  status={user.status}
                  isSelf={user.id === admin.userId}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
