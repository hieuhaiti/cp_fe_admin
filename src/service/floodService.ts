import apiClient from './common/apiClient'
import { serviceAdminFloodPath } from '@/constant/serviceConstant'
import type {
  FloodDashboard,
  FloodModule,
  FloodQueueState,
  FloodRun,
  FloodRunDetail,
  FloodRunMode,
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
  // Auto-fill helper for the M3 rain form.
  getCurrentWeather: () =>
    apiClient.get<{
      observedAt: string | null
      location: string | null
      coord: { lng: number; lat: number }
      source: 'openweather'
      rainfall: {
        amount1h: number | null
        amount3h: number | null
        amount6h: number | null
        amount24h: number | null
        amount72h: number | null
        amount7d: number | null
        amount30d: number | null
      }
      weather: { id: number; main: string; description: string; icon: string } | null
      humidity: number | null
      wind: { speed: number | null; deg: number | null; gust: number | null }
    }>(`${serviceAdminFloodPath}/weather/current`, noLang),
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
