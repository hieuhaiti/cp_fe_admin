import apiClient from './common/apiClient'
import type { AdminDashboardOverview } from '@/types/api'

const noLang = { skipLang: true }

export default {
  /** GET /admin/dashboard/overview — aggregated flood, classification, land composition, feedback */
  getOverview: () => apiClient.get<AdminDashboardOverview>('/admin/dashboard/overview', noLang),
}
