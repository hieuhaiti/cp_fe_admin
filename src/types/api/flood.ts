export type FloodModule = 'event' | 'hand' | 'rain' | 'impact' | 'trend'
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

export interface FloodDashboardModule {
  id: number
  status: FloodRunStatus
  finishedAt?: string | null
  metadata?: Record<string, unknown> | null
  warnings?: unknown[]
}

export interface FloodDashboard {
  modules: Record<FloodModule, FloodDashboardModule | null>
  layers: Array<{
    id: number
    module: FloodModule
    code: string
    role: string
    workspace?: string
    layerName?: string
    registryLayerId?: number | string | null
    isPublic?: boolean
    publishedAt?: string
  }>
}

export interface FloodQueueState {
  concurrency: number
  maxPending: number
  capacityRemaining: number
  accepting: boolean
  active: { key: string; label: string; startedAt?: string } | null
  pending: Array<{ key: string; label: string; enqueuedAt?: string }>
}
