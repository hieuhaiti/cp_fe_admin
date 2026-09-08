/**
 * ============================================================
 * MANUAL TEST SCENARIO — QUẢN LÝ ĐO ĐẠC VÀ KIỂM CHỨNG THỰC ĐỊA (FIELD MEASUREMENTS)
 * ============================================================
 *
 * [READ - Xem danh sách phiên đo & Chi tiết hình ảnh thực địa]
 * 1. Mở trang Đo đạc thực địa (/field-measurements).
 * 2. Lọc theo Phường/Xã hoặc Trạng thái thẩm định (Chờ duyệt, Đã thẩm định, Từ chối).
 * 3. Nhấp vào hàng dữ liệu để xem chi tiết: Tọa độ điểm đo, Ảnh chụp thực địa, Thông số đo đạc, Người thực hiện.
 *
 * [UPDATE - Thẩm định / Từ chối phiên đo]
 * 1. Nhấn nút "Thẩm định" (Verify) hoặc "Từ chối" (Reject) trên phiên đo (yêu cầu quyền field_measurements:verify).
 * 2. Nhập ghi chú thẩm định và xác nhận.
 * 3. Kỳ vọng: Trạng thái phiên đo cập nhật thành công.
 *
 * [EXPORT - Xuất dữ liệu GeoJSON]
 * 1. Nhấn nút "Xuất GeoJSON" để tải về file dữ liệu các điểm đo phục vụ tích hợp GIS.
 * ============================================================
 */

import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FieldMeasurementsPage from './index'
import { renderWithProviders } from '@/test/renderWithProviders'
import { useAuthStore } from '@/stores/common/useAuthStore'
import type { User } from '@/types/api'
const queryMock = vi.hoisted(() => vi.fn()); const mutationMock = vi.hoisted(() => vi.fn())
vi.mock('@/service', () => ({ fieldMeasurementService: { getAll: vi.fn(), getById: vi.fn(), verify: vi.fn(), reject: vi.fn(), exportGeoJson: vi.fn() }, statisticsService: { getAdminUnits: vi.fn() }, useApiQuery: queryMock, useApiMutation: mutationMock }))
vi.mock('@/components/features/GeoJsonMapPreview', () => ({ default: () => <div>Map</div> }))
const admin = { id: 1, email: 'a@a.com', roleCode: 'so_tnmt', isActive: true, role: { code: 'so_tnmt', permissions: { field_measurements: { verify: true } } } } as User
describe('FieldMeasurements index', () => { beforeEach(() => { vi.clearAllMocks(); useAuthStore.setState({ user: admin }); queryMock.mockReturnValue({ data: undefined, isLoading: false, refetch: vi.fn() }); mutationMock.mockReturnValue({ mutate: vi.fn(), isPending: false }) }); it('renders unmounted module safely without backend or export calls', () => { renderWithProviders(<FieldMeasurementsPage />); expect(screen.getByRole('heading', { name: 'Đo đạc thực địa' })).toBeInTheDocument(); expect(screen.getByText('Không có phiên đo phù hợp.')).toBeInTheDocument() }) })
