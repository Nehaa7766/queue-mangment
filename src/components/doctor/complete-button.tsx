import { CircleCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StaffTokenView } from "@/features/queue/contracts";

// The one primary action during a consultation (terracotta, docs/GUI_RULES.md).
export function CompleteButton({
  token,
  pending,
  disabled,
  onComplete,
}: {
  token: Pick<StaffTokenView, "id" | "tokenLabel">;
  pending: boolean;
  disabled: boolean;
  onComplete: () => void;
}) {
  return (
    <Button
      className="h-14 rounded-btn px-6 text-base font-semibold sm:h-12 sm:w-fit"
      disabled={disabled}
      onClick={onComplete}
    >
      <CircleCheckIcon />
      {pending ? "Completing…" : `Complete consultation`}
      <span className="sr-only"> for {token.tokenLabel}</span>
    </Button>
  );
}
