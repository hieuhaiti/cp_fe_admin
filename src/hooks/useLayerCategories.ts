import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { layerCategoryService } from '@/service'
import type { LayerCategory } from '@/types/api'

export const LAYER_CATEGORIES_QUERY_KEY = ['mapLayer', 'categories'] as const

export interface UseLayerCategoriesOptions {
  search?: string
  enabled?: boolean
}

export function useLayerCategories(options?: UseLayerCategoriesOptions | string) {
  const queryClient = useQueryClient()
  const searchParam = typeof options === 'string' ? options : options?.search
  const trimmedSearch = searchParam?.trim() || ''
  const isEnabled =
    typeof options === 'object' && options?.enabled !== undefined ? options.enabled : true

  const queryKey = trimmedSearch
    ? ([...LAYER_CATEGORIES_QUERY_KEY, { search: trimmedSearch }] as const)
    : LAYER_CATEGORIES_QUERY_KEY

  const categoriesQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await layerCategoryService.getAll(
        trimmedSearch ? { search: trimmedSearch } : undefined
      )
      return res.data ?? []
    },
    enabled: isEnabled,
    staleTime: 1000 * 60 * 5,
  })

  const createCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await layerCategoryService.create(name)
      if (!res.data) {
        throw new Error('Không nhận được dữ liệu danh mục mới.')
      }
      return res.data
    },
    onSuccess: (newCategory: LayerCategory) => {
      // Cập nhật optimistic cache hoặc invalidate để đồng bộ mọi select đang mở
      queryClient.setQueryData<LayerCategory[]>(LAYER_CATEGORIES_QUERY_KEY, (prev) => {
        const existing = prev ?? []
        if (existing.some((item) => item.key === newCategory.key)) {
          return existing
        }
        return [...existing, newCategory].sort((a, b) =>
          a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' })
        )
      })
      queryClient.invalidateQueries({ queryKey: LAYER_CATEGORIES_QUERY_KEY })
    },
  })

  const deleteCategoryMutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await layerCategoryService.delete(key)
      return res.data?.key ?? key
    },
    onSuccess: (deletedKey: string) => {
      queryClient.setQueryData<LayerCategory[]>(LAYER_CATEGORIES_QUERY_KEY, (prev) => {
        const existing = prev ?? []
        return existing.filter((item) => item.key !== deletedKey)
      })
      queryClient.invalidateQueries({ queryKey: LAYER_CATEGORIES_QUERY_KEY })
    },
  })

  return {
    categories: categoriesQuery.data ?? [],
    isLoading: categoriesQuery.isLoading,
    isFetching: categoriesQuery.isFetching,
    isError: categoriesQuery.isError,
    error: categoriesQuery.error,
    refetch: categoriesQuery.refetch,
    createCategory: createCategoryMutation.mutateAsync,
    isCreating: createCategoryMutation.isPending,
    createError: createCategoryMutation.error,
    deleteCategory: deleteCategoryMutation.mutateAsync,
    isDeleting: deleteCategoryMutation.isPending,
    deleteError: deleteCategoryMutation.error,
  }
}

export default useLayerCategories
