import { z } from 'zod'

export const forecastScheduleSlotSchema = z.object({
  id: z.number(),
  snapshot_id: z.number().optional().nullable(),
  forecast_date: z.string(),
  hour_str: z.string(),
  scheduled_time: z.string().optional().nullable(),
  chance_of_rain: z.number().optional().nullable(),
  precip_mm: z.number().optional().nullable(),
  status: z.enum(['PENDING', 'APPLIED', 'SKIPPED', 'FAILED', 'MANUAL']),
  applied_scenario_id: z.number().nullable().optional(),
  is_manual_override: z.boolean(),
  manual_rainfall: z.number().nullable().optional(),
  manual_updated_at: z.string().nullable().optional(),
})

export const manualOverrideResponseSchema = z.object({
  success: z.boolean(),
  action: z.enum(['deactivated', 'applied']).optional(),
  deactivatedCount: z.number().optional(),
  deactivatedIds: z.array(z.union([z.number(), z.string()])).optional(),
  slot: forecastScheduleSlotSchema.optional().nullable(),
  scenario: z.unknown().optional().nullable(),
})

export type ManualOverrideResponse = z.infer<typeof manualOverrideResponseSchema>
