import apiClient from './common/apiClient'
import type {
  ApiResponse,
  ImportJob,
  ImportJobError,
  ShapefileImportPayload,
  MapLayer,
  MapLayerLegend,
  MapLayerListData,
  MapLayerListParams,
  TimeSeriesCatalogLayer,
  LayerCleanupStatus,
} from '@/types/api'
import {
  serviceMapLayerPath,
  serviceMapImportJobPath,
  serviceWebMapPath,
} from '@/constant/serviceConstant'

type CanonicalLayerPatch = {
  expectedUpdatedAt: string
  nameVi?: string
  category?: string | null
  categoryName?: string | null
  styleName?: string | null
  isPublic?: boolean
  isEnableDefault?: boolean
  minZoom?: number
  maxZoom?: number
  legendConfig?: MapLayerLegend | null
  metadata?: Record<string, unknown> | null
}

function listItems(response: ApiResponse<MapLayerListData>): MapLayer[] {
  const data = response.data as MapLayerListData | MapLayer[] | undefined
  if (Array.isArray(data)) return data
  return data?.items ?? data?.mapLayers ?? []
}

function isTimeSeriesCatalogLayer(value: unknown): value is TimeSeriesCatalogLayer {
  if (!value || typeof value !== 'object') return false
  const layer = value as Partial<TimeSeriesCatalogLayer>
  const members = layer.timeSeries?.members
  return (
    (typeof layer.id === 'number' || typeof layer.id === 'string') &&
    typeof layer.code === 'string' &&
    typeof layer.nameVi === 'string' &&
    typeof layer.geoserverLayer === 'string' &&
    layer.geoserverLayer.length > 0 &&
    layer.timeSeries?.enabled === true &&
    Array.isArray(layer.timeSeries.values) &&
    layer.timeSeries.values.length > 0 &&
    Array.isArray(members) &&
    members.every(
      (member) =>
        (typeof member.imageId === 'number' || typeof member.imageId === 'string') &&
        typeof member.sceneCode === 'string' &&
        typeof member.acquiredAt === 'string' &&
        (typeof member.fileObjectId === 'number' || typeof member.fileObjectId === 'string')
    )
  )
}

function timeSeriesCatalogItems(response: ApiResponse<unknown>): TimeSeriesCatalogLayer[] {
  const data = response.data
  return Array.isArray(data) ? data.filter(isTimeSeriesCatalogLayer) : []
}

async function resolveLayerId(idOrCode: number | string): Promise<number | string> {
  if (typeof idOrCode === 'number' || /^\d+$/.test(String(idOrCode))) return idOrCode
  const response = await apiClient.get<MapLayerListData>(serviceMapLayerPath, {
    // The API caps `limit`; querying by code avoids the former invalid
    // `limit=1000` request and only fetches the small result set we need.
    params: { page: 1, limit: 10, q: String(idOrCode) },
  })
  const layer = listItems(response).find((item) => item.code === idOrCode)
  if (!layer?.id) throw new Error(`Không tìm thấy layer có mã "${idOrCode}".`)
  return layer.id
}

function canonicalPatch(data: Record<string, unknown>): CanonicalLayerPatch {
  const expectedUpdatedAt = String(
    data.expectedUpdatedAt ?? data.updatedAt ?? data.updated_at ?? ''
  )
  if (!expectedUpdatedAt) {
    throw new Error('Cập nhật lớp bản đồ cần expectedUpdatedAt từ dữ liệu chi tiết mới nhất.')
  }
  return {
    expectedUpdatedAt,
    nameVi: (data.nameVi ?? data.name_vi) as string | undefined,
    category: data.category as string | null | undefined,
    categoryName: (data.categoryName ?? data.category_name) as string | null | undefined,
    styleName: (data.styleName ?? data.style_name) as string | null | undefined,
    isPublic: (data.isPublic ?? data.is_public) as boolean | undefined,
    isEnableDefault: (data.isEnableDefault ?? data.is_enable_default) as boolean | undefined,
    minZoom: (data.minZoom ?? data.min_zoom) as number | undefined,
    maxZoom: (data.maxZoom ?? data.max_zoom) as number | undefined,
    legendConfig: (data.legendConfig ?? data.legend_config) as MapLayerLegend | null | undefined,
    metadata: data.metadata as Record<string, unknown> | null | undefined,
  }
}

const unsupported = (name: string) =>
  Promise.reject(new Error(`${name} không có endpoint tương ứng trong Postman collection.`))

export default {
  /** GET /web-map/time-series-layers — documented Time Series catalog. */
  getTimeSeriesCatalog: async () => {
    const response = await apiClient.get<unknown>(`${serviceWebMapPath}/time-series-layers`)
    return {
      ...response,
      data: timeSeriesCatalogItems(response),
    } as ApiResponse<TimeSeriesCatalogLayer[]>
  },

  /** GET /admin/layers?page=&limit= */
  getAll: (params?: MapLayerListParams) =>
    apiClient.get<MapLayerListData>(serviceMapLayerPath, { params }),

  /** GET /admin/layers/:layerId */
  getById: (layerId: number | string) =>
    apiClient.get<MapLayer>(`${serviceMapLayerPath}/${layerId}`),

  /** Compatibility helper that resolves a legacy layer code to its canonical ID. */
  getByCode: async (code: string) => {
    const layerId = await resolveLayerId(code)
    return apiClient.get<MapLayer>(`${serviceMapLayerPath}/${layerId}`)
  },

  /** PATCH /admin/layers/:layerId */
  patch: async (idOrCode: number | string, data: Record<string, unknown>) => {
    const layerId = await resolveLayerId(idOrCode)
    return apiClient.patch<MapLayer>(`${serviceMapLayerPath}/${layerId}`, canonicalPatch(data))
  },

  update: async (idOrCode: number | string, data: Record<string, unknown>) => {
    const layerId = await resolveLayerId(idOrCode)
    return apiClient.patch<MapLayer>(`${serviceMapLayerPath}/${layerId}`, canonicalPatch(data))
  },

  /** PUT /admin/layers/:layerId/permissions */
  setPermissions: async (
    idOrCode: number | string,
    permissions: Array<{
      roleCode: string
      canView: boolean
      canExport: boolean
      canEdit: boolean
      canDelete: boolean
    }>
  ) => {
    const layerId = await resolveLayerId(idOrCode)
    return apiClient.put<MapLayer>(`${serviceMapLayerPath}/${layerId}/permissions`, { permissions })
  },

  /** POST /admin/layers/:layerId/publish */
  publish: async (idOrCode: number | string) => {
    const layerId = await resolveLayerId(idOrCode)
    return apiClient.post(`${serviceMapLayerPath}/${layerId}/publish`)
  },

  /** DELETE /admin/layers/:layerId with optimistic-locking body. */
  delete: async (idOrCode: number | string, expectedUpdatedAt?: string) => {
    const layerId = await resolveLayerId(idOrCode)
    if (!expectedUpdatedAt) {
      const detail = await apiClient.get<MapLayer>(`${serviceMapLayerPath}/${layerId}`)
      expectedUpdatedAt = detail.data?.updatedAt ?? detail.data?.updated_at ?? undefined
    }
    if (!expectedUpdatedAt)
      throw new Error('Xóa lớp bản đồ cần expectedUpdatedAt từ dữ liệu chi tiết mới nhất.')
    return apiClient.del(`${serviceMapLayerPath}/${layerId}`, { expectedUpdatedAt })
  },

  /** GET /admin/layers/:layerId/cleanup */
  getCleanupStatus: async (idOrCode: number | string) => {
    const layerId = await resolveLayerId(idOrCode)
    return apiClient.get<LayerCleanupStatus>(`${serviceMapLayerPath}/${layerId}/cleanup`)
  },

  /** POST /admin/layers/:layerId/cleanup/retry */
  retryCleanup: async (idOrCode: number | string) => {
    const layerId = await resolveLayerId(idOrCode)
    return apiClient.post<{ message: string }>(`${serviceMapLayerPath}/${layerId}/cleanup/retry`)
  },

  /** POST /admin/layers/imports/shapefile */
  importShapefile: (data: ShapefileImportPayload) =>
    apiClient.post<ImportJob>(`${serviceMapImportJobPath}/shapefile`, data),

  /** POST /admin/layers/imports/excel */
  importExcel: (data: {
    fileObjectId: number | string
    code: string
    nameVi: string
    category: string
    sheetName: string
    xColumn: string
    yColumn: string
    sourceSrid: number
    targetSrid: number
    isPublic: boolean
  }) => apiClient.post<ImportJob>(`${serviceMapImportJobPath}/excel`, data),

  /** GET /admin/layers/imports/:jobId */
  getImportJob: (jobId: number | string) =>
    apiClient.get<ImportJob>(`${serviceMapImportJobPath}/${jobId}`),

  /** GET /admin/layers/imports/:jobId/errors?page=&limit= */
  getImportErrors: (jobId: number | string, params?: { page?: number; limit?: number }) =>
    apiClient.get<ImportJobError[]>(`${serviceMapImportJobPath}/${jobId}/errors`, { params }),

  // Retained to avoid issuing requests to routes that do not exist in the
  // collection. Their UI flows need a product decision (import Shapefile/Excel
  // instead of direct/GeoJSON creation; no unpublish or active endpoint).
  create: () => unsupported('create'),
  setActive: () => unsupported('setActive'),
  toggleStatus: () => unsupported('toggleStatus'),
  unpublish: () => unsupported('unpublish'),
  importFile: () => unsupported('importFile'),
  importGeoJson: (_data?: FormData) => unsupported('importGeoJson'),
  listImportJobs: () => unsupported('listImportJobs'),
  harvestRaster: () => unsupported('harvestRaster'),
}
