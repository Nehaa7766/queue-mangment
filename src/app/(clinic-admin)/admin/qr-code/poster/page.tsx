import Link from "next/link";
import { Suspense } from "react";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import { PrintButton } from "@/components/admin/qr-actions";
import { requireStaffPage } from "@/components/layout/staff-session";
import { buttonVariants } from "@/components/ui/button";
import { createClinicQrCode } from "@/features/clinics/qr";
import { cn } from "@/lib/utils";

// Printing shows only the poster, not the staff shell around it.
const PRINT_ONLY_POSTER = `
@media print {
  @page { size: A4 portrait; margin: 12mm; }
  body * { visibility: hidden; }
  #qr-poster, #qr-poster * { visibility: visible; }
  #qr-poster { position: absolute; inset: 0; border: 0; }
}`;

export default function QrPosterPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton label="Loading the poster…" />}>
      <Poster />
    </Suspense>
  );
}

async function Poster() {
  const context = await requireStaffPage(["CLINIC_ADMIN"]);
  const qr = await createClinicQrCode(context.clinic.slug);

  return (
    <>
      <style>{PRINT_ONLY_POSTER}</style>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-[22px] font-bold md:text-[26px]">
          Printable poster
        </h1>
        <div className="flex gap-2">
          <Link
            href="/admin/qr-code"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-10 rounded-btn",
            )}
          >
            Back
          </Link>
          <PrintButton />
        </div>
      </div>

      <article
        id="qr-poster"
        className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-6 rounded-card border border-border bg-white px-6 py-10 text-center text-charcoal"
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-10 items-center justify-center rounded-btn bg-slate font-display text-xl font-extrabold text-sand"
          >
            Q
          </span>
          <span className="font-display text-xl font-bold">
            {context.clinic.name}
          </span>
        </div>
        <h2 className="font-display text-[34px] leading-tight font-extrabold">
          Scan to join the queue
        </h2>
        <div
          role="img"
          aria-label={`QR code for ${qr.url}`}
          className="w-full max-w-[340px] [&_svg]:h-auto [&_svg]:w-full"
          dangerouslySetInnerHTML={{ __html: qr.svg }}
        />
        <ol className="flex flex-col gap-1.5 text-left text-base">
          <li>1. Point your phone camera at the code.</li>
          <li>2. Choose your service and tap Join queue.</li>
          <li>3. Keep the page open to see your turn.</li>
        </ol>
        <p className="text-sm text-muted-foreground">
          No app or login needed · {qr.url.replace(/^https?:\/\//, "")}
        </p>
        <p className="text-sm" lang="hi">
          कतार में शामिल होने के लिए स्कैन करें
        </p>
      </article>
    </>
  );
}
