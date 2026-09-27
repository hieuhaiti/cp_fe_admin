export interface MapApiScope {
  read?: boolean
  rate_per_min?: number
  bbox_limit?: number
  [key: string]: any
}

export type MapApiCreateResponse = MapApiKeyIssueData & {
  api?: MapApi
}

export interface MapApi {
  id: number
  name: string
  description?: string
  layer_id?: number
  layer_code?: string
  scope?: MapApiScope
  key_prefix?: string
  key_last4?: string
  is_active?: boolean
  expires_at?: string | null
  last_used_at?: string | null
  request_count?: number
  created_by?: number
  createdAt?: string
  updatedAt?: string
  version?: number | string
  layer_name_vi?: string

  slug?: string
  endpoint_url?: string
  http_method?: string
  status?: string
  published_at?: string
  created_at?: string
  updated_at?: string

  // Canonical server fields
  read_fields?: string[]
  write_fields?: string[]
  search_fields?: string[]
  allowed_methods?: string[]
  default_sort_field?: string
  layer_name?: string
}

/** Legacy alias */
export type MapLayerApi = MapApi

export interface MapApiListData {
  items?: MapApi[]
  apis?: MapApi[]
  pagination?: import('./index').Pagination
}

/** Legacy alias */
export type MapLayerApiListData = MapApiListData

export interface MapApiListParams {
  page?: number
  limit?: number
  q?: string
  is_active?: boolean
  layer_id?: number

  status?: string
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
}

export type MapLayerApiListParams = MapApiListParams

export interface CreateMapApiBody {
  name: string
  layer_id: number
  description?: string
  scope?: MapApiScope
  is_active?: boolean
  expires_at?: string | null

  // API registry contract fields accepted by the backend. Some legacy callers still
  // populate them and the service layer normalizes them into the canonical payload.
  layerId?: number | string
  slug?: string
  readFields?: string[]
  writeFields?: string[]
  searchFields?: string[]
  allowedMethods?: string[]
  defaultSortField?: string
  metadata?: Record<string, unknown>
  // Key issuance fields (when creating registry + issuing initial key)
  consumer?: string
  keyName?: string
  key_name?: string
  scopes?: string[]
}

export interface UpdateMapApiBody {
  name?: string
  description?: string
  scope?: MapApiScope
  is_active?: boolean
  expires_at?: string | null

  expectedVersion?: number | string
  readFields?: string[]
  writeFields?: string[]
  searchFields?: string[]
  allowedMethods?: string[]
  defaultSortField?: string
  metadata?: Record<string, unknown>
}

/** Legacy aliases so old import paths keep compiling. */
export type CreateMapLayerApiBody = CreateMapApiBody
export type UpdateMapLayerApiBody = UpdateMapApiBody

/** A share key row returned by GET /admin/api-registry/:registryId/keys. */
export interface MapApiKey {
  id: string
  registry_id?: number | string
  name: string
  consumer: string
  token_version?: number
  token_hint?: string
  scopes?: string[]
  quota_per_minute?: number
  quotaPerMinute?: number
  expires_at?: string | null
  expiresAt?: string | null
  created_at?: string | null
  createdAt?: string | null
  rotated_at?: string | null
  rotatedAt?: string | null
  revoked_at?: string | null
  revokedAt?: string | null
  token?: string
}

export interface MapApiKeyListData {
  items?: MapApiKey[]
}

export interface IssueKeyBody {
  name: string
  consumer: string
  scopes?: string[]
  quotaPerMinute?: number
  expiresInHours?: number
}

/** Response of POST /admin/api-registry/:id/keys and rotate — raw token returned once. */
export interface MapApiKeyIssueData {
  id?: string
  registry_id?: number | string
  name?: string
  consumer?: string
  token_version?: number
  token_hint?: string
  scopes?: string[]
  quota_per_minute?: number
  expires_at?: string | null
  token?: string
  api?: MapApi
  apiKey?: string
  raw_key?: string
}

export interface RegistryKeyCreationData extends MapApiKeyIssueData {
  api: MapApi
}

export interface MapApiUsageSummary {
  calls: number
  quota_rejections: number
  errors: number
  avg_duration_ms: number | string
}

export interface MapApiUsageByKey {
  key_id: string
  calls: number
  last_called_at: string | null
}

export interface MapApiUsageData {
  summary: MapApiUsageSummary
  byKey: MapApiUsageByKey[]
}

/** Consumer-side (/map-data/*) — used from citizen apps */
export interface MapDataFeaturesQuery {
  q?: string
  bbox?: string
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
}

export interface MapDataFeaturesResponse {
  type: 'FeatureCollection'
  features: any[]
  total: number
  returned: number
  hasMore: boolean
}
