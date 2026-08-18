export type FloodModule = 'event' | 'hand' | 'impact' | 'trend'
export type FloodLegendModule = 'event' | 'hand' | 'rain' | 'impact' | 'trend'

export interface FloodLegendEntry {
  color: string
  value?: number
  label?: { vi?: string; en?: string }
}

export interface FloodLegend {
  code: string
  module: FloodLegendModule | null
  label: { vi: string; en: string }
  kind: 'binary' | 'continuous' | 'class'
  entries: FloodLegendEntry[]
  min?: number
  max?: number
  hasOverride: boolean
}

export interface UpdateLegendBody {
  label?: { vi?: string; en?: string }
  palette?: string[]
  min?: number
  max?: number
}
export type FloodRunMode = 'product' | 'calibration'
export type FloodRunStatus =
  | 'QUEUED'
  | 'COMPUTING'
  | 'EXPORTING'
  | 'HARVESTING'
  | 'VALIDATING'
  | 'ARCHIVING'
  | 'PUBLISHING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'DLQ'

export interface FloodRun {
  id: number
  analysis_key: string
  attempt_no: number
  module: FloodModule
  mode: FloodRunMode
  status: FloodRunStatus
  stage?: string | null
  pipeline_version?: string
  config_version?: string
  params_snapshot?: Record<string, unknown>
  result_metadata?: Record<string, unknown> | null
  warnings?: unknown[]
  error_code?: string | null
  error_message_safe?: string | null
  created_at?: string
  started_at?: string | null
  finished_at?: string | null
}

export interface FloodArtifact {
  id: number
  analysis_run_id: number
  module: FloodModule
  artifact_code: string
  artifact_role: 'PRODUCT' | 'QA' | 'CALIBRATION'
  publish_status: 'unpublished' | 'publishing' | 'published' | 'failed'
  minio_object_key?: string | null
  workspace?: string | null
  layer_name?: string | null
  style_name?: string | null
  resolution_m?: number | null
  crs?: string | null
  registry_layer_id?: number | string | null
  registry_is_public?: boolean | null
  published_at?: string | null
  metadata?: {
    label?: { vi?: string; en?: string }
    [key: string]: unknown
  }
}

export interface FloodStageEvent {
  id: number
  stage: string
  event_type: string
  elapsed_ms?: number | null
  emitted_at?: string
  detail?: Record<string, unknown> | null
}

export interface FloodRunDetail extends FloodRun {
  artifacts: FloodArtifact[]
  stages: FloodStageEvent[]
}

export interface FloodDashboardAreaStats {
  floodExtentAreaHa?: number | null
  populationAffected?: number | null
  cropAffectedAreaHa?: number | null
  builtAffectedAreaHa?: number | null
  drainageAlertAreaHa?: number | null
}

export interface FloodDashboardModule {
  id: number | string
  status: FloodRunStatus
  finishedAt?: string | null
  /** params_snapshot — includes monitorStart/monitorEnd for trend runs */
  params?: {
    monitorStart?: string | null
    monitorEnd?: string | null
    [key: string]: unknown
  } | null
  /** result_metadata — includes areaStats for completed trend runs */
  metadata?: {
    monitorStart?: string | null
    monitorEnd?: string | null
    areaStats?: FloodDashboardAreaStats | null
    [key: string]: unknown
  } | null
  warnings?: unknown[]
}

export interface FloodDashboard {
  modules: { trend: FloodDashboardModule | null }
  layers: Array<{
    id: number | string
    analysisRunId?: number | string | null
    module: FloodModule
    code: string
    role: string
    workspace?: string
    layerName?: string
    styleName?: string | null
    registryLayerId?: number | string | null
    isPublic?: boolean
    publishedAt?: string
    metadata?: { label?: { vi?: string; en?: string }; style?: string } | null
  }>
}

export interface TrendConfigField {
  key: string
  category: 'basic' | 'advanced' | 'expert'
  type: 'integer' | 'number' | 'boolean' | 'select'
  label: string
  description: string
  default: unknown
  current?: unknown
  hasOverride?: boolean
  unit?: string
  min?: number
  max?: number
  required?: boolean
  options?: Array<{ value: string; label: string }>
}

export interface TrendConfig {
  defaults: Record<string, unknown>
  fields: TrendConfigField[]
}

export interface FloodQueueState {
  concurrency: number
  maxPending: number
  capacityRemaining: number
  accepting: boolean
  active: { key: string; label: string; startedAt?: string } | null
  pending: Array<{ key: string; label: string; enqueuedAt?: string }>
}
