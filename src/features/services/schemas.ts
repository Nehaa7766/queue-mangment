import { z } from "zod";

// Shared by the API and the admin forms. No server imports: the browser loads this.

export const serviceInputSchema = z.object({
  name: z.string().trim().min(2, "Enter a service name.").max(60),
  description: z
    .string()
    .trim()
    .max(200)
    .transform((value) => value || null)
    .nullable(),
  // First part of the token label, e.g. "B" in "B-12".
  tokenPrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{1,3}$/, "Use 1–3 letters, e.g. A or DEN."),
  estimatedDurationMinutes: z.int().min(1).max(240),
});
export type ServiceInput = z.infer<typeof serviceInputSchema>;

export const serviceUpdateSchema = serviceInputSchema
  .partial()
  .extend({ isActive: z.boolean().optional() });
export type ServiceUpdate = z.infer<typeof serviceUpdateSchema>;

export type AdminServiceView = {
  id: string;
  name: string;
  description: string | null;
  tokenPrefix: string;
  estimatedDurationMinutes: number;
  isActive: boolean;
  doctorCount: number;
  totalTokens: number;
};
