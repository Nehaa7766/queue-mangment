import { recordAudit } from "@/features/audit/record-audit";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { requireClinicAdminAccess } from "./access";
import type { HolidayInput } from "./schemas";

export type HolidayView = { id: string; date: string; name: string };

// Prisma maps a @db.Date column to a Date at UTC midnight.
function toDbDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

function fromDbDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Whether the clinic is closed all day on `day` (YYYY-MM-DD in the clinic's
// timezone). Public reads call this without a session.
export async function isClinicHoliday(
  clinicId: string,
  day: string,
): Promise<boolean> {
  const holiday = await getDb().clinicHoliday.findUnique({
    where: { clinicId_date: { clinicId, date: toDbDate(day) } },
    select: { id: true },
  });
  return holiday !== null;
}

// Today onwards, plus the last 30 days for context.
export async function listHolidays(
  clinicId: string,
  today: string,
): Promise<HolidayView[]> {
  await requireClinicAdminAccess(clinicId, "clinic.settings");
  const since = new Date(toDbDate(today).getTime() - 30 * 24 * 60 * 60 * 1000);
  const holidays = await getDb().clinicHoliday.findMany({
    where: { clinicId, date: { gte: since } },
    orderBy: { date: "asc" },
    select: { id: true, date: true, name: true },
  });
  return holidays.map((holiday) => ({
    id: holiday.id,
    date: fromDbDate(holiday.date),
    name: holiday.name,
  }));
}

export async function addHoliday(
  clinicId: string,
  input: HolidayInput,
): Promise<HolidayView> {
  const access = await requireClinicAdminAccess(clinicId, "clinic.settings");
  const db = getDb();
  const existing = await db.clinicHoliday.findUnique({
    where: { clinicId_date: { clinicId, date: toDbDate(input.date) } },
    select: { id: true },
  });
  if (existing) {
    throw new AppError(
      "VALIDATION_ERROR",
      "There's already a holiday on that date.",
    );
  }
  const holiday = await db.$transaction(async (tx) => {
    const created = await tx.clinicHoliday.create({
      data: { clinicId, date: toDbDate(input.date), name: input.name },
      select: { id: true, date: true, name: true },
    });
    await recordAudit(tx, {
      clinicId,
      actorUserId: access.user.userId,
      action: "clinic.holiday_added",
      metadata: { date: input.date },
    });
    return created;
  });
  return {
    id: holiday.id,
    date: fromDbDate(holiday.date),
    name: holiday.name,
  };
}

export async function removeHoliday(
  clinicId: string,
  holidayId: string,
): Promise<void> {
  const db = getDb();
  const holiday = await db.clinicHoliday.findUnique({
    where: { id: holidayId },
    select: { id: true, clinicId: true, date: true },
  });
  if (!holiday || holiday.clinicId !== clinicId) {
    throw new AppError("VALIDATION_ERROR", "This holiday no longer exists.");
  }
  const access = await requireClinicAdminAccess(
    holiday.clinicId,
    "clinic.settings",
  );
  await db.$transaction(async (tx) => {
    await tx.clinicHoliday.delete({ where: { id: holiday.id } });
    await recordAudit(tx, {
      clinicId: holiday.clinicId,
      actorUserId: access.user.userId,
      action: "clinic.holiday_removed",
      metadata: { date: fromDbDate(holiday.date) },
    });
  });
}
