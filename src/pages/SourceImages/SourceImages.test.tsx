import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import SourceImagesPage from './index'
import { useAuthStore } from '@/stores/common/useAuthStore'
import { renderWithProviders } from '@/test/renderWithProviders'
import type { SatelliteImageMember } from '@/types/api'

const mocks = vi.hoisted(() => ({
  listImages: vi.fn(),
  publishImage: vi.fn(),
  updateCoverageKey: vi.fn(),
  deleteImage: vi.fn(),
  getCleanupStatus: vi.fn(),
  retryCleanup: vi.fn(),
}))

vi.mock('@/service', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/service')>(),
  remoteSensingService: {
    listImages: mocks.listImages,
    publishImage: mocks.publishImage,
    updateCoverageKey: mocks.updateCoverageKey,
    deleteImage: mocks.deleteImage,
  },
  mapLayerService: {
    getCleanupStatus: mocks.getCleanupStatus,
    retryCleanup: mocks.retryCleanup,
    getTimeSeriesCatalog: vi.fn().mockResolvedValue({ data: { items: [] } }),
  },
}))

const sampleImages: SatelliteImageMember[] = [
  {
    id: 52,
    scene_code: 'test123_1788707877970',
    title: 'Ảnh vệ tinh Cẩm Phả sau ngập',
    platform: 'sentinel-2',
    thematic_group: 'flood',
    coverage_key: 'test123',
    acquired_at: '2025-02-06T00:00:00.000Z',
    product_level: 'GeoTIFF',
    resolution_m: '1.00',
    cloud_cover_percent: '0.00',
    orbit_number: null,
    description: null,
    layer_id: null,
    standalone_layer_id: 110,
    original_name: 'Lop_phu_Cam_Pha_sau_ngap_2022_RGB.tif',
    size_bytes: 1322575,
    created_at: '2026-09-06T15:17:45.861Z',
    updated_at: '2026-09-06T15:17:45.912Z',
    standaloneLayer: {
      id: 110,
      code: 'campha_ngap_2022',
      deletedAt: '2026-09-06T16:00:00.000Z',
      cleanupStatus: 'failed',
    },
    timeSeriesLayer: null,
  },
  {
    id: 53,
    scene_code: 'urban_2024_001',
    title: 'Ảnh đô thị 2024',
    platform: 'landsat-8',
    thematic_group: 'urban',
    coverage_key: 'campha_urban',
    acquired_at: '2024-05-10T00:00:00.000Z',
    product_level: 'GeoTIFF',
    resolution_m: '30.00',
    cloud_cover_percent: '2.50',
    orbit_number: null,
    description: null,
    layer_id: 200,
    standalone_layer_id: null,
    original_name: 'Urban_2024.tif',
    size_bytes: 4500000,
    created_at: '2026-09-06T12:00:00.000Z',
    updated_at: '2026-09-06T12:00:00.000Z',
    standaloneLayer: null,
    timeSeriesLayer: {
      id: 200,
      code: 'campha_urban_ts',
      deletedAt: null,
      cleanupStatus: null,
    },
  },
]

const setAdminUser = () => {
  useAuthStore.setState({
    user: {
      id: 1,
      username: 'admin',
      role: 'system_admin',
      role_permissions: {
        raster: { read: true, create: true, update: true, delete: true },
        layers: { read: true, create: true, update: true, delete: true },
      },
    },
  } as never)
}

describe('SourceImagesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listImages.mockResolvedValue({
      status: 200,
      message: 'OK',
      data: sampleImages,
      metadata: {
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      },
    })
  })

  it('chặn truy cập nếu người dùng không có quyền raster:read', () => {
    useAuthStore.setState({
      user: {
        id: 2,
        username: 'guest',
        role: 'user',
        role_permissions: {
          raster: { read: false },
        },
      },
    } as never)

    renderWithProviders(<SourceImagesPage />)
    expect(screen.getByText(/Bạn không có quyền truy cập kho ảnh nguồn/i)).toBeInTheDocument()
  })

  it('hiển thị danh sách ảnh nguồn GeoTIFF kèm trạng thái lifecycle các lớp', async () => {
    setAdminUser()
    renderWithProviders(<SourceImagesPage />)

    expect(screen.getByText('Kho ảnh nguồn GeoTIFF')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Ảnh vệ tinh Cẩm Phả sau ngập')).toBeInTheDocument()
      expect(screen.getByText('Ảnh đô thị 2024')).toBeInTheDocument()
    })

    // Layer status badges
    expect(screen.getByText(/Dọn lỗi \(campha_ngap_2022\)/i)).toBeInTheDocument()
    expect(screen.getByText('campha_urban_ts')).toBeInTheDocument()
  })

  it('mở dialog chi tiết dọn dẹp khi bấm vào badge dọn lỗi', async () => {
    setAdminUser()
    mocks.getCleanupStatus.mockResolvedValue({
      status: 200,
      message: 'OK',
      data: {
        layerId: 110,
        code: 'campha_ngap_2022',
        cleanupStatus: 'failed',
        canRetry: true,
        job: {
          id: 1,
          status: 'failed',
          attempt: 3,
          maxAttempts: 3,
        },
      },
    })

    renderWithProviders(<SourceImagesPage />)

    await waitFor(() => {
      expect(screen.getByText(/Dọn lỗi \(campha_ngap_2022\)/i)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText(/Dọn lỗi \(campha_ngap_2022\)/i))

    await waitFor(() => {
      expect(screen.getByText('Trạng thái dọn dẹp lớp dữ liệu')).toBeInTheDocument()
      expect(screen.getByText('campha_ngap_2022')).toBeInTheDocument()
      expect(screen.getByText('Thử lại dọn dẹp')).toBeInTheDocument()
    })
  })

  it('mở dialog công bố lại lớp bản đồ độc lập từ ảnh nguồn', async () => {
    setAdminUser()
    renderWithProviders(<SourceImagesPage />)

    await waitFor(() => {
      expect(screen.getByText('Ảnh vệ tinh Cẩm Phả sau ngập')).toBeInTheDocument()
    })

    const republishBtn = screen.getByLabelText('Công bố lại ảnh #52')
    fireEvent.click(republishBtn)

    await waitFor(() => {
      expect(screen.getByText('Công bố lớp bản đồ độc lập')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Ảnh vệ tinh Cẩm Phả sau ngập')).toBeInTheDocument()
    })
  })

  it('mở dialog xóa ảnh và cho phép chọn xóa kèm tệp lưu trữ', async () => {
    setAdminUser()
    renderWithProviders(<SourceImagesPage />)

    await waitFor(() => {
      expect(screen.getByText('Ảnh vệ tinh Cẩm Phả sau ngập')).toBeInTheDocument()
    })

    const deleteBtn = screen.getByLabelText('Xóa ảnh #52')
    fireEvent.click(deleteBtn)

    await waitFor(() => {
      expect(screen.getByText(/Xóa ảnh nguồn GeoTIFF/i)).toBeInTheDocument()
      expect(screen.getByText(/Chỉ xóa bản ghi thông tin/i)).toBeInTheDocument()
      expect(screen.getByText(/Xóa bản ghi VÀ yêu cầu xóa tệp lưu trữ GeoTIFF/i)).toBeInTheDocument()
    })
  })
})
