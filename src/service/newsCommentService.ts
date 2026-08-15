import apiClient from './common/apiClient'
import type {
  NewsComment,
  NewsCommentListData,
  NewsCommentAdminListParams,
  CreatePublicCommentBody,
  ApproveCommentBody,
} from '@/types/api'
import {
  serviceNewsPath,
  serviceAdminNewsPath,
  serviceAdminNewsCommentsPath,
} from '@/constant/serviceConstant'

export default {
  /** GET /news/:newsId/comments (approved only) */
  getByNewsId: (newsId: number | string, params?: { page?: number; limit?: number }) =>
    apiClient.get<NewsCommentListData>(`${serviceNewsPath}/${newsId}/comments`, { params }),

  /** POST /news/:newsId/comments (citizen) */
  create: (newsId: number | string, data: CreatePublicCommentBody) =>
    apiClient.post<NewsComment>(`${serviceNewsPath}/${newsId}/comments`, data),

  /** GET /admin/cms/news/:newsId/comments */
  getAll: (params?: NewsCommentAdminListParams) => {
    const { newsId, targetId, ...query } = params ?? {}
    const pathId = newsId ?? targetId ?? 1
    return apiClient.get<NewsCommentListData>(
      `${serviceAdminNewsPath}/${pathId}/comments`,
      { params: query },
    )
  },

  /** PATCH /admin/cms/news/comments/:commentId */
  approve: (commentId: number | string, data: ApproveCommentBody = { isApproved: true }) =>
    apiClient.patch<NewsComment>(`${serviceAdminNewsCommentsPath}/${commentId}`, {
      status: data.isApproved ? 'approved' : 'rejected',
    }),

  /** DELETE /admin/cms/news/comments/:commentId */
  delete: (commentId: number | string) =>
    apiClient.del<Record<string, never>>(`${serviceAdminNewsCommentsPath}/${commentId}`),

  /** Backwards-compat alias */
  adminDelete: (commentId: number | string) =>
    apiClient.del<Record<string, never>>(`${serviceAdminNewsCommentsPath}/${commentId}`),

  /** GET /admin/cms/news/comments/:commentId */
  getById: (commentId: number | string) =>
    apiClient.get<NewsComment>(`${serviceAdminNewsCommentsPath}/${commentId}`),
}
