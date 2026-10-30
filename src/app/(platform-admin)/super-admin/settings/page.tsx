import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PlatformPageSkeleton } from "@/components/platform/platform-shell";
import { requirePlatformPage } from "@/components/platform/platform-session";
import { PlatformSettingsForm } from "@/components/platform/settings-form";
import { getPlatformSettings } from "@/features/platform/settings-store";

export const metadata: Metadata = { title: "Platform settings · QueueCare" };

export default function SettingsPage() {
  return (
    <Suspense fallback={<PlatformPageSkeleton />}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  await requirePlatformPage();
  const settings = await getPlatformSettings();
  return (
    <>
      <PageHeader
        title="Platform settings"
        breadcrumbs={[{ label: "Settings" }]}
        status="Apply to every clinic on QueueCare."
      />
      <PlatformSettingsForm initial={settings} />
    </>
  );
}
