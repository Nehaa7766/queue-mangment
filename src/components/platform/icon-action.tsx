"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import {
  useId,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Small square icon buttons for table rows, so each row's actions fit on one
// line. The accessible name says what and whom ("Edit Asha Admin"); the
// tooltip shows the short action name, or why it's unavailable.

export const ICON_ACTION_CLASS =
  "size-9 shrink-0 rounded-btn text-muted-foreground hover:text-foreground aria-disabled:cursor-not-allowed aria-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4";

const DANGER_CLASS =
  "hover:bg-status-miss hover:text-status-miss-foreground aria-disabled:hover:bg-transparent aria-disabled:hover:text-muted-foreground";

// A tooltip on a trigger element: an icon button, or a link styled as one.
export function WithTooltip({
  tip,
  children,
}: {
  tip: string;
  children: ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}

// An icon-only row action. It also works as the `render` element of a sheet
// or dialog trigger: the trigger's props and ref are passed straight through.
// With `blockedReason` it stays focusable and hoverable (so the reason can be
// read in the tooltip and by screen readers) but does nothing.
export function IconAction({
  icon: Icon,
  label,
  tip,
  blockedReason,
  danger = false,
  className,
  disabled,
  ...props
}: Omit<ComponentProps<typeof Button>, "children"> & {
  icon: LucideIcon;
  // Full accessible name, e.g. "Delete Asha Admin".
  label: string;
  // Short tooltip, e.g. "Delete".
  tip: string;
  blockedReason?: string | null;
  danger?: boolean;
}) {
  const reasonId = useId();
  const blocked = Boolean(blockedReason);
  return (
    <WithTooltip tip={blocked ? `${tip}: ${blockedReason}` : tip}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={label}
        aria-describedby={blocked ? reasonId : undefined}
        disabled={blocked || disabled}
        focusableWhenDisabled
        className={cn(ICON_ACTION_CLASS, danger && DANGER_CLASS, className)}
        {...props}
      >
        <Icon aria-hidden />
        {blocked && (
          <span id={reasonId} className="sr-only">
            {blockedReason}
          </span>
        )}
      </Button>
    </WithTooltip>
  );
}

// A link styled as an icon action, for row actions that open another page.
// The icon comes in as `children` so server pages can use it too.
export function IconLink({
  href,
  label,
  tip,
  children,
}: {
  href: string;
  label: string;
  tip: string;
  children: ReactNode;
}) {
  return (
    <WithTooltip tip={tip}>
      <Link
        href={href}
        aria-label={label}
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          ICON_ACTION_CLASS,
        )}
      >
        {children}
      </Link>
    </WithTooltip>
  );
}

// Lays out a row's icon actions on one line, right-aligned.
export function RowActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-nowrap items-center justify-end gap-0.5">
      {children}
    </div>
  );
}
