import { beforeEach, describe, expect, it, vi } from 'vitest'
import apiClient from './common/apiClient'
import mapLayerApiService, { toCanonicalCreateBody } from './mapLayerApiService'
import type { CreateMapApiBody } from '@/types/api'

vi.mock('./common/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
  },
}))

const payload: CreateMapApiBody = {
  layer_id: 94,
  layerId: 94,
  slug: 'testabc',
  name: 'testABC',
  readFields: ['fid_xoa02', 'i'],
  writeFields: [],
  searchFields: ['fid_xoa02'],
  allowedMethods: ['GET'],
  defaultSortField: 'fid_xoa02',
  scope: { read: true, rate_per_min: 75 },
}

const existingRegistry = {
  id: 12,
  layer_id: 94,
  slug: 'api-duong-ranh-gioi',
  name: 'API Đường ranh giới',
}

const issuedKey = {
  id: 'key-1',
  token: 'share-token',
}

describe('mapLayerApiService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createKeyForLayer', () => {
    it('reuses an existing layer registry and issues a new key without recreating it', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        status: 200,
        message: 'Lấy danh sách thành công',
        data: { items: [existingRegistry] },
      })
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        status: 201,
        message: 'Cấp khóa chia sẻ thành công',
        data: issuedKey,
      })

      const response = await mapLayerApiService.createKeyForLayer(payload)

      expect(apiClient.get).toHaveBeenCalledWith('/admin/api-registry', {
        params: { layer_id: 94, page: 1, limit: 10 },
      })
      expect(apiClient.post).toHaveBeenCalledTimes(1)
      expect(apiClient.post).toHaveBeenCalledWith('/admin/api-registry/12/keys', {
        name: 'testABC',
        consumer: 'testABC',
        scopes: ['features:read'],
        quotaPerMinute: 75,
        expiresInHours: 720,
      })
      expect(response.data).toEqual({ ...issuedKey, api: existingRegistry })
    })

    it('creates a missing registry before issuing its key', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        status: 200,
        message: 'Lấy danh sách thành công',
        data: { items: [] },
      })
      vi.mocked(apiClient.post)
        .mockResolvedValueOnce({
          status: 201,
          message: 'Tạo API lớp thành công',
          data: { ...existingRegistry, id: 21 },
        })
        .mockResolvedValueOnce({
          status: 201,
          message: 'Cấp khóa chia sẻ thành công',
          data: issuedKey,
        })

      await mapLayerApiService.createKeyForLayer(payload)

      expect(apiClient.post).toHaveBeenNthCalledWith(
        1,
        '/admin/api-registry',
        expect.objectContaining({
          layerId: 94,
          slug: 'testabc',
          readFields: ['fid_xoa02', 'i'],
          searchFields: ['fid_xoa02'],
        })
      )
      expect(apiClient.post).toHaveBeenNthCalledWith(
        2,
        '/admin/api-registry/21/keys',
        expect.objectContaining({ name: 'testABC' })
      )
    })

    it('recovers from a concurrent REGISTRY_CONFLICT by reloading the layer registry', async () => {
      vi.mocked(apiClient.get)
        .mockResolvedValueOnce({
          status: 200,
          message: 'Lấy danh sách thành công',
          data: { items: [] },
        })
        .mockResolvedValueOnce({
          status: 200,
          message: 'Lấy danh sách thành công',
          data: { items: [existingRegistry] },
        })
      vi.mocked(apiClient.post)
        .mockRejectedValueOnce({
          status: 409,
          body: { errors: ['REGISTRY_CONFLICT'] },
        })
        .mockResolvedValueOnce({
          status: 201,
          message: 'Cấp khóa chia sẻ thành công',
          data: issuedKey,
        })

      const response = await mapLayerApiService.createKeyForLayer(payload)

      expect(apiClient.get).toHaveBeenCalledTimes(2)
      expect(apiClient.post).toHaveBeenLastCalledWith(
        '/admin/api-registry/12/keys',
        expect.objectContaining({ scopes: ['features:read'] })
      )
      expect(response.data?.token).toBe('share-token')
    })
  })

  describe('issueKey and getUsage', () => {
    it('issues key with correct payload to registry', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        status: 201,
        message: 'Thành công',
        data: issuedKey,
      })

      const res = await mapLayerApiService.issueKey(12, {
        name: 'New Key',
        consumer: 'VNPT',
        quotaPerMinute: 120,
        expiresInHours: 168,
      })

      expect(apiClient.post).toHaveBeenCalledWith('/admin/api-registry/12/keys', {
        name: 'New Key',
        consumer: 'VNPT',
        scopes: ['features:read'],
        quotaPerMinute: 120,
        expiresInHours: 168,
      })
      expect(res.data).toEqual(issuedKey)
    })

    it('fetches usage stats for registry', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        status: 200,
        message: 'Thành công',
        data: {
          summary: { calls: 10, errors: 0, quota_rejections: 0, avg_duration_ms: '50.00' },
          byKey: [],
        },
      })

      const res = await mapLayerApiService.getUsage(12)
      expect(apiClient.get).toHaveBeenCalledWith('/admin/api-registry/12/usage', { params: undefined })
      expect(res.data?.summary.calls).toBe(10)
    })
  })

  describe('toCanonicalCreateBody', () => {
    it('keeps canonical registry fields unique', () => {
      const canonical = toCanonicalCreateBody({
        ...payload,
        readFields: ['fid_xoa02', 'fid_xoa02', 'i'],
        searchFields: ['fid_xoa02', 'fid_xoa02'],
      })

      expect(canonical.readFields).toEqual(['fid_xoa02', 'i'])
      expect(canonical.searchFields).toEqual(['fid_xoa02'])
    })
  })
})