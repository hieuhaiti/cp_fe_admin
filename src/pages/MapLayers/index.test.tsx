/**
 * ============================================================
 * MANUAL TEST SCENARIO — QUẢN LÝ LỚP DỮ LIỆU BẢN ĐỒ (MAP LAYERS)
 * ============================================================
 *
 * [CREATE - Thêm lớp dữ liệu mới & Tải GeoTIFF / GeoJSON]
 * 1. Mở trang Quản lý lớp dữ liệu (/map-layers).
 * 2. Tải lên GeoTIFF:
 *    - Nhấn "Tải GeoTIFF".
 *    - Chọn tệp GeoTIFF (.tif / .tiff, ví dụ: campha-flood-2026.tif).
 *    - Nhập Tên lớp: "Bản đồ ngập lụt đô thị Cẩm Phả 2026".
 *    - Nhập Mã lớp: "campha_flood_2026".
 *    - EPSG: 4326 (hoặc mã EPSG khớp metadata tệp).
 *    - Nhấn "Tải lên và công bố".
 * 3. Nhập GeoJSON:
 *    - Truy cập trang Nhập GeoJSON (/map-layers/import-geojson).
 *    - Tên lớp: "Ranh giới quy hoạch Cẩm Phả".
 *    - Chọn tệp ranh-gioi.geojson.
 *    - Nhấn "Nhập GeoJSON".
 *
 * [READ - Xem danh sách & Chi tiết lớp bản đồ]
 * 1. Tìm kiếm theo tên "Bản đồ ngập" hoặc mã "campha_flood".
 * 2. Lọc theo Trạng thái công bố ("Đã công bố" / "Chưa công bố") và Kiểu hình học ("Polygon", "Line", "Point").
 * 3. Nhấp vào hàng dữ liệu trên bảng.
 * 4. Kỳ vọng: Dialog chi tiết mở ra hiển thị: Tên, Mã, Nhóm, Kiểu hình học, SRID/EPSG, Trạng thái, Chú giải legend.
 *
 * [UPDATE - Chỉnh sửa thông tin & Chú giải Legend]
 * 1. Nhấn nút "Chỉnh sửa" trên hàng lớp bản đồ.
 * 2. Cập nhật Tên hiển thị, Nhóm lớp, Phạm vi (Công khai / Nội bộ).
 * 3. Chỉnh sửa Legend: Chuyển đổi giữa Chế độ trực quan (UI Mode) và Chế độ JSON (JSON Mode), xác minh đồng bộ 2 chiều.
 * 4. Nhấn "Cập nhật".
 *
 * [DELETE - Xóa lớp bản đồ]
 * 1. Nhấn icon "Xóa" trên hàng lớp bản đồ kiểm thử.
 * 2. Xác nhận trên dialog cảnh báo.
 * 3. Kỳ vọng: Lớp bản đồ biến mất khỏi bảng và dữ liệu layer được dọn dẹp.
 *
 * [VALIDATION - Dữ liệu không hợp lệ để kiểm thử lỗi]
 * - Để trống tên lớp -> Báo "Vui lòng nhập tên lớp".
 * - EPSG chứa ký tự chữ "abc" -> Báo "Mã EPSG không hợp lệ".
 * - JSON Properties không hợp lệ "[1,2]" -> Form từ chối submit.
 * ============================================================
 */

import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MapLayerPage from './index'
import { renderWithProviders } from '@/test/renderWithProviders'
import { useAuthStore } from '@/stores/common/useAuthStore'
import type { User } from '@/types/api'
const queryMock = vi.hoisted(() => vi.fn()); const mutationMock = vi.hoisted(() => vi.fn())
vi.mock('@/service', () => ({
  mapLayerService: { getAll: vi.fn(), update: vi.fn(), delete: vi.fn(), publish: vi.fn() },
  layerCategoryService: { getAll: vi.fn().mockResolvedValue({ data: [] }), create: vi.fn() },
  useApiQuery: queryMock,
  useApiMutation: mutationMock,
}))
vi.mock('./MapLayerDetailDialog', () => ({ default: () => null })); vi.mock('./MapLayerFormDialog', () => ({ default: () => null })); vi.mock('./GeoTiffUploadDialog', () => ({ default: () => null })); vi.mock('./ShapefileImportDialog', () => ({ default: () => null }))
const admin = { id: 1, email: 'a@a.com', roleCode: 'so_tnmt', isActive: true, role: { code: 'so_tnmt', permissions: { layers: { create: true, update: true, delete: true }, raster: { create: true } } } } as User
describe('MapLayers index', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: admin })
    queryMock.mockReturnValue({
      data: { data: { items: [] }, metadata: { total: 0 } },
      refetch: vi.fn(),
    })
    mutationMock.mockReturnValue({ mutate: vi.fn(), isPending: false })
  })

  it('renders empty list and permission-gated shapefile and image layer upload', () => {
    renderWithProviders(<MapLayerPage />)
    expect(screen.getByRole('heading', { name: 'Quản lý lớp dữ liệu' })).toBeInTheDocument()
    expect(screen.getByText('Không có dữ liệu')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nhập Shapefile/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Thêm lớp ảnh bản đồ/ })).toBeInTheDocument()
  })

  it('renders category filter dropdown with default "Tất cả nhóm lớp"', () => {
    renderWithProviders(<MapLayerPage />)
    expect(screen.getByText('Tất cả nhóm lớp')).toBeInTheDocument()
  })
})
