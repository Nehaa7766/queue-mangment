import Image from "next/image";
import { cn } from "@/lib/utils";

// A clinic's logo, or its first letter when none is uploaded.
export function ClinicAvatar({
  name,
  logoUrl,
  size = 36,
  className,
}: {
  name: string;
  logoUrl: string | null;
  size?: number;
  className?: string;
}) {
  const box = cn(
    "shrink-0 overflow-hidden rounded-btn border border-border bg-card",
    className,
  );
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        // Served from our own API with its own caching; no resizing needed.
        unoptimized
        className={cn(box, "object-contain")}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        box,
        "flex items-center justify-center border-transparent bg-brand-tint font-display font-bold text-brand",
      )}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
