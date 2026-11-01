import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { messages } from "@/components/patient/messages";
import { PatientBody, PatientStrip } from "@/components/patient/patient-page";
import {
  NewMessageBar,
  PatientChatDock,
  PatientMessagesButton,
  PatientMessagesCard,
  PatientMessagingProvider,
} from "@/components/patient/patient-messages";
import { TokenStatusLive } from "@/components/patient/token-status-live";
import { getPublicTokenView } from "@/features/queue/queries";

export const metadata: Metadata = {
  title: "Your token · QueueCare",
};

// First view is rendered on the server; the client component keeps it fresh.
// Phones: the token, then a Messages card that opens the full-screen chat
// (./messages). Desktop: the token on the left, the chat beside it.
export default async function TokenPage({
  params,
}: PageProps<"/token/[publicTokenId]">) {
  const { publicTokenId } = await params;
  const token = await getPublicTokenView(publicTokenId);
  if (!token) {
    notFound();
  }
  return (
    <PatientMessagingProvider
      key={`messages-${token.publicTokenId}`}
      publicTokenId={token.publicTokenId}
    >
      <PatientStrip
        wide
        eyebrow={messages.token.yourToken}
        title={token.clinicName}
        aside={<PatientMessagesButton />}
      >
        <p className="text-sm text-muted-foreground">{token.serviceName}</p>
      </PatientStrip>
      <PatientBody wide>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-6">
          <div className="flex min-w-0 flex-col gap-5">
            <TokenStatusLive key={token.publicTokenId} initial={token} />
            <PatientMessagesCard />
            <NewMessageBar />
          </div>
          <PatientChatDock
            clinicName={token.clinicName}
            tokenLabel={token.tokenLabel}
          />
        </div>
      </PatientBody>
    </PatientMessagingProvider>
  );
}
