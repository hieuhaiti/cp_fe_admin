import apiClient from './common/apiClient'
import { serviceAdminFloodPath } from '@/constant/serviceConstant'
import type {
  FloodDashboard,
  FloodLegend,
  FloodLegendModule,
  FloodModule,
  FloodQueueState,
  FloodRun,
  FloodRunDetail,
  FloodRunMode,
  UpdateLegendBody,
} from '@/types/api'

const noLang = { skipLang: true }

const floodService = {
  getDashboard: () => apiClient.get<FloodDashboard>(`${serviceAdminFloodPath}/dashboard`, noLang),
  getConfig: () => apiClient.get<Record<string, unknown>>(`${serviceAdminFloodPath}/config`, noLang),
  getQueue: () => apiClient.get<FloodQueueState>(`${serviceAdminFloodPath}/queue`, noLang),
  getRuns: (params: Record<string, string | number | undefined> = {}) =>
    apiClient.get<{ items: FloodRun[] }>(`${serviceAdminFloodPath}/runs`, {
      params,
      skipLang: true,
    }),
  getRun: (id: number) =>
    apiClient.get<FloodRunDetail>(`${serviceAdminFloodPath}/runs/${id}`, noLang),
  submit: (body: { module: FloodModule; mode: FloodRunMode; config: Record<string, unknown> }) =>
    apiClient.post<FloodRun>(`${serviceAdminFloodPath}/runs`, body, noLang),
  rerun: (id: number) =>
    apiClient.post<FloodRun>(`${serviceAdminFloodPath}/runs/${id}/rerun`, {}, noLang),
  cancel: (id: number) =>
    apiClient.post<FloodRun>(`${serviceAdminFloodPath}/runs/${id}/cancel`, {}, noLang),
  publishArtifact: (id: number) =>
    apiClient.post(`${serviceAdminFloodPath}/artifacts/${id}/publish`, {}, noLang),
  unpublishArtifact: (id: number) =>
    apiClient.post(`${serviceAdminFloodPath}/artifacts/${id}/unpublish`, {}, noLang),
  getLegends: (module?: FloodLegendModule) =>
    apiClient.get<FloodLegend[]>(`${serviceAdminFloodPath}/legends`, {
      params: module ? { module } : {},
      skipLang: true,
    }),
  updateLegend: (code: string, body: UpdateLegendBody) =>
    apiClient.put<FloodLegend>(`${serviceAdminFloodPath}/legends/${code}`, body, noLang),
  resetLegend: (code: string) =>
    apiClient.del<void>(`${serviceAdminFloodPath}/legends/${code}`, undefined, noLang),
  // Manual trigger for the nightly daily-flood pipeline (ops shortcut).
  triggerDaily: () =>
    apiClient.post<{
      queued: boolean
      reason?: string
      runId?: number
      sceneCount?: number
      postStart: string
      postEnd: string
    }>(`${serviceAdminFloodPath}/daily/trigger`, {}, noLang),
}

export default floodService
