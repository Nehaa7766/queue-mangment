import { EyeIcon, ShieldCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ROLE_LABELS } from "@/components/layout/staff-nav";
import { DataTable, HeaderRow, TD, TR } from "@/components/platform/data-table";
import { DeleteButton } from "@/components/platform/delete-button";
import {
  FilterChips,
  SearchForm,
  firstParam,
} from "@/components/platform/filter-chips";
import { IconLink, RowActions } from "@/components/platform/icon-action";
import { Pagination } from "@/components/platform/pagination";
import { UserStatusPill, formatDate } from "@/components/platform/pills";
import { PlatformPageSkeleton } from "@/components/platform/platform-shell";
import {
  requirePlatformPage,
  type PlatformUser,
} from "@/components/platform/platform-session";
import {
  EmptyState,
  ListCard,
  ListCount,
} from "@/components/platform/section-card";
import {
  AddAdminButton,
  EditUserButton,
  SendResetButton,
} from "@/components/platform/user-forms";
import { UserStatusButton } from "@/components/platform/user-status-button";
import { listClinicOptions } from "@/features/platform/clinics";
import { PAGE_SIZE, parsePage } from "@/features/platform/pagination";
import {
  USER_TAB_LABELS,
  USER_TABS,
  type UserTab,
} from "@/features/platform/schemas";
import { TAB_ROLES, listUsers, type UserRow } from "@/features/platform/users";
import type { UserStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Users · QueueCare" };

type SearchParams = PageProps<"/super-admin/users">["searchParams"];

const STATUS_PARAM: Record<string, UserStatus> = {
  active: "ACTIVE",
  inactive: "INACTIVE",
};

type Filters = { tab: UserTab; status?: string; q?: string; page?: number };

// Keeps the other filters when one changes. Without `page` it is page 1, so
// a new tab, filter or search starts at the top.
function usersHref(filters: Filters): string {
  const params = new URLSearchParams({ tab: filters.tab });
  if (filters.status) params.set("status", filters.status);
  if (filters.q) params.set("q", filters.q);
  if (filters.page && filters.page > 1)
    params.set("page", String(filters.page));
  return `/super-admin/users?${params.toString()}`;
}

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
  const me = await requirePlatformPage();
  const params = await searchParams;
  const tab =
    USER_TABS.find((value) => value === firstParam(params.tab)) ?? "admins";
  const statusParam = firstParam(params.status);
  const status = statusParam ? STATUS_PARAM[statusParam] : undefined;
  const q = firstParam(params.q)?.trim().slice(0, 80) || undefined;
  const filters: Filters = {
    tab,
    status: status ? statusParam : undefined,
    q,
  };
  const [result, clinics] = await Promise.all([
    listUsers({
      tab,
      search: q,
      status,
      page: parsePage(firstParam(params.page)),
      pageSize: PAGE_SIZE,
    }),
    listClinicOptions(),
  ]);
  const { rows, counts } = result;

  return (
    <>
      <PageHeader
        title="Users"
        breadcrumbs={[{ label: "Users" }]}
        status="You add clinic admins; each admin adds their own reception and doctors."
        actions={<AddAdminButton clinics={clinics} />}
      />
      <div className="flex flex-col gap-4">
        <SuperAdminLine me={me} />

        <nav
          aria-label="User lists"
          className="flex gap-6 border-b border-border"
        >
          {USER_TABS.map((value) => {
            const active = value === tab;
            return (
              <Link
                key={value}
                href={usersHref({ ...filters, tab: value })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex items-center gap-2 border-b-2 px-1 pb-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active
                    ? "border-brand font-semibold text-foreground"
                    : "border-transparent font-medium text-muted-foreground hover:text-foreground",
                )}
              >
                {USER_TAB_LABELS[value]}
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                    active
                      ? "bg-brand-tint text-brand"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {counts[value]}
                </span>
              </Link>
            );
          })}
        </nav>

        <ListCard
          toolbar={
            <>
              <FilterChips
                label="Filter by status"
                chips={[
                  {
                    label: "All",
                    href: usersHref({ ...filters, status: undefined }),
                    active: !status,
                  },
                  {
                    label: "Active",
                    href: usersHref({ ...filters, status: "active" }),
                    active: status === "ACTIVE",
                  },
                  {
                    label: "Deactivated",
                    href: usersHref({ ...filters, status: "inactive" }),
                    active: status === "INACTIVE",
                  },
                ]}
              />
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <ListCount
                  count={result.total}
                  one={tab === "admins" ? "admin" : "staff member"}
                  many={tab === "admins" ? "admins" : "staff members"}
                />
                <SearchForm
                  action="/super-admin/users"
                  label="Search users"
                  placeholder="Name or email"
                  defaultValue={q}
                  hidden={{ tab, status: filters.status }}
                />
              </div>
            </>
          }
        >
          {rows.length === 0 ? (
            <EmptyState className="m-5">
              {q || status
                ? "No one matches these filters."
                : tab === "admins"
                  ? "No clinic admins yet. Add one with “Add admin”."
                  : "No clinic staff yet. Clinic admins add their staff from their Staff page."}
            </EmptyState>
          ) : (
            <DataTable label={USER_TAB_LABELS[tab]} minWidth={860}>
              <HeaderRow
                columns={[
                  { label: tab === "admins" ? "Admin" : "Staff member" },
                  { label: tab === "admins" ? "Clinics" : "Role and clinic" },
                  { label: "Joined" },
                  { label: "Status" },
                  { label: "Actions", srOnly: true },
                ]}
              />
              <tbody>
                {rows.map((user) => (
                  <UserTableRow key={user.id} user={user} tab={tab} />
                ))}
              </tbody>
            </DataTable>
          )}
          <Pagination
            result={result}
            href={(page) => usersHref({ ...filters, page })}
          />
        </ListCard>
      </div>
    </>
  );
}

// The one global super admin, shown on its own rather than in a tab.
function SuperAdminLine({ me }: { me: PlatformUser }) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-border bg-card px-5 py-3.5 text-sm shadow-card">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand">
        <ShieldCheckIcon className="size-4" aria-hidden />
      </span>
      <p className="min-w-0">
        Signed in as <span className="font-semibold">{me.name}</span>{" "}
        <span className="text-muted-foreground">({me.email})</span> · Super
        admin
        <span className="block text-xs text-muted-foreground">
          QueueCare has one super admin. This account can&apos;t be deactivated
          or deleted.
        </span>
      </p>
    </div>
  );
}

// Clinics and roles relevant to the open tab.
function accessText(user: UserRow, tab: UserTab): string {
  const relevant = user.memberships.filter((m) =>
    TAB_ROLES[tab].includes(m.role),
  );
  if (relevant.length === 0) return "No clinic access";
  return relevant
    .map((m) => {
      const where =
        tab === "admins"
          ? m.clinicName
          : `${ROLE_LABELS[m.role]}, ${m.clinicName}`;
      return m.status === "ACTIVE" ? where : `${where} (access removed)`;
    })
    .join(" · ");
}

function UserTableRow({ user, tab }: { user: UserRow; tab: UserTab }) {
  return (
    <tr className={TR}>
      <td className={TD}>
        <p className="font-semibold">{user.name}</p>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
      </td>
      <td className={`${TD} text-muted-foreground`}>{accessText(user, tab)}</td>
      <td className={`${TD} whitespace-nowrap text-muted-foreground`}>
        {formatDate(user.createdAt)}
      </td>
      <td className={TD}>
        <UserStatusPill status={user.status} />
      </td>
      <td className={TD}>
        <RowActions>
          <IconLink
            href={`/super-admin/users/${user.id}`}
            label={`View ${user.name}`}
            tip="View"
          >
            <EyeIcon aria-hidden />
          </IconLink>
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
          />
        </RowActions>
      </td>
    </tr>
  );
}
