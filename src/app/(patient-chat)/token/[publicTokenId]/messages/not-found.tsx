import { messages } from "@/components/patient/messages";
import { NotFoundCard } from "@/components/patient/not-found-card";
import { PatientBody } from "@/components/patient/patient-page";

export default function ChatTokenNotFound() {
  return (
    <PatientBody>
      <NotFoundCard
        title={messages.token.notFoundTitle}
        body={messages.token.notFoundBody}
      />
    </PatientBody>
  );
}
