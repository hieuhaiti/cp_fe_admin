import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import TimeSeriesPage from './index'
import TimeSeriesDetailDialog from './TimeSeriesDetailDialog'
import TimeSeriesCreateDialog from './TimeSeriesCreateDialog'
import TimeSeriesEditDialog from './TimeSeriesEditDialog'
import TimeSeriesDeleteDialog from './TimeSeriesDeleteDialog'
import { useAuthStore } from '@/stores/common/useAuthStore'
import { renderWithProviders } from '@/test/renderWithProviders'

const mocks = vi.hoisted(() => ({
  getTimeSeriesCatalog: vi.fn(),
  getById: vi.fn(),
  patch: vi.fn(),
  update: vi.fn(),
  deleteLayer: vi.fn(),
  publishCollection: vi.fn(),
  listImages: vi.fn(),
  mergeCollections: vi.fn(),
  updateCoverageKey: vi.fn(),
}))

const sampleApiResData = [
  {
    id: '174',
    code: 'lop_phu_do_thi_ts',
    nameVi: 'Lớp phủ đô thị Cẩm Phả (2001-2024)',
    category: 'land_cover',
    categoryName: 'Lớp phủ mặt đất',
    geometryType: 'RASTER',
    storageKind: 'geotiff_minio',
    srid: 32648,
    geoserverLayer: 'campha:lop_phu_do_thi_ts',
    minZoom: 8,
    maxZoom: 18,
    isPublic: true,
    isEnableDefault: false,
    timeSeries: {
      enabled: true,
      coverageKey: 'lop_phu_do_thi',
      mode: 'discrete',
      defaultTime: '2024-01-01T00:00:00.000Z',
      values: [
        '2001-01-01T00:00:00.000Z',
        '2002-01-01T00:00:00.000Z',
        '2024-01-01T00:00:00.000Z',
      ],
      members: [
        {
          imageId: 22,
          sceneCode: 'CP-DO-THI-2001',
          acquiredAt: '2001-01-01T00:00:00.000Z',
          fileObjectId: 166,
        },
        {
          imageId: 23,
          sceneCode: 'CP-DO-THI-2002',
          acquiredAt: '2002-01-01T00:00:00.000Z',
          fileObjectId: 167,
        },
        {
          imageId: 45,
          sceneCode: 'CP-DO-THI-2024',
          acquiredAt: '2024-01-01T00:00:00.000Z',
          fileObjectId: 189,
        },
      ],
    },
  },
  {
    id: '173',
    code: 'lop_phu_sau_ngap_ts',
    nameVi: 'Lớp phủ sau ngập Cẩm Phả (2015-2024)',
    category: 'flood_event',
    categoryName: 'Hiện trạng ngập theo sự kiện',
    geometryType: 'RASTER',
    storageKind: 'geotiff_minio',
    srid: 32648,
    geoserverLayer: 'campha:lop_phu_sau_ngap_ts',
    minZoom: 8,
    maxZoom: 18,
    isPublic: true,
    timeSeries: {
      enabled: true,
      coverageKey: 'lop_phu_sau_ngap',
      mode: 'discrete',
      defaultTime: '2024-01-01T00:00:00.000Z',
      values: ['2015-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'],
      members: [
        {
          imageId: 17,
          sceneCode: 'CP-SAU-NGAP-2015',
          acquiredAt: '2015-01-01T00:00:00.000Z',
          fileObjectId: 161,
        },
      ],
    },
  },
]

const availableImages = [
  {
    id: 45,
    scene_code: 'CP-DO-THI-2024',
    title: 'Lớp phủ đô thị 2024',
    platform: 'sentinel-2',
    thematic_group: 'land_cover',
    coverage_key: 'lop_phu_do_thi',
    acquired_at: '2024-01-01T00:00:00.000Z',
    created_at: '2023-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 22,
    scene_code: 'CP-DO-THI-2001',
    title: 'Lớp phủ đô thị 2001',
    platform: 'sentinel-2',
    thematic_group: 'land_cover',
    coverage_key: 'lop_phu_do_thi',
    acquired_at: '2001-01-01T00:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 48,
    scene_code: 'test1_1',
    title: 'Test',
    platform: 'sentinel-2',
    thematic_group: 'test',
    coverage_key: 'test1',
    acquired_at: '2026-09-06T00:00:00.000Z',
    created_at: '2026-09-06T00:00:00.000Z',
    updated_at: '2026-09-06T00:00:00.000Z',
  },
  {
    id: 49,
    scene_code: 'test1_2',
    title: 'Test',
    platform: 'sentinel-2',
    thematic_group: 'test',
    coverage_key: 'test1',
    acquired_at: '2026-09-06T00:00:00.000Z',
    created_at: '2026-09-06T00:00:00.000Z',
    updated_at: '2026-09-06T00:00:00.000Z',
  },
  {
    id: 51,
    scene_code: 'test12_1',
    title: 'Test',
    platform: 'sentinel-2',
    thematic_group: 'test',
    coverage_key: 'test12',
    acquired_at: '2025-02-06T00:00:00.000Z',
    created_at: '2026-09-06T00:00:00.000Z',
    updated_at: '2026-09-06T00:00:00.000Z',
  },
]

vi.mock('@/service', () => ({
  remoteSensingService: {
    publishCollection: mocks.publishCollection,
    listImages: mocks.listImages,
    mergeCollections: mocks.mergeCollections,
    updateCoverageKey: mocks.updateCoverageKey,
  },
  mapLayerService: {
    getTimeSeriesCatalog: mocks.getTimeSeriesCatalog,
    getById: mocks.getById,
    patch: mocks.patch,
    update: mocks.update,
    delete: mocks.deleteLayer,
  },
  useApiQuery: vi.fn((_key, queryFn, options) => {
    if (options?.enabled === false) {
      return {
        data: undefined,
        isLoading: false,
        isFetching: false,
        isError: false,
        refetch: vi.fn(),
      }
    }
    return {
      data: {
        message: 'Lấy dữ liệu thành công',
        status: 200,
        data: String(_key).includes('imagesForTimeSeries')
          ? { items: availableImages }
          : sampleApiResData,
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
      queryFn,
    }
  }),
}))

const setAdmin = () => {
  useAuthStore.setState({
    user: {
      id: 1,
      username: 'admin',
      role: 'system_admin',
      role_permissions: {
        raster: { read: true, create: true, delete: true },
        layers: { read: true, create: true, update: true, delete: true },
      },
    },
  } as never)
}

describe('TimeSeriesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listImages.mockResolvedValue({
      status: 200,
      data: { items: availableImages },
      metadata: { page: 1, limit: 100, total: availableImages.length, totalPages: 1 },
    })
    mocks.publishCollection.mockResolvedValue({
      status: 200,
      data: {
        coverageKey: 'lop_phu_do_thi',
        layer: {
          id: 174,
          code: 'lop_phu_do_thi_ts',
          updatedAt: '2026-08-30T00:00:00.000Z',
        },
        geoserverLayer: 'campha:lop_phu_do_thi_ts',
        imageIds: [22, 45],
        fileObjectIds: [166, 189],
        timeSeries: sampleApiResData[0].timeSeries,
      },
    })
    mocks.patch.mockResolvedValue({ status: 200, data: {} })
  })

  it('hiển thị catalog theo contract và mô tả tự động tổng hợp', () => {
    setAdmin()
    renderWithProviders(<TimeSeriesPage />)

    expect(screen.getByText('Quản lý lớp dữ liệu theo thời gian')).toBeInTheDocument()
    expect(screen.getByText(/tổng hợp các ảnh cùng nhóm thành lớp dữ liệu theo thời gian/)).toBeInTheDocument()
    expect(screen.getAllByText('lop_phu_do_thi_ts').length).toBeGreaterThan(0)
    expect(screen.getByText('Mã nhóm')).toBeInTheDocument()
    expect(screen.getByText('lop_phu_do_thi')).toBeInTheDocument()
    expect(screen.getByText('3 mốc')).toBeInTheDocument()
    expect(screen.getByText('Tổng hợp lớp chuỗi thời gian')).toBeInTheDocument()
    expect(screen.queryByText(/Kiến trúc Chuỗi Thời gian/)).not.toBeInTheDocument()
  })

  it('chỉ cần chọn nhóm và gửi đúng publish collection; mốc mặc định theo acquired_at mới nhất', async () => {
    renderWithProviders(
      <TimeSeriesCreateDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />
    )

    expect(screen.getByText('Tạo lớp dữ liệu chuỗi thời gian')).toBeInTheDocument()
    expect(screen.getByText(/gom toàn bộ ảnh cùng nhóm/)).toBeInTheDocument()
    expect(screen.getByText(/Mốc mặc định là ảnh có ngày thu nhận mới nhất/)).toBeInTheDocument()
    expect(screen.queryByText(/Tải lên tệp GeoTIFF mới/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Tên hiển thị lớp/)).not.toBeInTheDocument()

    fireEvent.click(await screen.findByRole('option', { name: 'Chọn nhóm lop_phu_do_thi' }))

    expect(screen.getByLabelText(/Tên lớp hiển thị/)).toHaveValue('Lớp phủ mặt đất (2001-2024)')
    expect(screen.getByLabelText(/Mã lớp chuỗi thời gian/)).toHaveValue('lop_phu_do_thi_ts')
    expect(screen.getByText('Ảnh cùng nhóm')).toBeInTheDocument()
    expect(screen.getByText('Mốc thời gian duy nhất')).toBeInTheDocument()
    expect(screen.getByText('Các mốc sẽ được tổng hợp')).toBeInTheDocument()
    expect(screen.getAllByText(/2024/).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: /Tổng hợp và công bố/ }))

    await waitFor(() => {
      expect(mocks.publishCollection).toHaveBeenCalledWith('lop_phu_do_thi', {
        code: 'lop_phu_do_thi_ts',
        nameVi: 'Lớp phủ mặt đất (2001-2024)',
        category: 'land_cover',
        srid: 32648,
        minZoom: 0,
        maxZoom: 22,
        isPublic: false,
      })
    })
  })

  it('gom theo coverage_key, ẩn nhóm một ảnh và chặn nhóm trùng mốc thu nhận', async () => {
    renderWithProviders(
      <TimeSeriesCreateDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />
    )

    expect(await screen.findByText('2 nhóm dữ liệu')).toBeInTheDocument()
    expect(screen.getByText('test1')).toBeInTheDocument()
    expect(screen.queryByText('test12')).not.toBeInTheDocument()
    expect(screen.getByText('1 cần kiểm tra')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Hiện 1 nhóm chỉ có 1 ảnh/ }))
    expect(screen.getByText('test12')).toBeInTheDocument()

    const duplicateGroup = screen.getByRole('option', { name: 'Chọn nhóm test1' })
    expect(within(duplicateGroup).getByText(/2 ảnh/)).toBeInTheDocument()
    expect(within(duplicateGroup).getByText('Trùng mốc')).toBeInTheDocument()
    fireEvent.click(duplicateGroup)

    expect(screen.getByRole('alert')).toHaveTextContent('Chưa thể tổng hợp nhóm này')
    expect(screen.getByRole('alert')).toHaveTextContent('1 ảnh dư tại 1 mốc trùng')
    expect(screen.getAllByRole('button', { name: /Xóa ảnh/ }).length).toBe(2)
    expect(screen.getByRole('button', { name: /Tổng hợp và công bố/ })).toBeDisabled()
    expect(mocks.publishCollection).not.toHaveBeenCalled()
  })

  it('cho phép gộp nhóm ảnh sang một chuỗi thời gian khác', async () => {
    mocks.mergeCollections.mockResolvedValue({
      status: 200,
      data: { updatedCount: 1, targetCoverageKey: 'lop_phu_do_thi' },
    })
    renderWithProviders(
      <TimeSeriesCreateDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />
    )

    fireEvent.click(screen.getByRole('button', { name: /Hiện 1 nhóm chỉ có 1 ảnh/ }))
    fireEvent.click(screen.getByRole('option', { name: 'Chọn nhóm test12' }))

    expect(screen.getByText('Nhóm chỉ có 1 ảnh mốc thời gian')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Gộp vào nhóm khác…/ }))

    expect(screen.getByText(/Gộp tất cả 1 ảnh của nhóm này vào nhóm chuỗi khác/)).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText(/Chọn hoặc nhập mã nhóm đích/), {
      target: { value: 'lop_phu_do_thi' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận gộp' }))

    await waitFor(() => {
      expect(mocks.mergeCollections).toHaveBeenCalledWith(['test12'], 'lop_phu_do_thi')
    })
  })

  it('detail giải thích mốc mặc định là acquired_at mới nhất', () => {
    renderWithProviders(
      <TimeSeriesDetailDialog open onOpenChange={vi.fn()} layer={sampleApiResData[0] as never} />
    )

    expect(screen.getByText('Chi tiết lớp dữ liệu chuỗi thời gian')).toBeInTheDocument()
    expect(screen.getByText('Mã nhóm chuỗi:')).toBeInTheDocument()
    expect(screen.getByText('lop_phu_do_thi')).toBeInTheDocument()
    expect(screen.getByText('CP-DO-THI-2001')).toBeInTheDocument()
    expect(screen.getByText(/Mặc định \(mốc thu nhận mới nhất\)/)).toBeInTheDocument()
  })

  it('edit giải thích category không thay đổi coverage_key', () => {
    renderWithProviders(
      <TimeSeriesEditDialog
        open
        onOpenChange={vi.fn()}
        layer={sampleApiResData[0] as never}
        onSuccess={vi.fn()}
      />
    )

    expect(screen.getByText('Chỉnh sửa lớp dữ liệu chuỗi thời gian')).toBeInTheDocument()
    expect(screen.getByText(/chỉ thay đổi cách phân loại hiển thị/)).toBeInTheDocument()
    expect(screen.getByText('lop_phu_do_thi_ts')).toBeInTheDocument()
  })

  it('delete mô tả đúng việc gỡ lớp và bảo toàn ảnh nguồn', () => {
    renderWithProviders(
      <TimeSeriesDeleteDialog
        open
        onOpenChange={vi.fn()}
        layer={sampleApiResData[0] as never}
        onSuccess={vi.fn()}
      />
    )

    expect(screen.getByText('Xóa lớp dữ liệu chuỗi thời gian')).toBeInTheDocument()
    expect(screen.getByText(/Lớp dữ liệu sẽ được gỡ khỏi hệ thống bản đồ/)).toBeInTheDocument()
    expect(screen.getByText(/Các ảnh gốc trong Kho ảnh viễn thám vẫn được giữ nguyên/)).toBeInTheDocument()
    expect(within(screen.getByRole('dialog')).getAllByText('lop_phu_do_thi_ts').length).toBeGreaterThan(0)
  })

  it('hiển thị thông báo không có quyền khi thiếu quyền đọc raster', () => {
    useAuthStore.setState({
      user: { id: 2, username: 'citizen', role: 'citizen', role_permissions: {} },
    } as never)

    renderWithProviders(<TimeSeriesPage />)

    expect(
      screen.getByText('Bạn không có quyền truy cập danh mục lớp dữ liệu theo thời gian.')
    ).toBeInTheDocument()
  })
})
