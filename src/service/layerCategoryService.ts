import apiClient from './common/apiClient'
import type { ApiResponse, LayerCategory } from '@/types/api'
import { serviceMapLayerPath } from '@/constant/serviceConstant'
import {
  createLayerCategoryBodySchema,
  layerCategoryItemSchema,
  layerCategoryListSchema,
} from './layerCategorySchema'

const layerCategoryService = {
  /**
   * GET /admin/layers/categories
   * Lấy danh sách toàn bộ danh mục lớp bản đồ có sẵn từ server, có hỗ trợ tìm kiếm.
   */
  getAll: async (params?: { search?: string }): Promise<ApiResponse<LayerCategory[]>> => {
    const queryParams = params?.search?.trim() ? { search: params.search.trim() } : undefined
    const response = await (queryParams
      ? apiClient.get<unknown>(`${serviceMapLayerPath}/categories`, { params: queryParams })
      : apiClient.get<unknown>(`${serviceMapLayerPath}/categories`))
    const parsed = layerCategoryListSchema.safeParse(response.data)
    if (!parsed.success) {
      console.warn('Dữ liệu danh mục không khớp schema:', parsed.error.issues)
    }
    return {
      ...response,
      data: parsed.success ? parsed.data : [],
    }
  },

  /**
   * POST /admin/layers/categories
   * Tạo một danh mục lớp bản đồ mới.
   */
  create: async (name: string): Promise<ApiResponse<LayerCategory>> => {
    const validatedBody = createLayerCategoryBodySchema.parse({ name })
    const response = await apiClient.post<unknown>(
      `${serviceMapLayerPath}/categories`,
      validatedBody
    )
    const parsed = layerCategoryItemSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error('Dữ liệu danh mục trả về từ máy chủ không hợp lệ.')
    }
    return {
      ...response,
      data: parsed.data,
    }
  },

  /**
   * DELETE /admin/layers/categories/:key
   * Xóa một danh mục lớp bản đồ không còn lớp nào sử dụng.
   */
  delete: async (key: string): Promise<ApiResponse<{ key: string }>> => {
    const response = await apiClient.del<unknown>(
      `${serviceMapLayerPath}/categories/${encodeURIComponent(key)}`
    )
    return {
      ...response,
      data: { key },
    }
  },
}

export default layerCategoryService
