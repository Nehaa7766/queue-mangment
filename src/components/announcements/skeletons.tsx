import { Skeleton } from "@/components/ui/skeleton";

// Loading states in the shape of the pages: the header strip while the
// session loads, then card outlines while the data does.

function HeaderSkeleton() {
  return (
    <div className="-mx-4 -mt-4 mb-5 flex items-center gap-3 border-b border-border bg-card px-4 py-4 md:-mx-6 md:-mt-6 md:mb-6 md:px-6">
      <Skeleton className="h-6 w-44" />
      <Skeleton className="hidden h-4 w-40 sm:block" />
    </div>
  );
}

export function AnnouncementListSkeleton() {
  return (
    <div
      aria-busy="true"
      className="overflow-hidden rounded-card border border-border bg-card shadow-card"
    >
      <div className="border-b border-divider px-5 py-4">
        <Skeleton className="h-5 w-48" />
      </div>
      <div className="divide-y divide-divider">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex flex-col gap-3 px-5 py-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-1.5 w-40" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading announcements…</span>
    </div>
  );
}

export function AnnouncementDetailBodySkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-5 md:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-card" />
        ))}
      </div>
      <Skeleton className="h-40 rounded-card" />
      <Skeleton className="h-72 rounded-card" />
      <span className="sr-only">Loading announcement…</span>
    </div>
  );
}

export function AnnouncementsPageSkeleton() {
  return (
    <div>
      <HeaderSkeleton />
      <AnnouncementListSkeleton />
    </div>
  );
}

export function AnnouncementDetailPageSkeleton() {
  return (
    <div>
      <HeaderSkeleton />
      <AnnouncementDetailBodySkeleton />
    </div>
  );
}
