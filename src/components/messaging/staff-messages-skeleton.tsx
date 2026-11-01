import { Skeleton } from "@/components/ui/skeleton";

// Loading state for the staff Messages pages: header strip, inbox and chat.
export function StaffMessagesSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-5">
      <Skeleton className="-mx-4 -mt-4 h-14 rounded-none md:-mx-6 md:-mt-6 md:h-16" />
      <div className="grid gap-5 md:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)] lg:grid-cols-[22rem_minmax(0,1fr)]">
        <Skeleton className="h-[28rem] rounded-card" />
        <Skeleton className="hidden h-[28rem] rounded-card md:block" />
      </div>
      <span className="sr-only">Loading messages…</span>
    </div>
  );
}
