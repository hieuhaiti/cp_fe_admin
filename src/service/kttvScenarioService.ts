import apiClient from './common/apiClient'
import { serviceAdminFloodPath, serviceFloodPath } from '@/constant/serviceConstant'
import type { Pagination } from '@/types/api'

export interface FloodScenario {
  id: number | string
  code: string
  name: string
  matchPriority?: number
  matchRule?: Record<string, unknown> | null
  isEnabled?: boolean
  createdAt?: string
  updatedAt?: string
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

export interface FloodScenarioWriteBody {
  code?: string
  name?: string
  matchPriority?: number
  matchRule?: Record<string, unknown> | null
  isEnabled?: boolean
}

const publicBase = `${serviceFloodPath}/scenarios`
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
}
