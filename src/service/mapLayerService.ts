import apiClient from './common/apiClient'
import type { ApiResponse, ImportJob, MapLayer, MapLayerListData, MapLayerListParams } from '@/types/api'
import { serviceMapLayerPath, serviceMapImportJobPath } from '@/constant/serviceConstant'

type CanonicalLayerPatch = {
  expectedUpdatedAt: string
  nameVi?: string
  isPublic?: boolean
  minZoom?: number
  maxZoom?: number
}

function listItems(response: ApiResponse<MapLayerListData>): MapLayer[] {
  const data = response.data as MapLayerListData | MapLayer[] | undefined
  if (Array.isArray(data)) return data
  return data?.items ?? data?.mapLayers ?? []
}

async function resolveLayerId(idOrCode: number | string): Promise<number | string> {
  if (typeof idOrCode === 'number' || /^\d+$/.test(String(idOrCode))) return idOrCode
  const response = await apiClient.get<MapLayerListData>(serviceMapLayerPath, {
    params: { page: 1, limit: 1000 },
  })
  const layer = listItems(response).find((item) => item.code === idOrCode)
  if (!layer?.id) throw new Error(`Không tìm thấy layer có mã "${idOrCode}".`)
  return layer.id
}

function canonicalPatch(data: Record<string, unknown>): CanonicalLayerPatch {
  const expectedUpdatedAt = String(data.expectedUpdatedAt ?? data.updatedAt ?? data.updated_at ?? '')
  if (!expectedUpdatedAt) {
    throw new Error('Cập nhật lớp bản đồ cần expectedUpdatedAt từ dữ liệu chi tiết mới nhất.')
  }
  return {
    expectedUpdatedAt,
    nameVi: (data.nameVi ?? data.name_vi) as string | undefined,
    isPublic: (data.isPublic ?? data.is_public) as boolean | undefined,
    minZoom: (data.minZoom ?? data.min_zoom) as number | undefined,
    maxZoom: (data.maxZoom ?? data.max_zoom) as number | undefined,
  }
}

const unsupported = (name: string) =>
  Promise.reject(new Error(`${name} không có endpoint tương ứng trong Postman collection.`))

export default {
  /** GET /admin/layers?page=&limit= */
  getAll: (params?: MapLayerListParams) =>
    apiClient.get<MapLayerListData>(serviceMapLayerPath, { params }),

  /** GET /admin/layers/:layerId */
  getById: (layerId: number | string) => apiClient.get<MapLayer>(`${serviceMapLayerPath}/${layerId}`),

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
    permissions: Array<{ roleCode: string; canView: boolean; canExport: boolean; canEdit: boolean; canDelete: boolean }>
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
    if (!expectedUpdatedAt) throw new Error('Xóa lớp bản đồ cần expectedUpdatedAt từ dữ liệu chi tiết mới nhất.')
    return apiClient.del(`${serviceMapLayerPath}/${layerId}`, { expectedUpdatedAt })
  },

  /** POST /admin/layers/imports/shapefile */
  importShapefile: (data: {
    fileObjectId: number | string
    code: string
    nameVi: string
    category: string
    targetSrid: number
    isPublic: boolean
    sourceEncoding?: string
  }) => apiClient.post<{ jobId: number | string }>(`${serviceMapImportJobPath}/shapefile`, data),

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
  }) => apiClient.post<{ jobId: number | string }>(`${serviceMapImportJobPath}/excel`, data),

  /** GET /admin/layers/imports/:jobId */
  getImportJob: (jobId: number | string) =>
    apiClient.get<ImportJob>(`${serviceMapImportJobPath}/${jobId}`),

  /** GET /admin/layers/imports/:jobId/errors?page=&limit= */
  getImportErrors: (jobId: number | string, params?: { page?: number; limit?: number }) =>
    apiClient.get(`${serviceMapImportJobPath}/${jobId}/errors`, { params }),

  // Retained to avoid issuing requests to routes that do not exist in the
  // collection. Their UI flows need a product decision (import Shapefile/Excel
  // instead of direct/GeoJSON creation; no unpublish or active endpoint).
  create: (_data: unknown) => unsupported('create'),
  setActive: (_id: unknown, _data: unknown) => unsupported('setActive'),
  toggleStatus: (_id: unknown, _active?: boolean) => unsupported('toggleStatus'),
  unpublish: (_id: unknown) => unsupported('unpublish'),
  importFile: (_data: unknown) => unsupported('importFile'),
  importGeoJson: (_data: unknown) => unsupported('importGeoJson'),
  listImportJobs: (_id: unknown) => unsupported('listImportJobs'),
  harvestRaster: (_store: unknown, _data: unknown) => unsupported('harvestRaster'),
}
