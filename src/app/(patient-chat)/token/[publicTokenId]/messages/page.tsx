import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { PatientChatScreen } from "@/components/patient/patient-chat-screen";
import { channelFromSegment } from "@/features/messaging/contracts";
import { getPublicTokenView } from "@/features/queue/queries";

export const metadata: Metadata = {
  title: "Messages · QueueCare",
};

// The page shrinks when the phone keyboard opens, so the composer stays
// above it.
export const viewport: Viewport = {
  interactiveWidget: "resizes-content",
};

// ?with=reception|doctor picks the chat; reception by default.
export default async function PatientChatPage({
  params,
  searchParams,
}: PageProps<"/token/[publicTokenId]/messages">) {
  const { publicTokenId } = await params;
  const { with: withParam } = await searchParams;
  const token = await getPublicTokenView(publicTokenId);
  if (!token) {
    notFound();
  }
  const channel =
    (typeof withParam === "string" && channelFromSegment(withParam)) ||
    "RECEPTION";
  return (
    <PatientChatScreen
      key={token.publicTokenId}
      publicTokenId={token.publicTokenId}
      clinicName={token.clinicName}
      tokenLabel={token.tokenLabel}
      initialChannel={channel}
    />
  );
}
