import { connection } from "next/server";
import { clinicNotFound } from "@/features/clinics/access";
import { addHoliday, listHolidays } from "@/features/clinics/holidays";
import { holidayInputSchema } from "@/features/clinics/schemas";
import { parseUuid, readJsonBody } from "@/features/queue/http";
import { withApiHandler } from "@/lib/errors/api-handler";

type Context = RouteContext<"/api/clinics/[clinicId]/holidays">;

// Upcoming holidays plus the last 30 days. The window is wide enough that
// using the UTC date for "today" doesn't matter here.
export const GET = withApiHandler(async (_request, context: Context) => {
  await connection();
  const clinicId = parseUuid((await context.params).clinicId, clinicNotFound);
  const today = new Date().toISOString().slice(0, 10);
  return Response.json({ holidays: await listHolidays(clinicId, today) });
});

export const POST = withApiHandler(async (request, context: Context) => {
  const clinicId = parseUuid((await context.params).clinicId, clinicNotFound);
  const input = holidayInputSchema.parse(await readJsonBody(request));
  return Response.json(
    { holiday: await addHoliday(clinicId, input) },
    { status: 201 },
  );
});
