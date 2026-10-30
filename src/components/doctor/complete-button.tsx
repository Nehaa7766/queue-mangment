import { CircleCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StaffTokenView } from "@/features/queue/contracts";
import { cn } from "@/lib/utils";

// The one primary action during a consultation (brand fill, docs/GUI_RULES.md).
export function CompleteButton({
  token,
  pending,
  disabled,
  onComplete,
  className,
}: {
  token: Pick<StaffTokenView, "id" | "tokenLabel">;
  pending: boolean;
  disabled: boolean;
  onComplete: () => void;
  className?: string;
}) {
  return (
    <Button
      className={cn(
        "h-12 rounded-btn px-6 text-[15px] font-semibold sm:w-fit",
        className,
      )}
      disabled={disabled}
      onClick={onComplete}
    >
      <CircleCheckIcon />
      {pending ? "Completing…" : `Complete consultation`}
      <span className="sr-only"> for {token.tokenLabel}</span>
    </Button>
  );
}
