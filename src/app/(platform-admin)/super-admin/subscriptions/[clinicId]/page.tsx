import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SubscriptionPill } from "@/components/platform/pills";
import {
  PlatformPageHeader,
  PlatformPageSkeleton,
} from "@/components/platform/platform-shell";
import { requirePlatformPage } from "@/components/platform/platform-session";
import { SubscriptionForm } from "@/components/platform/subscription-form";
import { getSubscriptionEditor } from "@/features/platform/subscriptions";

export const metadata: Metadata = { title: "Subscription · QueueCare" };

type Params = PageProps<"/super-admin/subscriptions/[clinicId]">["params"];

export default function SubscriptionEditorPage({
  params,
}: PageProps<"/super-admin/subscriptions/[clinicId]">) {
  return (
    <Suspense fallback={<PlatformPageSkeleton />}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: { params: Params }) {
  await requirePlatformPage();
  const editor = await getSubscriptionEditor((await params).clinicId);
  if (!editor) notFound();
  const { row, plans } = editor;
  const current = row.subscription;
  const defaultPlan = plans.find((plan) => plan.isActive) ?? plans[0];

  return (
    <>
      <Link
        href="/super-admin/subscriptions"
        className="mb-2 inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-slate underline-offset-4 hover:underline"
      >
        <ArrowLeftIcon className="size-4" aria-hidden />
        All subscriptions
      </Link>
      <PlatformPageHeader
        title={`Subscription · ${row.clinicName}`}
        description={
          current ? (
            <span className="inline-flex items-center gap-2">
              {current.planName} <SubscriptionPill status={current.status} />
            </span>
          ) : (
            "No subscription yet. Saving creates one."
          )
        }
      />
      <div className="max-w-xl">
        <SubscriptionForm
          clinicId={row.clinicId}
          plans={plans}
          initial={{
            planId: current?.planId ?? defaultPlan?.id ?? "",
            status: current?.status ?? "TRIALING",
            trialEndsAt: current?.trialEndsAt ?? "",
            currentPeriodEnd: current?.currentPeriodEnd ?? "",
          }}
        />
      </div>
    </>
  );
}
