import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <AuthShell
      title="Page not found"
      description="This page doesn't exist or has moved. If you scanned a clinic QR code, scan it again."
    >
      <Link
        href="/"
        className={buttonVariants({
          variant: "outline",
          className: "h-11 w-full rounded-btn",
        })}
      >
        Go to the home page
      </Link>
    </AuthShell>
  );
}
