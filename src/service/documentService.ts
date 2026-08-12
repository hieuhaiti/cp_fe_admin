import apiClient from './common/apiClient'
import type {
  ApiResponse,
  Document,
  DocumentListData,
  DocumentListParams,
  PatchDocumentBody,
  UpdateDocumentBody,
} from '@/types/api'
import { serviceDocumentPath, serviceAdminDocumentPath } from '@/constant/serviceConstant'
import storageService from './storageService'

export default {
  /** GET /documents (public list) */
  getPublicList: (params?: DocumentListParams) =>
    apiClient.get<DocumentListData>(serviceDocumentPath, { params }),

  /** GET /documents/:documentId (public detail) */
  getPublicById: (documentId: number | string) =>
    apiClient.get<Document>(`${serviceDocumentPath}/${documentId}`),

  /**
   * GET /documents (list — admin & public share the same route).
   * Server uses `optionalAuth` + `canViewInternal(actor)` to return non-public
   * items when the caller has `documents:read`. `/admin/documents` list does
   * NOT exist on the server.
   */
  getAll: (params?: DocumentListParams) =>
    apiClient.get<DocumentListData>(serviceAdminDocumentPath, { params }),

  /** GET /admin/cms/documents/:documentId */
  getById: (documentId: number | string) =>
    apiClient.get<Document>(`${serviceAdminDocumentPath}/${documentId}`),

  /**
   * POST /admin/cms/documents with a committed storage object ID.
   */
  create: async (data: FormData | {
    title: string
    documentCode: string
    issuingAgency: string
    issuedAt?: string
    description?: string
    visibility: 'public' | 'internal'
    fileObjectId: number | string
  }) => {
    if (!(data instanceof FormData)) return apiClient.post<Document>(serviceAdminDocumentPath, data)

    const file = data.get('file_url')
    if (!(file instanceof File)) throw new Error('Vui lòng chọn tệp tài liệu để tải lên.')
    const fileObjectId = await storageService.upload(file, 'documents')
    const value = (key: string) => {
      const entry = data.get(key)
      return typeof entry === 'string' ? entry : undefined
    }
    return apiClient.post<Document>(serviceAdminDocumentPath, {
      title: value('title') ?? '',
      documentCode: value('documentCode') ?? value('document_number') ?? '',
      issuingAgency: value('issuingAgency') ?? value('issuer') ?? '',
      issuedAt: value('issuedAt') ?? value('issued_date') ?? undefined,
      description: value('description') || undefined,
      visibility: value('visibility') === 'internal' || value('is_public') === 'false' ? 'internal' : 'public',
      fileObjectId,
    })
  },

  /** This legacy PATCH is not in the supplied API collection. */
  patch: async (_documentId: number | string, _data: PatchDocumentBody) => {
    throw new Error('API hiện tại không hỗ trợ cập nhật tài liệu; chỉ tạo, xem và xóa.')
  },

  /**
   * The supplied collection has no document update route. Fail before making
   * an invalid network request instead of falling back to the retired PUT API.
   */
  update: async (_documentId: number | string, _data: UpdateDocumentBody) => {
    throw new Error('API hiện tại không hỗ trợ cập nhật tài liệu; chỉ tạo, xem và xóa.')
  },

  /** DELETE /admin/cms/documents/:documentId?expectedUpdatedAt= */
  delete: (documentId: number | string, expectedUpdatedAt: string) => {
    if (!expectedUpdatedAt) return Promise.reject(new Error('Missing expectedUpdatedAt from the current record.'))
    return apiClient.del<ApiResponse<{}>>(`${serviceAdminDocumentPath}/${documentId}`, undefined, {
      params: { expectedUpdatedAt },
    })
  },
}
