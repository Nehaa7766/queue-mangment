import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClinicLanding } from "@/components/patient/clinic-landing";
import { getPublicClinicView } from "@/features/queue/queries";

export const metadata: Metadata = {
  title: "Join the queue · QueueCare",
};

// The page the clinic's QR code opens. Viewing it never creates a token.
export default async function ClinicPage({
  params,
}: PageProps<"/q/[clinicSlug]">) {
  const { clinicSlug } = await params;
  const clinic = await getPublicClinicView(clinicSlug);
  if (!clinic) {
    notFound();
  }
  return <ClinicLanding clinic={clinic} />;
}
