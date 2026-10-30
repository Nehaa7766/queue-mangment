import Image from "next/image";
import { cn } from "@/lib/utils";
import bell from "./queuecare-bell.png";

// QueueCare logo mark (docs/GUI_RULES.md §1): the ringing bell supplied by
// the owner, used exactly as given. The picture has a white background, so it
// sits on a rounded white tile, which also reads well on mocha areas.
// The browser tab icon is the same bell, squared: src/app/icon.png.
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-btn bg-white",
        className,
      )}
    >
      {/* Explicit size and no optimisation: the file is tiny, and this also
          works where the import is a plain URL (tests). */}
      <Image
        src={bell}
        alt=""
        width={162}
        height={148}
        unoptimized
        className="size-full object-contain"
      />
    </span>
  );
}

// "QueueCare" wordmark, with "Care" in mocha. Reads as one word.
export function BrandName({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-display text-[17px] font-extrabold tracking-tight",
        className,
      )}
    >
      Queue<span className="text-brand">Care</span>
    </span>
  );
}
