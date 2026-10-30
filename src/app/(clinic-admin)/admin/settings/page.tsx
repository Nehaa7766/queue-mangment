import { Suspense } from "react";
import { AdminSection } from "@/components/admin/admin-ui";
import { HolidaysManager } from "@/components/admin/holidays-manager";
import { OpeningHoursEditor } from "@/components/admin/opening-hours-editor";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import {
  ClinicProfileForm,
  QueueSettingsForm,
} from "@/components/admin/settings-forms";
import { PageHeader } from "@/components/layout/page-header";
import {
  requestNow,
  requireStaffPage,
} from "@/components/layout/staff-session";
import { clinicDate } from "@/features/analytics/clinic-time";
import { listHolidays } from "@/features/clinics/holidays";
import { getClinicSettings } from "@/features/clinics/settings";

export default function AdminSettingsPage() {
  return (
    <Suspense
      fallback={<AdminPageSkeleton label="Loading settings…" cards={4} />}
    >
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  const context = await requireStaffPage(["CLINIC_ADMIN"]);
  const now = await requestNow();
  const settings = await getClinicSettings(context.clinic.id);
  const today = clinicDate(new Date(now), settings.timezone);
  const holidays = await listHolidays(context.clinic.id, today);

  return (
    <>
      <PageHeader
        title="Clinic settings"
        status="Changes apply straight away."
        search={false}
      />
      <div className="flex flex-col gap-3.5">
        <AdminSection id="profile" title="Clinic profile">
          <ClinicProfileForm
            clinicId={settings.id}
            slug={settings.slug}
            initial={{
              name: settings.name,
              address: settings.address,
              phone: settings.phone,
              timezone: settings.timezone,
            }}
          />
        </AdminSection>
        <AdminSection
          id="hours"
          title="Opening hours"
          description={`In ${settings.timezone.replaceAll("_", " ")} time. Patients can join only while the clinic is open.`}
        >
          <OpeningHoursEditor
            clinicId={settings.id}
            initial={settings.openingHours}
          />
        </AdminSection>
        <AdminSection
          id="holidays"
          title="Holidays"
          description="The clinic is closed all day on these dates."
        >
          <HolidaysManager
            clinicId={settings.id}
            holidays={holidays}
            today={today}
          />
        </AdminSection>
        <AdminSection
          id="queue"
          title="Queue rules"
          description="Reception sees these on the live queue."
        >
          <QueueSettingsForm clinicId={settings.id} initial={settings.queue} />
        </AdminSection>
      </div>
    </>
  );
}
