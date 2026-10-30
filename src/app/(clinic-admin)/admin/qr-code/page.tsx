import Link from "next/link";
import { Suspense } from "react";
import { AdminSection } from "@/components/admin/admin-ui";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import { CopyLink, QrDownloads } from "@/components/admin/qr-actions";
import { PageHeader } from "@/components/layout/page-header";
import { requireStaffPage } from "@/components/layout/staff-session";
import { buttonVariants } from "@/components/ui/button";
import { createClinicQrCode } from "@/features/clinics/qr";
import { cn } from "@/lib/utils";

export default function AdminQrCodePage() {
  return (
    <Suspense fallback={<AdminPageSkeleton label="Loading the QR code…" />}>
      <QrCode />
    </Suspense>
  );
}

async function QrCode() {
  const context = await requireStaffPage(["CLINIC_ADMIN"]);
  const qr = await createClinicQrCode(context.clinic.slug);

  return (
    <>
      <PageHeader
        title="QR code"
        status="Permanent: it never changes, so print it once."
        breadcrumbs={[{ label: "Clinic setup" }, { label: "QR code" }]}
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <AdminSection title="Preview">
          <div
            role="img"
            aria-label={`QR code for ${qr.url}`}
            className="mx-auto w-full max-w-[280px] rounded-btn border border-border bg-white p-2 [&_svg]:h-auto [&_svg]:w-full"
            // SVG generated on the server by the qrcode library from our own URL.
            dangerouslySetInnerHTML={{ __html: qr.svg }}
          />
        </AdminSection>
        <div className="flex flex-col gap-5">
          <AdminSection
            title="Clinic page link"
            description="Scanning the code opens this page. Patients choose a service there and join; scanning alone never creates a token."
          >
            <CopyLink url={qr.url} />
          </AdminSection>
          <AdminSection
            title="Download or print"
            description="PNG for messages and websites, SVG for print shops."
          >
            <div className="flex flex-col gap-3">
              <QrDownloads
                slug={context.clinic.slug}
                svg={qr.svg}
                pngDataUrl={qr.pngDataUrl}
              />
              <div>
                <Link
                  href="/admin/qr-code/poster"
                  className={cn(
                    buttonVariants(),
                    "h-10 rounded-btn px-5 font-semibold",
                  )}
                >
                  Open printable poster
                </Link>
              </div>
            </div>
          </AdminSection>
        </div>
      </div>
    </>
  );
}
