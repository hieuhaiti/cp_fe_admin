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
  return {
    layerId: legacy.layerId ?? legacy.layer_id,
    slug: legacy.slug ?? legacy.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name: legacy.name,
    readFields: legacy.readFields ?? [],
    writeFields: legacy.writeFields ?? [],
    searchFields: legacy.searchFields ?? [],
    allowedMethods: legacy.allowedMethods ?? ['GET'],
    defaultSortField: legacy.defaultSortField ?? 'name',
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
    apiClient.put<MapApi>(`${serviceMapApiPath}/${mapApiId}`, await toCanonicalUpdateBody(mapApiId, data)),

  /** POST /map-apis/:mapApiId/regenerate — returns new raw_key ONCE */
  regenerate: (mapApiId: number | string) =>
    Promise.reject(new Error(`Không thể xoay khóa cho API registry ${mapApiId} khi chưa có apiKeyId.`)),

  /** PATCH /map-apis/:mapApiId body: { is_active: false } */
  revoke: (mapApiId: number | string) =>
    Promise.reject(new Error(`Không thể thu hồi API registry ${mapApiId} khi chưa có apiKeyId.`)),

  /** DELETE /map-apis/:mapApiId */
  delete: (mapApiId: number | string, expectedVersion?: number | string) => {
    if (expectedVersion === undefined || expectedVersion === null || expectedVersion === '') {
      return Promise.reject(new Error('Xóa API registry cần expectedVersion từ dữ liệu chi tiết mới nhất.'))
    }
    return apiClient.del<ApiResponse<{}>>(`${serviceMapApiPath}/${mapApiId}`, undefined, {
      params: { expectedVersion },
    })
  },

  // ── Consumer (/map-data — needs X-Map-Api-Key header) ──

  /** GET /map-data/layer */
  getConsumerLayer: (slug: string, apiKey: string) =>
    apiClient.get<MapApi>(`${serviceMapDataPath}/${slug}/features`, {
      mapApiKey: apiKey,
      params: { page: 1, limit: 1, sortBy: 'name', sortOrder: 'ASC' },
    }),

  /** GET /shared/:slug/features?bbox=&limit=&sortBy=&sortOrder= */
  getConsumerFeatures: (slug: string, apiKey: string, query?: MapDataFeaturesQuery) =>
    apiClient.get<MapDataFeaturesResponse>(`${serviceMapDataPath}/${slug}/features`, {
      mapApiKey: apiKey,
      params: query,
    }),

}

export default mapApiService
