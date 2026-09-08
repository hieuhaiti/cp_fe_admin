import apiClient from './common/apiClient'
import type {
  RemoteImage,
  RemoteImageListData,
  RemoteImageListParams,
  CreateSatelliteImageRequest,
  PublishCollectionRequest,
  PublishCollectionResponse,
  SatelliteImageMember,
  SatelliteImageListData,
  CollectionGroup,
  CollectionGroupListData,
} from '@/types/api'
import {
  serviceRemoteSensingPath,
  serviceAdminRemoteSensingPath,
} from '@/constant/serviceConstant'

export type CreateRemoteSensingImageBody = CreateSatelliteImageRequest

export type PatchRemoteSensingCategoryBody = {
  thematicGroup: string
  expectedUpdatedAt: string
}

export type PublishRemoteSensingImageBody = {
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

export interface ListSatelliteImagesParams {
  page?: number
  limit?: number
  q?: string
  coverageKey?: string
  status?: 'all' | 'unpublished' | 'standalone' | 'time_series' | 'in_use' | 'cleanup_pending' | 'cleanup_failed'
  platform?: string
  thematicGroup?: string
  from?: string
  to?: string
  sort?: 'acquiredAt:asc' | 'acquiredAt:desc'
}

export interface ListCollectionsParams {
  page?: number
  limit?: number
  q?: string
  sort?: 'latestAcquiredAt:desc' | 'latestAcquiredAt:asc' | 'totalImages:desc' | 'totalImages:asc'
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
  listImages: (params?: ListSatelliteImagesParams) =>
    apiClient.get<SatelliteImageListData | SatelliteImageMember[]>(
      `${serviceAdminRemoteSensingPath}/images`,
      { params }
    ),

  /** GET /admin/remote-sensing/collections?page=&limit= */
  listCollections: (params?: ListCollectionsParams) =>
    apiClient.get<CollectionGroupListData | CollectionGroup[]>(
      `${serviceAdminRemoteSensingPath}/collections`,
      { params }
    ),

  /** POST /admin/remote-sensing/images */
  createImage: (data: CreateSatelliteImageRequest) =>
    apiClient.post<SatelliteImageMember>(`${serviceAdminRemoteSensingPath}/images`, data),

  /** POST /admin/remote-sensing/collections/:coverageKey/publish */
  publishCollection: (coverageKey: string, data: PublishCollectionRequest) =>
    apiClient.post<PublishCollectionResponse>(
      `${serviceAdminRemoteSensingPath}/collections/${coverageKey}/publish`,
      data
    ),

  /** POST /admin/remote-sensing/images/:id/publish — single raster layer */
  publishImage: (imageId: number | string, data: PublishRemoteSensingImageBody) =>
    apiClient.post(`${serviceAdminRemoteSensingPath}/images/${imageId}/publish`, data),

  /** PATCH /admin/remote-sensing/images/:satelliteImageId/category */
  updateCategory: (imageId: number | string, data: PatchRemoteSensingCategoryBody) =>
    apiClient.patch<SatelliteImageMember>(
      `${serviceAdminRemoteSensingPath}/images/${imageId}/category`,
      data
    ),

  /** PATCH /admin/remote-sensing/images/:id/coverage-key */
  updateCoverageKey: (imageId: number | string, coverageKey: string) =>
    apiClient.patch<SatelliteImageMember>(
      `${serviceAdminRemoteSensingPath}/images/${imageId}/coverage-key`,
      { coverageKey }
    ),

  /** POST /admin/remote-sensing/collections/merge */
  mergeCollections: (sourceCoverageKeys: string[], targetCoverageKey: string) =>
    apiClient.post<{ updatedCount: number; targetCoverageKey: string }>(
      `${serviceAdminRemoteSensingPath}/collections/merge`,
      { sourceCoverageKeys, targetCoverageKey }
    ),

  /** DELETE /admin/remote-sensing/images/:satelliteImageId?expectedUpdatedAt= */
  deleteImage: (imageId: number | string, expectedUpdatedAt: string, deleteFiles = false) =>
    apiClient.del<Record<string, unknown>>(
      `${serviceAdminRemoteSensingPath}/images/${imageId}`,
      undefined,
      {
        params: { expectedUpdatedAt, deleteFiles },
      }
    ),
}

