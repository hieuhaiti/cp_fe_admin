import apiClient from './common/apiClient'
import type { ApiResponse, RemoteImage, RemoteImageListData, RemoteImageListParams } from '@/types/api'
import { serviceRemoteSensingPath, serviceAdminRemoteSensingPath } from '@/constant/serviceConstant'

type CreateRemoteSensingImageBody = {
  sceneCode: string
  title: string
  platform: string
  thematicGroup: string
  coverageKey: string
  acquiredAt: string
  productLevel: string
  resolutionM: number
  cloudCoverPercent: number
  fileObjectId: number | string
}

type PatchRemoteSensingCategoryBody = {
  thematicGroup: string
  expectedUpdatedAt: string
}

type PublishRemoteSensingImageBody = {
  code: string
  nameVi: string
  category: string
  srid: number
  minZoom?: number | null
  maxZoom?: number | null
  legendConfig?: Record<string, unknown>
  metadata?: Record<string, unknown>
  isPublic?: boolean
}

export default {
  /** GET /remote-sensing/images?page=&limit= */
  listPublicImages: (params?: Pick<RemoteImageListParams, 'page' | 'limit'>) =>
    apiClient.get<RemoteImageListData>(`${serviceRemoteSensingPath}/images`, { params }),

  /** GET /remote-sensing/images/:satelliteImageId */
  getPublicImage: (imageId: number | string) =>
    apiClient.get<RemoteImage>(`${serviceRemoteSensingPath}/images/${imageId}`),

  /** GET /remote-sensing/compare?beforeId=&afterId= */
  compare: (beforeId: number | string, afterId: number | string) =>
    apiClient.get(`${serviceRemoteSensingPath}/compare`, { params: { beforeId, afterId } }),

  /** GET /remote-sensing/images/:satelliteImageId/download-url?expireSeconds= */
  getDownloadUrl: (imageId: number | string, expireSeconds = 300) =>
    apiClient.get(`${serviceRemoteSensingPath}/images/${imageId}/download-url`, {
      params: { expireSeconds },
    }),

  /** GET /admin/remote-sensing/images?page=&limit= */
  listImages: (params?: Pick<RemoteImageListParams, 'page' | 'limit'>) =>
    apiClient.get<RemoteImageListData>(`${serviceAdminRemoteSensingPath}/images`, { params }),

  /** POST /admin/remote-sensing/images */
  createImage: (data: CreateRemoteSensingImageBody) =>
    apiClient.post<RemoteImage>(`${serviceAdminRemoteSensingPath}/images`, data),

  /** POST /admin/remote-sensing/images/:id/publish — uploads the GeoTIFF to GeoServer and creates a map layer. */
  publishImage: (imageId: number | string, data: PublishRemoteSensingImageBody) =>
    apiClient.post(`${serviceAdminRemoteSensingPath}/images/${imageId}/publish`, data),

  /** PATCH /admin/remote-sensing/images/:satelliteImageId/category */
  updateCategory: (imageId: number | string, data: PatchRemoteSensingCategoryBody) =>
    apiClient.patch<RemoteImage>(`${serviceAdminRemoteSensingPath}/images/${imageId}/category`, data),

  /** DELETE /admin/remote-sensing/images/:satelliteImageId?expectedUpdatedAt= */
  deleteImage: (imageId: number | string, expectedUpdatedAt: string) =>
    apiClient.del<ApiResponse<{}>>(`${serviceAdminRemoteSensingPath}/images/${imageId}`, undefined, {
      params: { expectedUpdatedAt },
    }),
}
