/**
 * ============================================================
 * MANUAL TEST SCENARIO — PHÂN LOẠI ĐỐI TƯỢNG VÀ HIỆN TRẠNG RỪNG (FOREST CLASSIFICATION)
 * ============================================================
 *
 * [READ - Xem kết quả phân loại mới nhất & Lịch sử snapshot]
 * 1. Mở trang Phân loại đối tượng (/forest-classification).
 * 2. Kỳ vọng:
 *    - Hiển thị bản đồ phân loại độ che phủ rừng / lớp phủ mặt đất Cẩm Phả.
 *    - Bảng thống kê diện tích các loại rừng (rừng tự nhiên, rừng trồng, đất trống).
 *    - Lịch sử các đợt phân loại (snapshot history).
 * 3. Nhấn "Làm mới" để tải lại dữ liệu mới nhất.
 *
 * [EXECUTE / UPDATE - Chạy lại phân tích & Xuất bản Raster]
 * 1. Nhấn nút "Chạy lại phân tích" (yêu cầu quyền forest_classification:manage).
 * 2. Xác nhận chạy tác vụ phân loại dựa trên dữ liệu ảnh vệ tinh mới nhất.
 * 3. Nhấn "Xuất bản Raster" để đưa lớp kết quả phân loại vào hệ thống GIS Map Layers.
 * ============================================================
 */

import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ForestClassificationPage from './index'
import { renderWithProviders } from '@/test/renderWithProviders'
import { useAuthStore } from '@/stores/common/useAuthStore'
import type { User } from '@/types/api'

const queryMock = vi.hoisted(() => vi.fn())
const mutationMock = vi.hoisted(() => vi.fn())
const refetch = vi.hoisted(() => vi.fn())
vi.mock('@/service', () => ({ forestClassificationService: { getLatest: vi.fn(), getHistory: vi.fn(), getSnapshot: vi.fn(), refresh: vi.fn(), publishSnapshotRaster: vi.fn() }, useApiQuery: queryMock, useApiMutation: mutationMock }))
vi.mock('./ForestGroundTruthCard', () => ({ default: () => null }))
vi.mock('@/components/features/GeoJsonMapPreview', () => ({ default: () => <div>Map preview</div> }))
const manager = { id: 1, email: 'f@f.com', roleCode: 'so_tnmt', isActive: true, role: { code: 'so_tnmt', permissions: { forest_classification: { manage: true }, map_layers: { ingest_raster: true } } } } as User

describe('ForestClassification page (service mocked)', () => {
  beforeEach(() => { vi.clearAllMocks(); useAuthStore.setState({ user: manager }); queryMock.mockReturnValue({ data: undefined, isLoading: false, isFetching: false, refetch }); mutationMock.mockReturnValue({ mutate: vi.fn(), isPending: false, variables: undefined }) })
  it('renders safe empty state without invoking Earth Engine/model services', () => { renderWithProviders(<ForestClassificationPage />); expect(screen.getByRole('heading', { name: /Phân loại đối tượng/ })).toBeInTheDocument(); expect(screen.getByText(/Chưa có kết quả phân loại nào/)).toBeInTheDocument() })
  it('refetches latest and history from the manual refresh button', () => { renderWithProviders(<ForestClassificationPage />); fireEvent.click(screen.getByRole('button', { name: 'Làm mới' })); expect(refetch).toHaveBeenCalledTimes(2) })
  it('shows analysis action only with forest_classification:manage', () => {
    const view = renderWithProviders(<ForestClassificationPage />)
    expect(screen.getByRole('button', { name: /Chạy lại phân tích/ })).toBeInTheDocument()
    view.unmount()
    useAuthStore.setState({ user: { ...manager, role: { code: 'so_tnmt', permissions: {} } } })
    renderWithProviders(<ForestClassificationPage />)
    expect(screen.queryByRole('button', { name: /Chạy lại phân tích/ })).not.toBeInTheDocument()
  })
})
