import { messages } from "@/components/patient/messages";
import { NotFoundCard } from "@/components/patient/not-found-card";
import { PatientBody } from "@/components/patient/patient-page";

// Unknown clinic slug, or a join link for a queue the clinic doesn't have today.
export default function ClinicNotFound() {
  return (
    <PatientBody>
      <NotFoundCard
        title={messages.clinic.notFoundTitle}
        body={messages.clinic.notFoundBody}
      />
    </PatientBody>
  );
}
