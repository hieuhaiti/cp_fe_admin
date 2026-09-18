import { beforeEach, describe, expect, it, vi } from 'vitest'
import apiClient from './common/apiClient'
import layerCategoryService from './layerCategoryService'

vi.mock('./common/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

describe('layerCategoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAll', () => {
    it('returns parsed list of categories on valid response', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        status: 200,
        message: 'Thành công',
        data: [
          { id: 1, key: 'flood', name: 'Ngập lụt' },
          { id: 2, key: 'forest', name: 'Rừng' },
        ],
      })

      const res = await layerCategoryService.getAll()
      expect(res.data).toEqual([
        { id: 1, key: 'flood', name: 'Ngập lụt' },
        { id: 2, key: 'forest', name: 'Rừng' },
      ])
      expect(apiClient.get).toHaveBeenCalledWith('/admin/layers/categories')
    })

    it('passes search param to apiClient when search is provided', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        status: 200,
        message: 'Thành công',
        data: [{ id: 1, key: 'flood', name: 'Ngập lụt' }],
      })

      const res = await layerCategoryService.getAll({ search: 'ngap' })
      expect(res.data).toEqual([{ id: 1, key: 'flood', name: 'Ngập lụt' }])
      expect(apiClient.get).toHaveBeenCalledWith('/admin/layers/categories', {
        params: { search: 'ngap' },
      })
    })

    it('returns empty array when response data does not match category schema', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        status: 200,
        message: 'Thành công',
        data: 'not an array',
      })

      const res = await layerCategoryService.getAll()
      expect(res.data).toEqual([])
    })
  })

  describe('create', () => {
    it('validates name input and returns created category', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        status: 201,
        message: 'Tạo thành công',
        data: {
          id: 5,
          key: 'ngap_ven_bien',
          name: 'Ngập ven biển',
        },
      })

      const res = await layerCategoryService.create('  Ngập ven biển  ')
      expect(res.data).toEqual({
        id: 5,
        key: 'ngap_ven_bien',
        name: 'Ngập ven biển',
      })
      expect(apiClient.post).toHaveBeenCalledWith('/admin/layers/categories', {
        name: 'Ngập ven biển',
      })
    })

    it('rejects empty or too short category name before network request', async () => {
      await expect(layerCategoryService.create(' ')).rejects.toThrow()
      await expect(layerCategoryService.create('a')).rejects.toThrow()
      expect(apiClient.post).not.toHaveBeenCalled()
    })

    it('throws error when server response is missing required category fields', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        status: 201,
        message: 'Tạo thành công',
        data: { id: 5 }, // missing key and name
      })

      await expect(layerCategoryService.create('Quy hoạch mới')).rejects.toThrow(
        'Dữ liệu danh mục trả về từ máy chủ không hợp lệ'
      )
    })
  })
})
