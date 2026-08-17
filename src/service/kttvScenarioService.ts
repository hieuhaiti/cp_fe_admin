import apiClient from './common/apiClient'
import { serviceAdminFloodPath, serviceFloodPath } from '@/constant/serviceConstant'
import type { Pagination } from '@/types/api'

export interface FloodScenarioLayer {
  id: string
  code: string
  nameVi: string
  category: string
  categoryName: string
  geometryType: string
  storageKind: string
  geoserverLayer: string
}

export interface FloodScenario {
  id: number | string
  code: string
  name_vi: string
  min_rainfall: string | null
  max_rainfall: string | null
  min_tide: string | null
  max_tide: string | null
  layer_code: string
  description: string | null
  is_active: boolean
  created_at?: string
  updated_at?: string
  layer?: FloodScenarioLayer
}

export interface FloodScenarioListParams {
  page?: number
  limit?: number
  activeOnly?: boolean
}

export interface FloodScenarioListData {
  items: FloodScenario[]
  pagination?: Pagination
}

export interface FloodSimulationParams {
  rainfall: number
  tide: number | null
  scenarioId: number
  scenarioCode: string
  scenarioName: string
  matchedLayerCode: string
}

/** API returns the matched layer object directly, with simulationParams embedded */
export interface FloodSimulationResult {
  id: string
  code: string
  nameVi: string
  category: string
  categoryName: string
  geometryType: string
  storageKind: string
  geoserverLayer: string
  styleName: string | null
  minZoom: number
  maxZoom: number
  legend: Record<string, any> | null
  isPublic: boolean
  isEnableDefault: boolean
  simulationParams: FloodSimulationParams
}

export interface FloodScenarioWriteBody {
  code?: string
  nameVi?: string
  minRainfall?: number | null
  maxRainfall?: number | null
  minTide?: number | null
  maxTide?: number | null
  layerCode?: string
  description?: string | null
  isActive?: boolean
}

const publicBase = `${serviceFloodPath}/scenarios`
const publicFloodBase = serviceFloodPath
const adminBase = `${serviceAdminFloodPath}/scenarios`

export default {
  /** GET /api/v1/flood/scenarios?page=1&limit=20&activeOnly=true */
  getPublicAll: (params?: FloodScenarioListParams) =>
    apiClient.get<FloodScenarioListData>(publicBase, {
      params: { ...(params ?? {}), activeOnly: true },
    }),

  /** GET /api/v1/flood/scenarios/:floodScenarioId */
  getPublicById: (id: number | string) => apiClient.get<FloodScenario>(`${publicBase}/${id}`),

  /** GET /api/v1/admin/flood/scenarios?page=1&limit=20 */
  getAll: (params?: FloodScenarioListParams) =>
    apiClient.get<FloodScenarioListData>(adminBase, { params }),

  /** GET /api/v1/admin/flood/scenarios/:floodScenarioId */
  getById: (id: number | string) => apiClient.get<FloodScenario>(`${adminBase}/${id}`),

  /** POST /api/v1/admin/flood/scenarios */
  create: (data: FloodScenarioWriteBody) => apiClient.post<FloodScenario>(adminBase, data),

  /** PUT /api/v1/admin/flood/scenarios/:floodScenarioId */
  update: (id: number | string, data: FloodScenarioWriteBody) =>
    apiClient.put<FloodScenario>(`${adminBase}/${id}`, data),

  /** DELETE /api/v1/admin/flood/scenarios/:floodScenarioId */
  delete: (id: number | string) => apiClient.del<FloodScenario>(`${adminBase}/${id}`),

  /** POST /flood/simulation — match scenario by rainfall + tide */
  simulate: (data: { rainfall: number; tide?: number | null }) =>
    apiClient.post<FloodSimulationResult>(`${publicFloodBase}/simulation`, data),
}
