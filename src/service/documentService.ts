import apiClient from './common/apiClient'
import type {
  ApiResponse,
  CreateDocumentBody,
  Document,
  DocumentListData,
  DocumentListParams,
  UpdateDocumentBody,
} from '@/types/api'
import { serviceDocumentsPath, serviceAdminDocumentsPath } from '@/constant/serviceConstant'
import storageService from './storageService'

function requireExpectedUpdatedAt(expectedUpdatedAt: string | undefined) {
  if (!expectedUpdatedAt) throw new Error('Missing expectedUpdatedAt from the current record.')
}

export default {
  /** GET /cms/documents (public list) */
  getPublicList: (params?: DocumentListParams) =>
    apiClient.get<DocumentListData>(serviceDocumentsPath, { params }),

  /** GET /cms/documents/:id (public detail) */
  getPublicById: (id: number | string) =>
    apiClient.get<Document>(`${serviceDocumentsPath}/${id}`),

  /** GET /cms/documents/:id/download-url — short-lived signed URL */
  getDownloadUrl: (id: number | string, expireSeconds = 300) =>
    apiClient.get<{ url: string; expiresAt?: string; fileName?: string }>(
      `${serviceDocumentsPath}/${id}/download-url`,
      { params: { expireSeconds } },
    ),

  /** GET /admin/cms/documents (admin list — includes internal docs) */
  getAll: (params?: DocumentListParams) =>
    apiClient.get<DocumentListData>(serviceAdminDocumentsPath, { params }),

  /** GET /admin/cms/documents/:id */
  getById: (id: number | string) =>
    apiClient.get<Document>(`${serviceAdminDocumentsPath}/${id}`),

  /**
   * POST /admin/cms/documents
   * Accepts either a plain body object (with pre-committed fileObjectId) or FormData
   * with a `file` field (the service handles the 3-step storage handshake).
   */
  create: async (
    data:
      | CreateDocumentBody
      | FormData,
  ) => {
    if (!(data instanceof FormData)) {
      return apiClient.post<Document>(serviceAdminDocumentsPath, data)
    }

    const file = data.get('file')
    if (!(file instanceof File)) throw new Error('Vui lòng chọn tệp văn bản để tải lên.')
    const fileObjectId = await storageService.upload(file, 'documents')

    const value = (key: string) => {
      const entry = data.get(key)
      return typeof entry === 'string' ? entry : undefined
    }
    return apiClient.post<Document>(serviceAdminDocumentsPath, {
      title: value('title') ?? '',
      documentCode: value('documentCode') ?? '',
      issuingAgency: value('issuingAgency') ?? '',
      issuedAt: value('issuedAt') || null,
      description: value('description') || null,
      visibility: value('visibility') === 'internal' ? 'internal' : 'public',
      fileObjectId,
    } satisfies CreateDocumentBody)
  },

  /** PATCH /admin/cms/documents/:id — expectedUpdatedAt required (optimistic locking) */
  update: (id: number | string, data: UpdateDocumentBody) => {
    requireExpectedUpdatedAt(data.expectedUpdatedAt)
    return apiClient.patch<Document>(`${serviceAdminDocumentsPath}/${id}`, data)
  },

  /**
   * DELETE /admin/cms/documents/:id
   * @param deleteFiles - if true, also deletes the MinIO object (irreversible)
   */
  delete: (id: number | string, expectedUpdatedAt: string, deleteFiles = false) => {
    requireExpectedUpdatedAt(expectedUpdatedAt)
    return apiClient.del<ApiResponse<{}>>(
      `${serviceAdminDocumentsPath}/${id}`,
      undefined,
      { params: { expectedUpdatedAt, deleteFiles } },
    )
  },
}
