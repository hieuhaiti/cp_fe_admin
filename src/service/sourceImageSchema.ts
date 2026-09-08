import { z } from 'zod'

export const layerLifecycleSchema = z.object({
  id: z.union([z.number(), z.string()]),
  code: z.string(),
  nameVi: z.string().optional().default(''),
  publishStatus: z.string().nullable().optional(),
  cleanupStatus: z.string().nullable().optional(),
  deletedAt: z.string().nullable().optional(),
})

export const satelliteImageMemberSchema = z.object({
  id: z.union([z.number(), z.string()]),
  scene_code: z.string(),
  title: z.string().optional().default(''),
  platform: z.string(),
  thematic_group: z.string().nullable().optional(),
  coverage_key: z.string(),
  acquired_at: z.string(),
  product_level: z.string().nullable().optional(),
  resolution_m: z.union([z.number(), z.string()]).nullable().optional(),
  cloud_cover_percent: z.union([z.number(), z.string()]).nullable().optional(),
  orbit_number: z.number().nullable().optional(),
  description: z.string().nullable().optional(),
  layer_id: z.union([z.number(), z.string()]).nullable().optional(),
  standalone_layer_id: z.union([z.number(), z.string()]).nullable().optional(),
  original_name: z.string().optional(),
  size_bytes: z.union([z.number(), z.string()]).optional(),
  created_at: z.string(),
  updated_at: z.string(),
  standaloneLayer: layerLifecycleSchema.nullable().optional(),
  timeSeriesLayer: layerLifecycleSchema.nullable().optional(),
})

export const collectionGroupSchema = z.object({
  coverageKey: z.string(),
  thematicGroup: z.string().nullable().optional(),
  totalImages: z.number(),
  uniqueDates: z.number(),
  earliestAcquiredAt: z.string().nullable().optional(),
  latestAcquiredAt: z.string().nullable().optional(),
  hasDuplicateDates: z.boolean(),
  duplicateDateCount: z.number(),
  isPublishable: z.boolean(),
  collectionLayer: layerLifecycleSchema.nullable().optional(),
})

export const layerCleanupJobSchema = z.object({
  id: z.union([z.number(), z.string()]),
  status: z.string(),
  attempt: z.number(),
  maxAttempts: z.number(),
  nextAttemptAt: z.string().nullable().optional(),
  startedAt: z.string().nullable().optional(),
  finishedAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export const layerCleanupStatusSchema = z.object({
  layerId: z.union([z.number(), z.string()]),
  code: z.string(),
  deletedAt: z.string().nullable().optional(),
  cleanupStatus: z.string(),
  updatedAt: z.string().nullable().optional(),
  canRetry: z.boolean(),
  job: layerCleanupJobSchema.nullable().optional(),
})

export type LayerLifecycle = z.infer<typeof layerLifecycleSchema>
export type SourceImageMember = z.infer<typeof satelliteImageMemberSchema>
export type CollectionGroupItem = z.infer<typeof collectionGroupSchema>
export type LayerCleanupStatusData = z.infer<typeof layerCleanupStatusSchema>
