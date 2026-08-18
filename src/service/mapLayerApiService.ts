import apiClient from '@/service/common/apiClient'
import { serviceMapApiPath, serviceMapDataPath } from '@/constant/serviceConstant'
import type {
  ApiResponse,
  MapApi,
  MapApiListData,
  MapApiListParams,
  CreateMapApiBody,
  UpdateMapApiBody,
  MapDataFeaturesQuery,
  MapDataFeaturesResponse,
} from '@/types/api'

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

function inferRegistryFieldConfig(data: CreateMapApiBody) {
  const metadata = ((data as CreateMapApiBody & { metadata?: Record<string, unknown> }).metadata ??
    {}) as Record<string, unknown>
  const displayFields = toStringList(metadata.displayFields ?? metadata.display_fields)
  const searchFields = toStringList(metadata.searchFields ?? metadata.search_fields)
  const editableFields = toStringList(metadata.editableFields ?? metadata.editable_fields)
  const idField =
    typeof metadata.idField === 'string'
      ? metadata.idField
      : typeof metadata.id_field === 'string'
        ? metadata.id_field
        : 'name'

  const readFields =
    displayFields.length > 0
      ? displayFields
      : searchFields.length > 0
        ? searchFields
        : [idField, 'name'].filter(Boolean)

  const search = searchFields.length > 0 ? searchFields : readFields
  const writeFields = editableFields.filter((field) => readFields.includes(field))
  const defaultSortField =
    typeof (data as CreateMapApiBody & { defaultSortField?: string }).defaultSortField === 'string'
      ? (data as CreateMapApiBody & { defaultSortField?: string }).defaultSortField
      : readFields.includes('name')
        ? 'name'
        : (readFields[0] ?? idField ?? 'name')

  return {
    readFields,
    writeFields,
    searchFields: search,
    defaultSortField,
  }
}

function toCanonicalCreateBody(data: CreateMapApiBody) {
  const legacy = data as CreateMapApiBody & {
    layerId?: number | string
    layer_id?: number | string
    slug?: string
    readFields?: string[]
    writeFields?: string[]
    searchFields?: string[]
    allowedMethods?: string[]
    defaultSortField?: string
  }
  const inferred = inferRegistryFieldConfig(data)
  const readFields = legacy.readFields?.length ? legacy.readFields : inferred.readFields
  const searchFields = legacy.searchFields?.length ? legacy.searchFields : inferred.searchFields
  const writeFields = legacy.writeFields?.length ? legacy.writeFields : inferred.writeFields
  const defaultSortField = legacy.defaultSortField ?? inferred.defaultSortField ?? 'name'

  return {
    layerId: legacy.layerId ?? legacy.layer_id,
    slug:
      legacy.slug ??
      legacy.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-'),
    name: legacy.name,
    readFields: readFields.length ? readFields : ['name'],
    writeFields,
    searchFields: searchFields.length ? searchFields : ['name'],
    allowedMethods: legacy.allowedMethods ?? ['GET'],
    defaultSortField,
  }
}

async function toCanonicalUpdateBody(id: number | string, data: UpdateMapApiBody) {
  const supplied = data as UpdateMapApiBody & { expectedVersion?: number | string }
  if (supplied.expectedVersion !== undefined && supplied.expectedVersion !== null) {
    return { expectedVersion: supplied.expectedVersion, name: data.name }
  }
  const detail = await apiClient.get<MapApi>(`${serviceMapApiPath}/${id}`)
  const version = detail.data?.version
  if (version === undefined || version === null) {
    throw new Error('Cập nhật API registry cần expectedVersion từ dữ liệu chi tiết mới nhất.')
  }
  return { expectedVersion: version, name: data.name }
}

const mapApiService = {
  // ── Admin CRUD ──

  /** GET /map-apis */
  getAll: (params?: MapApiListParams) =>
    apiClient.get<MapApiListData>(serviceMapApiPath, { params }),

  /** GET /map-apis/:mapApiId */
  getById: (mapApiId: number | string) => apiClient.get<MapApi>(`${serviceMapApiPath}/${mapApiId}`),

  /** POST /map-apis — returns raw_key ONCE */
  create: (data: CreateMapApiBody) =>
    apiClient.post<MapApi>(serviceMapApiPath, toCanonicalCreateBody(data)),

  /** PATCH /map-apis/:mapApiId */
  update: async (mapApiId: number | string, data: UpdateMapApiBody) =>
    apiClient.put<MapApi>(
      `${serviceMapApiPath}/${mapApiId}`,
      await toCanonicalUpdateBody(mapApiId, data)
    ),

  /** GET /admin/api-registry/:registryId/keys */
  getKeys: (registryId: number | string) =>
    apiClient.get<any>(`${serviceMapApiPath}/${registryId}/keys`),

  /** POST /admin/api-registry/keys/:apiKeyId/rotate */
  rotateKey: (apiKeyId: number | string, expiresInHours = 720) =>
    apiClient.post<any>(`${serviceMapApiPath}/keys/${apiKeyId}/rotate`, { expiresInHours }),

  /** POST /admin/api-registry/keys/:apiKeyId/revoke */
  revokeKey: (apiKeyId: number | string) =>
    apiClient.post<any>(`${serviceMapApiPath}/keys/${apiKeyId}/revoke`),

  /** Rotate or issue: get existing UUID key for registry and rotate it; if none, issue a new one */
  regenerate: async (registryId: number | string, keyName?: string) => {
    const keysRes = await apiClient.get<any>(`${serviceMapApiPath}/${registryId}/keys`)
    const raw = keysRes.data
    const items: any[] = Array.isArray(raw) ? raw : (raw?.items ?? [])
    const first = items.find((k: any) => k?.id)
    if (first) {
      return apiClient.post<any>(`${serviceMapApiPath}/keys/${first.id}/rotate`, {
        expiresInHours: 720,
      })
    }
    return apiClient.post<any>(`${serviceMapApiPath}/${registryId}/keys`, {
      name: keyName ?? 'Khóa mới',
      consumer: keyName ?? 'Admin',
      scopes: ['features:read'],
      quotaPerMinute: 60,
      expiresInHours: 720,
    })
  },

  /** Revoke first UUID key of registry */
  revoke: async (registryId: number | string) => {
    const keysRes = await apiClient.get<any>(`${serviceMapApiPath}/${registryId}/keys`)
    const raw = keysRes.data
    const items: any[] = Array.isArray(raw) ? raw : (raw?.items ?? [])
    const first = items.find((k: any) => k?.id)
    if (!first) throw new Error('Không tìm thấy khóa API để thu hồi.')
    return apiClient.post<any>(`${serviceMapApiPath}/keys/${first.id}/revoke`)
  },

  /** DELETE /map-apis/:mapApiId */
  delete: (mapApiId: number | string, expectedVersion?: number | string) => {
    if (expectedVersion === undefined || expectedVersion === null || expectedVersion === '') {
      return Promise.reject(
        new Error('Xóa API registry cần expectedVersion từ dữ liệu chi tiết mới nhất.')
      )
    }
    return apiClient.del<ApiResponse<{}>>(`${serviceMapApiPath}/${mapApiId}`, undefined, {
      params: { expectedVersion },
    })
  },

  // ── Consumer (/shared — needs Authorization: Bearer <share_token>) ──
  // The share token is a JWT returned once by POST /api-registry/:id/keys or rotate.
  // It is NOT the same as the admin JWT — use headers: { Authorization } to override.

  /** GET /shared/:slug/features (metadata probe) */
  getConsumerLayer: (slug: string, shareToken: string) =>
    apiClient.get<MapApi>(`${serviceMapDataPath}/${slug}/features`, {
      headers: { Authorization: `Bearer ${shareToken}` },
      params: { page: 1, limit: 1 },
    }),

  /** GET /shared/:slug/features?bbox=&limit=&sortBy=&sortOrder= */
  getConsumerFeatures: (slug: string, shareToken: string, query?: MapDataFeaturesQuery) =>
    apiClient.get<MapDataFeaturesResponse>(`${serviceMapDataPath}/${slug}/features`, {
      headers: { Authorization: `Bearer ${shareToken}` },
      params: query,
    }),
}

export default mapApiService
