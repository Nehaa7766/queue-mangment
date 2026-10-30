import { LifeBuoyIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Bottom of the clinic staff sidebar: the way into support tickets.
export function HelpCard() {
  return (
    <div className="rounded-card border border-border bg-background p-4 text-center">
      <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-brand-tint text-brand">
        <LifeBuoyIcon className="size-5" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-semibold">Need help?</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Questions or a problem with QueueCare? Tell our team.
      </p>
      <Link
        href="/support"
        className={cn(buttonVariants({ size: "sm" }), "mt-3 h-9 w-full")}
      >
        Contact support
      </Link>
    </div>
  );
}
