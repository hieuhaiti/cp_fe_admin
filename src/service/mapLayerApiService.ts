import apiClient from '@/service/common/apiClient'
import { serviceMapApiPath, serviceMapDataPath } from '@/constant/serviceConstant'
import type {
  ApiResponse,
  MapApi,
  MapApiKey,
  MapApiKeyIssueData,
  MapApiKeyListData,
  MapApiListData,
  MapApiListParams,
  CreateMapApiBody,
  UpdateMapApiBody,
  MapDataFeaturesQuery,
  MapDataFeaturesResponse,
  RegistryKeyCreationData,
  IssueKeyBody,
  MapApiUsageData,
} from '@/types/api'

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  )
}

export function inferRegistryFieldConfig(data: CreateMapApiBody) {
  const metadata = ((data as CreateMapApiBody & { metadata?: Record<string, unknown> }).metadata ??
    {}) as Record<string, unknown>
  const displayFields = toStringList(metadata.displayFields ?? metadata.display_fields)
  const searchFields = toStringList(metadata.searchFields ?? metadata.search_fields)
  const editableFields = toStringList(metadata.editableFields ?? metadata.editable_fields)
  const rawIdField =
    typeof metadata.idField === 'string'
      ? metadata.idField.trim()
      : typeof metadata.id_field === 'string'
        ? metadata.id_field.trim()
        : 'name'
  const idField = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(rawIdField) ? rawIdField : 'name'

  const candidates =
    displayFields.length > 0
      ? displayFields
      : searchFields.length > 0
        ? searchFields
        : [idField, 'name']

  const readFields = Array.from(
    new Set(
      candidates.filter((item) => /^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(item))
    )
  ).slice(0, 50)

  if (readFields.length === 0) {
    readFields.push('name')
  }

  const rawSearch = searchFields.length > 0 ? searchFields : readFields
  const search = Array.from(
    new Set(rawSearch.filter((item) => readFields.includes(item)))
  ).slice(0, 10)

  const writeFields = Array.from(
    new Set(editableFields.filter((field) => readFields.includes(field)))
  ).slice(0, 30)

  const defaultSortField =
    typeof (data as CreateMapApiBody & { defaultSortField?: string }).defaultSortField === 'string' &&
    /^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test((data as CreateMapApiBody & { defaultSortField?: string }).defaultSortField!.trim())
      ? (data as CreateMapApiBody & { defaultSortField?: string }).defaultSortField!.trim()
      : readFields.includes('name')
        ? 'name'
        : (readFields[0] ?? 'name')

  return {
    readFields,
    writeFields,
    searchFields: search,
    defaultSortField,
  }
}

export function toCanonicalCreateBody(data: CreateMapApiBody) {
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
  const rawRead = legacy.readFields?.length ? toStringList(legacy.readFields) : inferred.readFields
  const rawSearch = Array.isArray(legacy.searchFields) ? toStringList(legacy.searchFields) : inferred.searchFields
  const rawWrite = Array.isArray(legacy.writeFields) ? toStringList(legacy.writeFields) : inferred.writeFields

  const readFields = Array.from(
    new Set(rawRead.filter((item) => /^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(item)))
  ).slice(0, 50)
  if (readFields.length === 0) {
    readFields.push('name')
  }

  const searchFields = Array.from(
    new Set(rawSearch.filter((item) => readFields.includes(item)))
  ).slice(0, 10)

  const allowedMethods = Array.isArray(legacy.allowedMethods) && legacy.allowedMethods.length > 0
    ? Array.from(new Set(legacy.allowedMethods))
    : ['GET']

  const hasWriteMethod = allowedMethods.some((m) => m !== 'GET')

  const rawChosenWrite = Array.isArray(legacy.writeFields) && legacy.writeFields.length > 0
    ? legacy.writeFields
    : rawWrite

  const writeFieldsFiltered = Array.from(
    new Set(rawChosenWrite.filter((item) => readFields.includes(item)))
  ).slice(0, 30)

  const writeFields = hasWriteMethod
    ? (writeFieldsFiltered.length > 0 ? writeFieldsFiltered : readFields.slice(0, 30))
    : []

  const defaultSortField =
    legacy.defaultSortField && /^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(legacy.defaultSortField)
      ? legacy.defaultSortField
      : (inferred.defaultSortField ?? readFields[0] ?? 'name')

  const rawSlugCandidate = (legacy.slug ?? legacy.name)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const safeSlug = (/^[a-z]/.test(rawSlugCandidate) ? rawSlugCandidate : `api-${rawSlugCandidate}`)
    .slice(0, 80)
    .padEnd(3, '0')

  return {
    layerId: Number(legacy.layerId ?? legacy.layer_id),
    slug: safeSlug,
    name: legacy.name.trim(),
    readFields,
    writeFields,
    searchFields: Array.isArray(legacy.searchFields) ? searchFields : (searchFields.length > 0 ? searchFields : []),
    allowedMethods,
    defaultSortField,
  }
}

async function toCanonicalUpdateBody(id: number | string, data: UpdateMapApiBody) {
  const supplied = data as UpdateMapApiBody & { expectedVersion?: number | string }
  let expectedVersion = supplied.expectedVersion
  if (expectedVersion === undefined || expectedVersion === null) {
    const detail = await apiClient.get<MapApi>(`${serviceMapApiPath}/${id}`)
    expectedVersion = detail.data?.version
  }
  if (expectedVersion === undefined || expectedVersion === null) {
    throw new Error('Cập nhật API registry cần expectedVersion từ dữ liệu chi tiết mới nhất.')
  }

  const payload: Record<string, unknown> = {
    expectedVersion: Number(expectedVersion),
  }
  if (data.name) payload.name = data.name.trim()
  if (Array.isArray(data.readFields) && data.readFields.length > 0) payload.readFields = data.readFields
  if (Array.isArray(data.writeFields)) payload.writeFields = data.writeFields
  if (Array.isArray(data.searchFields)) payload.searchFields = data.searchFields
  if (Array.isArray(data.allowedMethods)) payload.allowedMethods = data.allowedMethods
  if (data.defaultSortField) payload.defaultSortField = data.defaultSortField
  if (data.is_active !== undefined) payload.isActive = Boolean(data.is_active)

  return payload
}

async function firstKeyOf(registryId: number | string): Promise<MapApiKey | undefined> {
  const response = await apiClient.get<MapApiKeyListData | MapApiKey[]>(
    `${serviceMapApiPath}/${registryId}/keys`
  )
  const raw = response.data
  const items: MapApiKey[] = Array.isArray(raw) ? raw : (raw?.items ?? [])
  return items.find((key) => key?.id !== undefined && key.id !== null)
}

interface ApiClientError {
  status?: number
  body?: {
    errors?: unknown[]
  }
}

function isRegistryConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as ApiClientError
  return (
    candidate.status === 409 &&
    Array.isArray(candidate.body?.errors) &&
    candidate.body.errors.includes('REGISTRY_CONFLICT')
  )
}

function listItems(response: ApiResponse<MapApiListData>): MapApi[] {
  return response.data?.items ?? response.data?.apis ?? []
}

async function findRegistryByLayer(layerId: number): Promise<MapApi | undefined> {
  const response = await apiClient.get<MapApiListData>(serviceMapApiPath, {
    params: { layer_id: layerId, page: 1, limit: 10 },
  })
  return listItems(response).find((registry) => Number(registry.layer_id) === layerId)
}

function toExpiresInHours(expiresAt?: string | null): number {
  if (!expiresAt) return 720
  const expiresAtMs = Date.parse(expiresAt)
  if (!Number.isFinite(expiresAtMs)) return 720
  const remainingHours = Math.ceil((expiresAtMs - Date.now()) / 3_600_000)
  return Math.min(2160, Math.max(1, remainingHours))
}

function issueKey(registryId: number | string, data: CreateMapApiBody) {
  const consumer = (data.consumer || data.name).trim()
  const keyName = (data.keyName || (data.consumer ? `Khóa ${data.consumer}` : data.name)).trim()
  const quotaPerMinute = Math.min(1000, Math.max(1, data.scope?.rate_per_min ?? 60))
  const scopes = Array.isArray(data.scopes) && data.scopes.length > 0 ? data.scopes : ['features:read']
  return apiClient.post<MapApiKeyIssueData>(`${serviceMapApiPath}/${registryId}/keys`, {
    name: keyName,
    consumer,
    scopes,
    quotaPerMinute,
    expiresInHours: toExpiresInHours(data.expires_at),
  })
}

async function createKeyForLayer(data: CreateMapApiBody): Promise<ApiResponse<RegistryKeyCreationData>> {
  const canonical = toCanonicalCreateBody(data)
  let registry = await findRegistryByLayer(canonical.layerId)

  if (!registry) {
    try {
      const created = await apiClient.post<MapApi>(serviceMapApiPath, canonical)
      registry = created.data
    } catch (error) {
      if (!isRegistryConflict(error)) throw error
      registry = await findRegistryByLayer(canonical.layerId)
    }
  }

  if (!registry?.id) {
    throw new Error('Không tìm thấy API đã đăng ký cho lớp bản đồ này.')
  }

  const issued = await issueKey(registry.id, data)
  return {
    ...issued,
    data: {
      ...issued.data,
      api: registry,
    },
  }
}

const mapApiService = {
  // ── Admin CRUD ──

  /** GET /map-apis */
  getAll: (params?: MapApiListParams) =>
    apiClient.get<MapApiListData>(serviceMapApiPath, { params }),

  /** GET /map-apis/:mapApiId */
  getById: (mapApiId: number | string) => apiClient.get<MapApi>(`${serviceMapApiPath}/${mapApiId}`),

  /** POST /admin/api-registry — creates only the registry definition, not a share key */
  create: (data: CreateMapApiBody) =>
    apiClient.post<MapApi>(serviceMapApiPath, toCanonicalCreateBody(data)),

  /** Reuse/create a layer registry, then issue a distinct share key without rotating older keys. */
  createKeyForLayer,

  /** PATCH /map-apis/:mapApiId */
  update: async (mapApiId: number | string, data: UpdateMapApiBody) =>
    apiClient.put<MapApi>(
      `${serviceMapApiPath}/${mapApiId}`,
      await toCanonicalUpdateBody(mapApiId, data)
    ),

  /** GET /admin/api-registry/:registryId/keys */
  getKeys: (registryId: number | string) =>
    apiClient.get<MapApiKeyListData | MapApiKey[]>(`${serviceMapApiPath}/${registryId}/keys`),

  /** POST /admin/api-registry/:registryId/keys */
  issueKey: (registryId: number | string, data: IssueKeyBody) =>
    apiClient.post<MapApiKeyIssueData>(`${serviceMapApiPath}/${registryId}/keys`, {
      name: data.name.trim(),
      consumer: data.consumer.trim(),
      scopes: data.scopes ?? ['features:read'],
      quotaPerMinute: data.quotaPerMinute ?? 60,
      expiresInHours: data.expiresInHours ?? 720,
    }),

  /** POST /admin/api-registry/keys/:apiKeyId/rotate */
  rotateKey: (apiKeyId: number | string, expiresInHours = 720) =>
    apiClient.post<MapApiKeyIssueData>(`${serviceMapApiPath}/keys/${apiKeyId}/rotate`, {
      expiresInHours,
    }),

  /** POST /admin/api-registry/keys/:apiKeyId/revoke */
  revokeKey: (apiKeyId: number | string) =>
    apiClient.post<MapApiKeyIssueData>(`${serviceMapApiPath}/keys/${apiKeyId}/revoke`),

  /** GET /admin/api-registry/:registryId/usage */
  getUsage: (registryId: number | string, params?: { from?: string; to?: string }) =>
    apiClient.get<MapApiUsageData>(`${serviceMapApiPath}/${registryId}/usage`, { params }),

  /** Rotate or issue: get existing UUID key for registry and rotate it; if none, issue a new one */
  regenerate: async (registryId: number | string, keyName?: string) => {
    const first = await firstKeyOf(registryId)
    if (first) {
      return apiClient.post<MapApiKeyIssueData>(`${serviceMapApiPath}/keys/${first.id}/rotate`, {
        expiresInHours: 720,
      })
    }
    return apiClient.post<MapApiKeyIssueData>(`${serviceMapApiPath}/${registryId}/keys`, {
      name: keyName ?? 'Khóa mới',
      consumer: keyName ?? 'Admin',
      scopes: ['features:read'],
      quotaPerMinute: 60,
      expiresInHours: 720,
    })
  },

  /** Revoke first UUID key of registry */
  revoke: async (registryId: number | string) => {
    const first = await firstKeyOf(registryId)
    if (!first) throw new Error('Không tìm thấy khóa API để thu hồi.')
    return apiClient.post<MapApiKeyIssueData>(`${serviceMapApiPath}/keys/${first.id}/revoke`)
  },

  /** DELETE /admin/api-registry/:mapApiId */
  delete: async (mapApiId: number | string, expectedVersion?: number | string) => {
    let ver = expectedVersion
    if (ver === undefined || ver === null || ver === '') {
      const detail = await apiClient.get<MapApi>(`${serviceMapApiPath}/${mapApiId}`)
      ver = detail.data?.version
    }
    if (ver === undefined || ver === null || ver === '') {
      return Promise.reject(
        new Error('Xóa API registry cần expectedVersion từ dữ liệu chi tiết mới nhất.')
      )
    }
    return apiClient.del<ApiResponse<{}>>(`${serviceMapApiPath}/${mapApiId}`, undefined, {
      params: { expectedVersion: Number(ver) },
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
