import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { remoteSensingService, mapLayerService } from '@/service'
import type { SatelliteImageMember, Pagination, SatelliteImageListData } from '@/types/api'
import type { ListSatelliteImagesParams, PublishRemoteSensingImageBody } from '@/service/remoteSensingService'

export function useSourceImages(params: ListSatelliteImagesParams = {}) {
  const queryClient = useQueryClient()
  const queryKey = ['admin', 'sourceImages', params]

  const imagesQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await remoteSensingService.listImages(params)
      const rawData = response.data as unknown as SatelliteImageListData | SatelliteImageMember[] | undefined
      const items: SatelliteImageMember[] = Array.isArray(rawData)
        ? rawData
        : Array.isArray(rawData?.items)
        ? rawData.items
        : []
      const pagination = (response.metadata ?? (rawData as any)?.pagination) as Pagination | undefined
      const total = pagination?.total ?? items.length
      return { items, total }
    },
    staleTime: 5000,
  })

  const invalidateRelated = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'sourceImages'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'collections'] }),
      queryClient.invalidateQueries({ queryKey: ['webMap', 'timeSeriesLayers'] }),
      queryClient.invalidateQueries({ queryKey: ['mapLayers'] }),
    ])
  }

  const republishMutation = useMutation({
    mutationFn: async ({
      imageId,
      data,
    }: {
      imageId: number | string
      data: PublishRemoteSensingImageBody
    }) => {
      return remoteSensingService.publishImage(imageId, data)
    },
    onSuccess: invalidateRelated,
  })

  const updateCoverageKeyMutation = useMutation({
    mutationFn: async ({
      imageId,
      coverageKey,
    }: {
      imageId: number | string
      coverageKey: string
    }) => {
      return remoteSensingService.updateCoverageKey(imageId, coverageKey)
    },
    onSuccess: invalidateRelated,
  })

  const deleteImageMutation = useMutation({
    mutationFn: async ({
      imageId,
      expectedUpdatedAt,
      deleteFiles,
    }: {
      imageId: number | string
      expectedUpdatedAt: string
      deleteFiles?: boolean
    }) => {
      return remoteSensingService.deleteImage(imageId, expectedUpdatedAt, deleteFiles)
    },
    onSuccess: invalidateRelated,
  })

  const retryCleanupMutation = useMutation({
    mutationFn: async (layerId: number | string) => {
      return mapLayerService.retryCleanup(layerId)
    },
    onSuccess: invalidateRelated,
  })

  return {
    items: imagesQuery.data?.items ?? [],
    total: imagesQuery.data?.total ?? 0,
    isLoading: imagesQuery.isLoading,
    isError: imagesQuery.isError,
    error: imagesQuery.error,
    refetch: imagesQuery.refetch,
    republish: republishMutation.mutateAsync,
    isRepublishing: republishMutation.isPending,
    updateCoverageKey: updateCoverageKeyMutation.mutateAsync,
    isUpdatingCoverageKey: updateCoverageKeyMutation.isPending,
    deleteImage: deleteImageMutation.mutateAsync,
    isDeletingImage: deleteImageMutation.isPending,
    retryCleanup: retryCleanupMutation.mutateAsync,
    isRetryingCleanup: retryCleanupMutation.isPending,
  }
}
