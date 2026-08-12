import apiClient from './common/apiClient'
import { serviceStatsPath } from '@/constant/serviceConstant'
import type { ApiResponse, DashboardStats } from '@/types/api'

const unsupported = <T>(name: string): Promise<T> =>
  Promise.reject(
    new Error(`${name} không có endpoint tương ứng trong Postman collection; dùng các API statistics mới.`)
  )

export default {
  /** GET /statistics/sources */
  getSources: () => apiClient.get(`${serviceStatsPath}/sources`),

  /** POST /admin/statistics/sources */
  createSource: (data: {
    layerId: number | string
    sourceType: string
    observedYear: number
    geometryColumn: string
  }) => apiClient.post('/admin/statistics/sources', data),

  /** POST /admin/statistics/sources/:statisticsSourceId/refresh */
  refreshSource: (sourceId: number | string, boundarySourceId: number | string | null = null) =>
    apiClient.post(`/admin/statistics/sources/${sourceId}/refresh`, { boundarySourceId }),

  /** GET /statistics/areas?type=&year= */
  getAreas: (params: { type?: string; year?: number } = {}) =>
    apiClient.get(`${serviceStatsPath}/areas`, { params }),

  /** GET /statistics/timeseries?type= */
  getTimeseries: (type?: string) =>
    apiClient.get(`${serviceStatsPath}/timeseries`, { params: { type } }),

  /** GET /statistics/compare?beforeSourceId=&afterSourceId= */
  compare: (beforeSourceId: number | string, afterSourceId: number | string) =>
    apiClient.get(`${serviceStatsPath}/compare`, { params: { beforeSourceId, afterSourceId } }),

  /** PATCH /admin/statistics/sources/:statisticsSourceId */
  updateSource: (sourceId: number | string, data: {
    sourceType: string
    observedYear: number
    geometryColumn: string
    expectedUpdatedAt: string
  }) => apiClient.patch(`/admin/statistics/sources/${sourceId}`, data),

  // These dashboard-specific calls used routes absent from the source of truth.
  // Retain exports only to fail locally instead of issuing an invalid request.
  getAdminUnits: (_params?: unknown) => unsupported<never>('getAdminUnits'),
  getLandcover: (_params?: unknown) => unsupported<never>('getLandcover'),
  getDashboard: (_params?: unknown) => unsupported<ApiResponse<DashboardStats>>('getDashboard'),
}
