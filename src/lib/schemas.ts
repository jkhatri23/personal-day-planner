import { z } from "zod";

export const Priority = z.enum(["LOW", "MEDIUM", "HIGH"]);
export const TaskStatus = z.enum([
  "PLANNED",
  "DONE",
  "VOIDED",
  "OWED",
  "SETTLED",
]);

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  notes: z.string().max(2000).optional().nullable(),
  dayId: z.string().min(1),
  priority: Priority.default("MEDIUM"),
  estimatedMins: z.number().int().positive().max(24 * 60).optional().nullable(),
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  notes: z.string().max(2000).nullable().optional(),
  priority: Priority.optional(),
  estimatedMins: z
    .number()
    .int()
    .positive()
    .max(24 * 60)
    .nullable()
    .optional(),
});

export const voidTaskSchema = z.object({
  reason: z.string().trim().min(10, "Reason must be at least 10 characters").max(500),
});

export const rescheduleTaskSchema = z.object({
  toDayId: z.string().min(1),
});

const resolutionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("DONE"), taskId: z.string() }),
  z.object({
    kind: z.literal("VOID"),
    taskId: z.string(),
    reason: z.string().trim().min(10).max(500),
  }),
  z.object({
    kind: z.literal("OWE"),
    taskId: z.string(),
    amountCents: z.number().int().min(500).max(100_00).default(1000),
    gofundmeUrl: z.string().url().optional().nullable(),
  }),
]);

export const reckonSchema = z.object({
  resolutions: z.array(resolutionSchema),
  reflection: z.string().max(500).optional().nullable(),
});

const GFM = /^https?:\/\/(?:[a-z0-9-]+\.)?gofundme\.com(?:\/.*)?$/i;
export const gofundmeUrlSchema = z
  .string()
  .url()
  .refine((v) => GFM.test(v), "Must be a gofundme.com URL");

export const settleDebtSchema = z.object({
  donationProof: z.string().trim().min(4).max(500),
  gofundmeUrl: gofundmeUrlSchema.optional(),
});

export const updateWeekSchema = z.object({
  intention: z.string().max(500).optional().nullable(),
});

export const updateSettingsSchema = z.object({
  defaultAmountCents: z.number().int().min(500).max(100_00).optional(),
  weeklyVoidBudget: z.number().int().min(0).max(7).optional(),
  timezone: z.string().min(1).max(64).optional(),
  gofundmeUrls: z.array(gofundmeUrlSchema).optional(),
});
