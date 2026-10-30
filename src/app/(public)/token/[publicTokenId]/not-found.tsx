import { messages } from "@/components/patient/messages";
import { NotFoundCard } from "@/components/patient/not-found-card";

export default function TokenNotFound() {
  return (
    <NotFoundCard
      title={messages.token.notFoundTitle}
      body={messages.token.notFoundBody}
    />
  );
}
