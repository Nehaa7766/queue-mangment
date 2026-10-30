import Link from "next/link";
import { Suspense } from "react";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import { PrintButton } from "@/components/admin/qr-actions";
import { BrandMark, BrandName } from "@/components/layout/brand-mark";
import { PageHeader } from "@/components/layout/page-header";
import { requireStaffPage } from "@/components/layout/staff-session";
import { buttonVariants } from "@/components/ui/button";
import { createClinicQrCode } from "@/features/clinics/qr";
import { cn } from "@/lib/utils";

// Printing shows only the poster, not the staff shell around it, and keeps
// its brand-coloured bands (browsers drop background colours by default).
const PRINT_ONLY_POSTER = `
@media print {
  @page { size: A4 portrait; margin: 12mm; }
  body * { visibility: hidden; }
  #qr-poster, #qr-poster * { visibility: visible; }
  #qr-poster {
    position: absolute;
    inset: 0;
    box-shadow: none;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
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
      <PageHeader
        title="Printable poster"
        breadcrumbs={[
          { label: "Clinic setup" },
          { label: "QR code", href: "/admin/qr-code" },
          { label: "Poster" },
        ]}
        actions={
          <>
            <Link
              href="/admin/qr-code"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-9 rounded-btn",
              )}
            >
              Back
            </Link>
            <PrintButton />
          </>
        }
      />

      <article
        id="qr-poster"
        className="mx-auto flex w-full max-w-[560px] flex-col overflow-hidden rounded-card border border-border bg-white text-center text-foreground shadow-card"
      >
        <header className="flex items-center justify-center gap-3 bg-brand px-6 py-6 text-white">
          <BrandMark className="size-11 bg-white text-brand" />
          <span className="font-display text-2xl font-bold">
            {context.clinic.name}
          </span>
        </header>

        <div className="flex flex-col items-center gap-6 px-6 py-8">
          <h2 className="font-display text-[34px] leading-tight font-extrabold">
            Scan to join the queue
          </h2>
          <div
            role="img"
            aria-label={`QR code for ${qr.url}`}
            className="w-full max-w-[320px] rounded-card border-4 border-brand p-3 [&_svg]:h-auto [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: qr.svg }}
          />
          <ol className="flex flex-col gap-2.5 text-left text-base">
            {[
              "Point your phone camera at the code.",
              "Choose your service and tap Join queue.",
              "Keep the page open to see your turn.",
            ].map((step, index) => (
              <li key={step} className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white"
                >
                  {index + 1}
                </span>
                <span>
                  <span className="sr-only">{index + 1}. </span>
                  {step}
                </span>
              </li>
            ))}
          </ol>
          <p className="text-sm" lang="hi">
            कतार में शामिल होने के लिए स्कैन करें
          </p>
        </div>

        <footer className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-t border-border bg-brand-tint px-6 py-4 text-sm text-brand">
          <span className="font-semibold">No app or login needed</span>
          <span aria-hidden>·</span>
          <span>{qr.url.replace(/^https?:\/\//, "")}</span>
          <span aria-hidden>·</span>
          <BrandName className="text-sm text-foreground" />
        </footer>
      </article>
    </>
  );
}
