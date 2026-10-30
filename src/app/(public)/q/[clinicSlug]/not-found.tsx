import { messages } from "@/components/patient/messages";
import { NotFoundCard } from "@/components/patient/not-found-card";

// Unknown clinic slug, or a join link for a queue the clinic doesn't have today.
export default function ClinicNotFound() {
  return (
    <NotFoundCard
      title={messages.clinic.notFoundTitle}
      body={messages.clinic.notFoundBody}
    />
  );
}
