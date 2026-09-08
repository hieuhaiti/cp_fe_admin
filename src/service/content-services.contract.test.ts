import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn(), put: vi.fn() }))
const storage = vi.hoisted(() => ({ upload: vi.fn() }))
vi.mock('./common/apiClient', () => ({ default: api }))
vi.mock('./storageService', () => ({ default: storage }))

import documentService from './documentService'
import mapImageService from './mapImageService'
import mapLayerService from './mapLayerService'
import remoteSensingService from './remoteSensingService'

const file = new File(['bytes'], 'map.pdf', { type: 'application/pdf' })

describe('Document/PDF/map layer/remote sensing Admin services', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storage.upload.mockResolvedValue(42)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
  })

  it('maps document public/admin routes and FormData to fileObjectId', async () => {
    await documentService.getPublicList({ page: 1, limit: 10 })
    await documentService.getPublicById(2)
    await documentService.getDownloadUrl(2, 600)
    await documentService.getAll({ page: 1 })
    await documentService.getById(2)
    const form = new FormData(); form.append('file', file); form.append('title', 'Doc'); form.append('documentCode', 'D-1'); form.append('issuingAgency', 'Agency'); form.append('visibility', 'internal')
    await documentService.create(form)
    expect(api.get).toHaveBeenNthCalledWith(1, '/cms/documents', { params: { page: 1, limit: 10 } })
    expect(api.get).toHaveBeenNthCalledWith(3, '/cms/documents/2/download-url', { params: { expireSeconds: 600 } })
    expect(storage.upload).toHaveBeenCalledWith(file, 'documents')
    expect(api.post).toHaveBeenCalledWith('/admin/cms/documents', expect.objectContaining({ title: 'Doc', fileObjectId: 42, visibility: 'internal' }))
  })

  it('enforces document optimistic locking and delete options', async () => {
    expect(() => documentService.update(2, { title: 'x' } as never)).toThrow('Missing expectedUpdatedAt')
    await documentService.update(2, { expectedUpdatedAt: '2026-01-01', title: 'x' })
    await documentService.delete(2, '2026-01-01', true)
    expect(api.patch).toHaveBeenCalledWith('/admin/cms/documents/2', { expectedUpdatedAt: '2026-01-01', title: 'x' })
    expect(api.del).toHaveBeenCalledWith('/admin/cms/documents/2', undefined, { params: { expectedUpdatedAt: '2026-01-01', deleteFiles: true } })
  })

  it('maps PDF map routes and normalizes FormData fields', async () => {
    await mapImageService.getPublicList({ page: 1 })
    await mapImageService.getPublicById('3')
    await mapImageService.getDownloadUrl(3)
    const form = new FormData(); form.append('file', file); form.append('title', 'Map'); form.append('scale', '1:25.000'); form.append('year', '2026'); form.append('region', 'Agency'); form.append('isPublic', 'false')
    await mapImageService.create(form)
    expect(api.get).toHaveBeenNthCalledWith(1, '/cms/pdf-maps', { params: { page: 1 } })
    expect(storage.upload).toHaveBeenCalledWith(file, 'documents')
    expect(api.post).toHaveBeenCalledWith('/admin/cms/pdf-maps', expect.objectContaining({ title: 'Map', scaleLabel: '1:25.000', mapYear: 2026, preparingAgency: 'Agency', visibility: 'internal', fileObjectId: 42 }))
    await expect(mapImageService.updateTranslation(3, 'vi', { title: 'Tên' })).rejects.toThrow('không có endpoint')
    await expect(mapImageService.update(3, { expectedUpdatedAt: 'x' })).rejects.toThrow('Chưa có trường nào thay đổi')
  })

  it('uses the dedicated Time Series Web Map catalog endpoint', async () => {
    api.get.mockResolvedValue({ message: 'ok', status: 200, data: [] })
    await mapLayerService.getTimeSeriesCatalog()
    expect(api.get).toHaveBeenCalledWith('/web-map/time-series-layers')
  })

  it('maps remote sensing create/publish routes without collection reads', async () => {
    await remoteSensingService.listPublicImages({ page: 1, limit: 10 })
    await remoteSensingService.getPublicImage(8)
    await remoteSensingService.compare(1, 2)
    await remoteSensingService.getDownloadUrl(8, 900)
    const body = { sceneCode: 'S1', title: 'Scene', platform: 'S2', thematicGroup: 'flood', coverageKey: 'x', acquiredAt: '2026-01-01', productLevel: 'L2', resolutionM: 10, cloudCoverPercent: 2, fileObjectId: 42 }
    await remoteSensingService.createImage(body)
    await remoteSensingService.publishImage(8, { code: 'r', nameVi: 'Raster', category: 'flood', srid: 4326 })
    await remoteSensingService.publishCollection('cp-urban', {
      code: 'cp_urban_ts', nameVi: 'Lớp phủ đô thị', category: 'urban', srid: 32648,
    })
    expect(api.post).toHaveBeenCalledWith('/admin/remote-sensing/images/8/publish', {
      code: 'r', nameVi: 'Raster', category: 'flood', srid: 4326,
    })
    expect(api.post).toHaveBeenCalledWith('/admin/remote-sensing/collections/cp-urban/publish', {
      code: 'cp_urban_ts', nameVi: 'Lớp phủ đô thị', category: 'urban', srid: 32648,
    })
  })

  it('maps remote sensing update, merge, and delete routes with exact queries and exposes nonexistent remove method', async () => {
    // 1. List admin
    await remoteSensingService.listImages({ page: 1, limit: 20, coverageKey: 'cp-key' })
    expect(api.get).toHaveBeenCalledWith('/admin/remote-sensing/images', {
      params: { page: 1, limit: 20, coverageKey: 'cp-key' },
    })

    // 2. Update category
    await remoteSensingService.updateCategory(8, {
      thematicGroup: 'water',
      expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
    })
    expect(api.patch).toHaveBeenCalledWith('/admin/remote-sensing/images/8/category', {
      thematicGroup: 'water',
      expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
    })

    // 3. Update coverage key
    await remoteSensingService.updateCoverageKey(8, 'target-key')
    expect(api.patch).toHaveBeenCalledWith('/admin/remote-sensing/images/8/coverage-key', {
      coverageKey: 'target-key',
    })

    // 4. Merge collections
    await remoteSensingService.mergeCollections(['src-1', 'src-2'], 'target-key')
    expect(api.post).toHaveBeenCalledWith('/admin/remote-sensing/collections/merge', {
      sourceCoverageKeys: ['src-1', 'src-2'],
      targetCoverageKey: 'target-key',
    })

    // 5. Delete image requires expectedUpdatedAt in query and deleteFiles flag
    await remoteSensingService.deleteImage(8, '2026-01-01T00:00:00.000Z', true)
    expect(api.del).toHaveBeenCalledWith('/admin/remote-sensing/images/8', undefined, {
      params: { expectedUpdatedAt: '2026-01-01T00:00:00.000Z', deleteFiles: true },
    })

    // 6. Contract test verifying that 'remove' DOES NOT EXIST on remoteSensingService!
    // Calling remoteSensingService.remove (as TimeSeriesCreateDialog mistakenly did) causes TypeError
    expect((remoteSensingService as unknown as Record<string, unknown>).remove).toBeUndefined()

    // 7. List collections with pagination and search
    await remoteSensingService.listCollections({ page: 1, limit: 10, q: 'urban' })
    expect(api.get).toHaveBeenCalledWith('/admin/remote-sensing/collections', {
      params: { page: 1, limit: 10, q: 'urban' },
    })
  })

  it('maps layer cleanup status and retry routes with correct IDs and methods', async () => {
    await mapLayerService.getCleanupStatus(42)
    expect(api.get).toHaveBeenCalledWith('/admin/layers/42/cleanup')

    await mapLayerService.retryCleanup(42)
    expect(api.post).toHaveBeenCalledWith('/admin/layers/42/cleanup/retry')
  })
})


