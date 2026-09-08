/**
 * ============================================================
 * MANUAL TEST SCENARIO — TIẾP NHẬN VÀ XỬ LÝ PHẢN ÁNH HIỆN TRƯỜNG (CITIZEN FEEDBACK)
 * ============================================================
 *
 * [READ - Xem danh sách phản ánh & Chế độ bản đồ]
 * 1. Mở trang Phản ánh hiện trường (/feedback).
 * 2. Xem ở chế độ Bảng: Tìm kiếm theo tiêu đề phản ánh, lọc theo Trạng thái (Chờ tiếp nhận, Đang xem xét, Đã duyệt, Đã xử lý, Từ chối) và Mức ưu tiên.
 * 3. Chuyển sang Tab "Bản đồ": Xem vị trí các điểm phản ánh trực quan trên nền bản đồ Cẩm Phả.
 * 4. Nhấp vào hàng dữ liệu trên bảng để mở Dialog chi tiết:
 *    - Kỳ vọng: Dialog chi tiết hiển thị: Tiêu đề, Loại phản ánh, Mức độ ưu tiên, Vị trí tọa độ, Nội dung phản ánh, Hình ảnh hiện trường gửi kèm, Lịch sử xử lý.
 *
 * [UPDATE - Chuyển trạng thái xử lý phản ánh]
 * 1. Nhấn nút "Cập nhật trạng thái" trên hàng phản ánh.
 * 2. Chọn trạng thái mới (chỉ các transition hợp lệ theo workflow server: pending -> under_review/rejected -> approved/resolved).
 * 3. Nhập ghi chú xử lý (bắt buộc nhập lý do nếu chọn "Từ chối").
 * 4. Nhấn "Cập nhật trạng thái".
 * 5. Kỳ vọng: Trạng thái và badge trên bảng được cập nhật tức thì.
 * ============================================================
 */

import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FeedbackPage from './index'
import { renderWithProviders } from '@/test/renderWithProviders'
import { useAuthStore } from '@/stores/common/useAuthStore'
import type { User } from '@/types/api'

const queryMock = vi.hoisted(() => vi.fn())
const mutationMock = vi.hoisted(() => vi.fn())
vi.mock('@/service', () => ({ citizenFeedbackService: { getAll: vi.fn(), updateStatus: vi.fn() }, useApiQuery: queryMock, useApiMutation: mutationMock }))
vi.mock('./FeedbackDetailDialog', () => ({ default: () => null }))
vi.mock('./FeedbackUpdateDialog', () => ({ default: () => null }))
vi.mock('./FeedbackMap', () => ({ default: () => <div>Feedback map</div> }))
vi.mock('@/components/common/UserCell', () => ({ UserCell: () => <span>User</span> }))
const handler = { id: 1, email: 'h@h.com', roleCode: 'so_tnmt', isActive: true, role: { code: 'so_tnmt', permissions: { field_report: { read: true, approve: true } } } } as User

describe('Feedback index page', () => {
  beforeEach(() => { vi.clearAllMocks(); useAuthStore.setState({ user: handler }); mutationMock.mockReturnValue({ mutate: vi.fn(), isPending: false }) })
  it('renders loading, error and empty states from the query contract', () => { queryMock.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() }); const view = renderWithProviders(<FeedbackPage />); expect(screen.getByText('Đang tải phản ánh...')).toBeInTheDocument(); view.unmount(); queryMock.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() }); renderWithProviders(<FeedbackPage />); expect(screen.getByText('Không thể tải danh sách phản ánh.')).toBeInTheDocument() })
  it('renders no-data table without opening action form', () => { queryMock.mockReturnValue({ data: { data: { items: [] }, metadata: { total: 0 } }, isLoading: false, isError: false, refetch: vi.fn() }); renderWithProviders(<FeedbackPage />); expect(screen.getByRole('heading', { name: 'Phản ánh hiện trường' })).toBeInTheDocument(); expect(screen.getByText('Không có phản ánh phù hợp bộ lọc.')).toBeInTheDocument() })
})
