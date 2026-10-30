"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import type { AdminServiceView } from "@/features/services/schemas";
import type { StaffMemberView } from "@/features/staff/schemas";
import { adminRequest, errorMessage } from "./admin-api";
import { CheckboxField, initials, Pill, type PillTone } from "./admin-ui";

const AVAILABILITY: Record<
  StaffMemberView["availability"],
  { label: string; tone: PillTone }
> = {
  AVAILABLE: { label: "Available", tone: "done" },
  ON_BREAK: { label: "On break", tone: "wait" },
  OFF_DUTY: { label: "Off duty", tone: "off" },
};

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value) => b.includes(value));
}

function DoctorCard({
  clinicId,
  doctor,
  services,
}: {
  clinicId: string;
  doctor: StaffMemberView;
  services: AdminServiceView[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(doctor.serviceIds);
  const [saving, setSaving] = useState(false);
  const status = AVAILABILITY[doctor.availability];
  const inactive = doctor.status !== "ACTIVE";
  const changed = !sameSet(selected, doctor.serviceIds);

  async function save() {
    setSaving(true);
    try {
      await adminRequest(
        `/api/clinics/${clinicId}/doctors/${doctor.membershipId}/services`,
        { method: "PUT", body: { serviceIds: selected } },
      );
      toast.success(`Services saved for ${doctor.name}.`);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="flex flex-col overflow-hidden rounded-card border border-border bg-card shadow-card">
      <div className="flex items-start gap-3 border-b border-divider p-5">
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand font-display text-sm font-bold text-white"
        >
          {initials(doctor.name)}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold">{doctor.name}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {doctor.email}
          </p>
        </div>
        {inactive ? (
          <Pill tone="off">No access</Pill>
        ) : (
          <Pill tone={status.tone}>{status.label}</Pill>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        {doctor.delayMinutes > 0 && !inactive && (
          <p className="text-sm text-danger-text">
            Running about {doctor.delayMinutes} minutes late
          </p>
        )}
        <FieldSet>
          <FieldLegend variant="label">Services</FieldLegend>
          <p className="-mt-1 text-xs text-muted-foreground">
            {selected.length === 0
              ? "None ticked: this doctor can serve every service."
              : "Only patients of these services go to this doctor."}
          </p>
          <div className="grid gap-x-4 sm:grid-cols-2">
            {services.map((service) => (
              <CheckboxField
                key={service.id}
                label={`${service.tokenPrefix} · ${service.name}`}
                description={service.isActive ? undefined : "Turned off"}
                checked={selected.includes(service.id)}
                disabled={inactive}
                onChange={(event) =>
                  setSelected((current) =>
                    event.target.checked
                      ? [...current, service.id]
                      : current.filter((id) => id !== service.id),
                  )
                }
              />
            ))}
          </div>
        </FieldSet>
      </div>
      <div className="flex gap-2 border-t border-divider px-5 py-3.5">
        <Button
          className="h-10 rounded-btn px-5 font-semibold"
          disabled={!changed || saving || inactive}
          onClick={save}
        >
          {saving ? "Saving…" : "Save services"}
        </Button>
        {changed && (
          <Button
            variant="outline"
            className="h-10 rounded-btn"
            disabled={saving}
            onClick={() => setSelected(doctor.serviceIds)}
          >
            Undo
          </Button>
        )}
      </div>
    </li>
  );
}

export function DoctorsManager({
  clinicId,
  doctors,
  services,
}: {
  clinicId: string;
  doctors: StaffMemberView[];
  services: AdminServiceView[];
}) {
  if (doctors.length === 0) {
    return (
      <p className="rounded-card border border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground shadow-card">
        No doctors yet. Invite one from Staff and choose the Doctor role.
      </p>
    );
  }
  return (
    <ul className="grid gap-5 lg:grid-cols-2">
      {doctors.map((doctor) => (
        <DoctorCard
          key={doctor.membershipId}
          clinicId={clinicId}
          doctor={doctor}
          services={services}
        />
      ))}
    </ul>
  );
}
