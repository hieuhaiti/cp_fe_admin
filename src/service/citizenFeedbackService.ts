import apiClient from './common/apiClient'
import type {
  CitizenFeedback,
  CitizenFeedbackListData,
  FeedbackListParams,
  UpdateFeedbackStatusBody,
  FeedbackFeatureCollection,
} from '@/types/api'
import { serviceFeedbackPath, serviceAdminFeedbackPath } from '@/constant/serviceConstant'

export default {
  // ── Citizen / public ──

  /**
   * POST /feedback (multipart)
   * body: category, title, description, priority, lng, lat, clientUuid, media[]
   * Bearer or x-anonymous-id
   */
  create: (data: FormData) => apiClient.post<CitizenFeedback>(serviceFeedbackPath, data, true),

  /** GET /feedback/mine */
  getMine: (params?: FeedbackListParams) =>
    apiClient.get<CitizenFeedbackListData>(`${serviceFeedbackPath}/mine`, { params }),

  /** Legacy alias */
  getMyFeedbacks: (params?: FeedbackListParams) =>
    apiClient.get<CitizenFeedbackListData>(`${serviceFeedbackPath}/mine`, { params }),

  /** GET /feedback/:feedbackId */
  getById: (feedbackId: number | string) =>
    apiClient.get<CitizenFeedback>(`${serviceFeedbackPath}/${feedbackId}`),

  // ── Admin ──

  /** GET /admin/field-reports (paginated list) */
  getAll: (params?: FeedbackListParams) =>
    apiClient.get<CitizenFeedbackListData>(serviceAdminFeedbackPath, { params }),

  /**
   * GET /admin/field-reports/clusters
   * Returns clusters array: { cluster_id, report_count, reporter_count, longitude, latitude }
   */
  getMap: (params?: { radiusMeters?: number; minReporters?: number; from?: string; to?: string }) =>
    apiClient.get<any[]>(`${serviceAdminFeedbackPath}/clusters`, { params }),

  /** GET /admin/field-reports/:feedbackId */
  getAdminById: (feedbackId: number | string) =>
    apiClient.get<CitizenFeedback>(`${serviceAdminFeedbackPath}/${feedbackId}`),

  /** PATCH /admin/field-reports/:feedbackId/review */
  updateStatus: (feedbackId: number | string, data: UpdateFeedbackStatusBody) => {
    const legacyStatus = data.status ?? data.toStatus
    const statusMap: Record<string, string> = {
      new: 'pending',
      in_progress: 'under_review',
      resolved: 'approved',
      rejected: 'rejected',
    }
    const status = legacyStatus ? statusMap[legacyStatus] ?? legacyStatus : undefined
    const payload = {
      status,
      expectedUpdatedAt: data.expectedUpdatedAt,
    }

    return apiClient.patch<CitizenFeedback>(`${serviceAdminFeedbackPath}/${feedbackId}/review`, payload)
  },
}
