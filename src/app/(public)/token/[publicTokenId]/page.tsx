import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TokenStatusLive } from "@/components/patient/token-status-live";
import { getPublicTokenView } from "@/features/queue/queries";

export const metadata: Metadata = {
  title: "Your token · QueueCare",
};

// First view is rendered on the server; the client component keeps it fresh.
export default async function TokenPage({
  params,
}: PageProps<"/token/[publicTokenId]">) {
  const { publicTokenId } = await params;
  const token = await getPublicTokenView(publicTokenId);
  if (!token) {
    notFound();
  }
  return <TokenStatusLive key={token.publicTokenId} initial={token} />;
}
