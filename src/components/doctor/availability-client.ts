import { apiRequest } from "@/components/queue/api-client";
import type { AvailabilityBody } from "@/features/doctor/availability";
import {
  DOCTOR_API,
  type DoctorAvailabilityResponse,
  type DoctorSelfView,
} from "@/features/doctor/contracts";

// Saves the signed-in doctor's availability. Throws ApiError on failure.
export async function saveAvailability(
  body: AvailabilityBody,
): Promise<DoctorSelfView> {
  const { doctor } = await apiRequest<DoctorAvailabilityResponse>(
    DOCTOR_API.availability,
    { method: "POST", body },
  );
  return doctor;
}

// Default length of a break started from the dashboard's quick toggle.
export const QUICK_BREAK_MINUTES = 15;
