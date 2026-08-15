import apiClient from './common/apiClient'
import type {
  ApiResponse,
  PdfMap,
  PdfMapListData,
  PdfMapListParams,
  UpdatePdfMapBody,
} from '@/types/api'
import { servicePdfMapPath, serviceAdminPdfMapPath } from '@/constant/serviceConstant'
import storageService from './storageService'

function toCanonicalPdfMapPatch(data: UpdatePdfMapBody) {
  return {
    expectedUpdatedAt: data.expectedUpdatedAt,
    title: data.translations?.vi?.title,
    visibility: data.isPublic === undefined ? undefined : data.isPublic ? 'public' : 'internal',
  }
}

function requireExpectedUpdatedAt(expectedUpdatedAt: string | undefined) {
  if (!expectedUpdatedAt) throw new Error('Missing expectedUpdatedAt from the current record.')
}

/**
 * Postman renamed the old "map images" module to PDF Maps.
 * This service targets `/cms/pdf-maps` (public) and `/admin/cms/pdf-maps` (admin).
 * Legacy import path kept as `mapImageService` for backwards compatibility.
 */
export default {
  /** GET /pdf-maps (public list) */
  getPublicList: (params?: PdfMapListParams) =>
    apiClient.get<PdfMapListData>(servicePdfMapPath, { params }),

  /** GET /pdf-maps/:pdfMapId (public detail) */
  getPublicById: (pdfMapId: number | string) =>
    apiClient.get<PdfMap>(`${servicePdfMapPath}/${pdfMapId}`),

  /** GET /cms/pdf-maps/:pdfMapId/download-url — signed, short-lived URL. */
  getDownloadUrl: (pdfMapId: number | string, expireSeconds = 300) =>
    apiClient.get<{ url: string; expiresAt?: string; fileName?: string }>(
      `${servicePdfMapPath}/${pdfMapId}/download-url`,
      { params: { expireSeconds } }
    ),

  /** GET /admin/cms/pdf-maps (admin list) */
  getAll: (params?: PdfMapListParams) =>
    apiClient.get<PdfMapListData>(serviceAdminPdfMapPath, { params }),

  /** GET /admin/cms/pdf-maps/:pdfMapId */
  getById: (pdfMapId: number | string) =>
    apiClient.get<PdfMap>(`${serviceAdminPdfMapPath}/${pdfMapId}`),

  /**
   * POST /admin/cms/pdf-maps with a committed storage object ID.
   */
  create: async (data: FormData | {
    title: string
    scaleLabel: string
    mapYear: number
    preparingAgency: string
    description?: string
    visibility: 'public' | 'internal'
    fileObjectId: number | string
  }) => {
    if (!(data instanceof FormData)) return apiClient.post<PdfMap>(serviceAdminPdfMapPath, data)

    const file = data.get('file')
    if (!(file instanceof File)) throw new Error('Vui lòng chọn tệp bản đồ để tải lên.')
    const fileObjectId = await storageService.upload(file, 'documents')
    const value = (key: string) => {
      const entry = data.get(key)
      return typeof entry === 'string' ? entry : undefined
    }
    return apiClient.post<PdfMap>(serviceAdminPdfMapPath, {
      title: value('title') ?? '',
      scaleLabel: value('scaleLabel') ?? value('scale') ?? '',
      mapYear: Number(value('mapYear') ?? value('year')),
      preparingAgency: value('preparingAgency') ?? value('region') ?? '',
      description: value('description') || undefined,
      visibility: value('visibility') === 'internal' || value('isPublic') === 'false' ? 'internal' : 'public',
      fileObjectId,
    })
  },

  /**
   * PATCH /admin/cms/pdf-maps/:pdfMapId
   */
  update: (pdfMapId: number | string, data: UpdatePdfMapBody) => {
    requireExpectedUpdatedAt(data.expectedUpdatedAt)
    const body = toCanonicalPdfMapPatch(data)
    if (body.title === undefined && body.visibility === undefined) {
      return Promise.reject(new Error('The current API only supports changing the PDF map title or visibility.'))
    }
    return apiClient.patch<PdfMap>(`${serviceAdminPdfMapPath}/${pdfMapId}`, body)
  },

  /** The API collection does not define a translation-specific endpoint. */
  updateTranslation: (
    pdfMapId: number | string,
    lang: 'vi' | 'en',
    data: { title: string; description?: string }
  ) => {
    void pdfMapId
    void lang
    void data
    return Promise.reject(new Error('API hiện tại không có endpoint cập nhật bản dịch bản đồ PDF.'))
  },

  /** DELETE /admin/cms/pdf-maps/:pdfMapId?expectedUpdatedAt= */
  delete: (pdfMapId: number | string, expectedUpdatedAt: string) => {
    requireExpectedUpdatedAt(expectedUpdatedAt)
    return apiClient.del<ApiResponse<{}>>(`${serviceAdminPdfMapPath}/${pdfMapId}`, undefined, {
      params: { expectedUpdatedAt },
    })
  },

  /**
   * Legacy toggle-status endpoint isn't in Postman; falls back to a partial update
   * of `isPublic`. Caller must supply an expectedUpdatedAt via the second argument.
   */
  toggleStatus: (pdfMapId: number | string, expectedUpdatedAt: string, isPublic: boolean) => {
    requireExpectedUpdatedAt(expectedUpdatedAt)
    return apiClient.patch<PdfMap>(`${serviceAdminPdfMapPath}/${pdfMapId}`, {
      visibility: isPublic ? 'public' : 'internal',
      expectedUpdatedAt,
    })
  },
}
