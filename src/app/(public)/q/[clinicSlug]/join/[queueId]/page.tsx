import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JoinQueueForm } from "@/components/patient/join-queue-form";
import { getPublicClinicView } from "@/features/queue/queries";

export const metadata: Metadata = {
  title: "Confirm and join · QueueCare",
};

// Confirmation step: a token is only created when the patient taps Join queue.
export default async function JoinPage({
  params,
}: PageProps<"/q/[clinicSlug]/join/[queueId]">) {
  const { clinicSlug, queueId } = await params;
  const clinic = await getPublicClinicView(clinicSlug);
  const service = clinic?.services.find(
    (candidate) => candidate.queue?.queueId === queueId,
  );
  if (!clinic || !service?.queue) {
    notFound();
  }

  return (
    <JoinQueueForm
      clinicSlug={clinic.slug}
      clinicName={clinic.name}
      clinicOpen={clinic.isOpenNow}
      service={{ ...service, queue: service.queue }}
    />
  );
}
