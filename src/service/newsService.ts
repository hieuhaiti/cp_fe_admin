import apiClient from './common/apiClient'
import type {
  ApiResponse,
  News,
  NewsStatus,
  NewsData,
  NewsListData,
  NewsListParams,
  PatchNewsStatusBody,
  UpdateNewsBody,
} from '@/types/api'
import { serviceNewsPath, serviceAdminNewsPath } from '@/constant/serviceConstant'

type CanonicalNewsWrite = {
  title: string
  content: string
  summary?: string | null
  visibility: 'public' | 'internal'
  status: NewsStatus
  publishedAt?: string | null
  expectedUpdatedAt?: string
}

function readFormDataValue(data: FormData, key: string) {
  const value = data.get(key)
  return typeof value === 'string' ? value : undefined
}

function normalizeNewsWrite(data: FormData | UpdateNewsBody | CanonicalNewsWrite): CanonicalNewsWrite {
  if (data instanceof FormData) {
    return {
      title: readFormDataValue(data, 'title') ?? '',
      content: readFormDataValue(data, 'content') ?? '',
      summary: readFormDataValue(data, 'summary') || undefined,
      visibility: readFormDataValue(data, 'visibility') === 'internal' ? 'internal' : 'public',
      status: readFormDataValue(data, 'status') === 'published' || readFormDataValue(data, 'is_published') === 'true'
        ? 'published'
        : 'draft',
      publishedAt: readFormDataValue(data, 'publishedAt') ?? readFormDataValue(data, 'published_at') ?? undefined,
      expectedUpdatedAt: readFormDataValue(data, 'expectedUpdatedAt') ?? undefined,
    }
  }

  const legacy = data as UpdateNewsBody
  const vietnamese = legacy.translations?.vi
  return {
    title: (data as CanonicalNewsWrite).title ?? vietnamese?.title ?? '',
    content: (data as CanonicalNewsWrite).content ?? vietnamese?.content ?? '',
    summary: (data as CanonicalNewsWrite).summary ?? vietnamese?.summary ?? undefined,
    visibility: (data as CanonicalNewsWrite).visibility ?? 'public',
    status: data.status,
    publishedAt: (data as CanonicalNewsWrite).publishedAt,
    expectedUpdatedAt: data.expectedUpdatedAt,
  }
}

export default {
  /** GET /news (public list) */
  getPublicList: (params?: NewsListParams) =>
    apiClient.get<NewsListData>(serviceNewsPath, { params }),

  /** GET /news/:slug (public detail by slug) */
  getBySlug: (slug: string) => apiClient.get<NewsData>(`${serviceNewsPath}/${slug}`),

  /** GET /admin/cms/news (admin list — includes drafts) */
  getAll: (params?: NewsListParams) =>
    apiClient.get<NewsListData>(serviceAdminNewsPath, { params }),

  /** GET /admin/cms/news/:newsId */
  getById: (newsId: number | string) =>
    apiClient.get<NewsData>(`${serviceAdminNewsPath}/${newsId}`),

  /** POST /admin/cms/news — JSON body defined by the API collection. */
  create: (data: FormData | CanonicalNewsWrite) => {
    const body = normalizeNewsWrite(data)
    const { expectedUpdatedAt: _expectedUpdatedAt, ...createBody } = body
    return apiClient.post<News>(serviceAdminNewsPath, createBody)
  },

  /** PATCH /admin/cms/news/:newsId (includes expectedUpdatedAt) */
  patchStatus: (newsId: number | string, data: PatchNewsStatusBody) =>
    apiClient.patch<News>(`${serviceAdminNewsPath}/${newsId}`, data),

  /**
   * PATCH /admin/cms/news/:newsId
   * expectedUpdatedAt is required for optimistic locking.
   */
  update: (newsId: number | string, data: FormData | UpdateNewsBody | CanonicalNewsWrite) => {
    const body = normalizeNewsWrite(data)
    if (!body.expectedUpdatedAt) return Promise.reject(new Error('Missing expectedUpdatedAt from the current record.'))
    return apiClient.patch<News>(`${serviceAdminNewsPath}/${newsId}`, body)
  },

  /** DELETE /admin/cms/news/:newsId?expectedUpdatedAt= */
  delete: (newsId: number | string, expectedUpdatedAt: string) => {
    if (!expectedUpdatedAt) return Promise.reject(new Error('Missing expectedUpdatedAt from the current record.'))
    return apiClient.del<ApiResponse<{}>>(`${serviceAdminNewsPath}/${newsId}`, undefined, {
      params: { expectedUpdatedAt },
    })
  },
}
