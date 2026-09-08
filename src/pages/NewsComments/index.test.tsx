/**
 * ============================================================
 * MANUAL TEST SCENARIO — QUẢN LÝ BÌNH LUẬN TIN TỨC (NEWS COMMENTS)
 * ============================================================
 *
 * [READ - Xem bình luận theo bài viết & Xem chi tiết]
 * 1. Mở trang Bình luận tin tức (/news/comments).
 * 2. Chọn bài viết từ Combobox (ví dụ: "Cẩm Phả cập nhật dữ liệu bản đồ đô thị", ID: 12).
 * 3. Lọc theo trạng thái duyệt (Tất cả / Đã duyệt / Chưa duyệt).
 * 4. Nhấp vào hàng bình luận trên bảng để mở Dialog chi tiết.
 * 5. Kỳ vọng: Dialog chi tiết hiển thị: Tiêu đề bài viết, Người bình luận, Nội dung bình luận, Trạng thái phê duyệt, Thời gian gửi.
 *
 * [UPDATE - Phê duyệt / Bỏ duyệt bình luận]
 * 1. Nhấn nút "Duyệt" trên hàng bình luận chưa duyệt.
 * 2. Kỳ vọng: Trạng thái chuyển sang "Đã duyệt" và cập nhật tức thì.
 *
 * [DELETE - Xóa bình luận vi phạm]
 * 1. Nhấn icon "Xóa" trên hàng bình luận vi phạm nội quy.
 * 2. Xác nhận trên dialog cảnh báo.
 * 3. Kỳ vọng: Bình luận bị xóa khỏi hệ thống.
 * ============================================================
 */

import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NewsComments from './index'
import { renderWithProviders } from '@/test/renderWithProviders'
import { useAuthStore } from '@/stores/common/useAuthStore'
import type { User } from '@/types/api'

const queryMock = vi.hoisted(() => vi.fn())
const mutationMock = vi.hoisted(() => vi.fn())
vi.mock('@/service', () => ({
  newsService: { getAll: vi.fn() }, newsCommentService: { getAll: vi.fn(), approve: vi.fn(), adminDelete: vi.fn() },
  useApiQuery: queryMock, useApiMutation: mutationMock,
}))
vi.mock('./NewsCommentDetailDialog', () => ({ default: () => null }))
vi.mock('@/components/common/UserCell', () => ({ UserCell: () => <span>User</span> }))

const moderator = {
  id: 3, email: 'mod@example.com', fullName: 'Moderator', roleCode: 'so_tnmt', isActive: true,
  role: { code: 'so_tnmt', name: 'Sở TN&MT', permissions: { news: { update: true, delete: true } } },
} as User

describe('NewsComments page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: moderator })
    queryMock.mockReturnValue({ data: { data: { items: [] }, metadata: { total: 0 } }, isFetching: false, refetch: vi.fn() })
    mutationMock.mockReturnValue({ mutate: vi.fn(), isPending: false })
  })

  it('renders page layout and empty table state', () => {
    renderWithProviders(<NewsComments />)
    expect(screen.getByRole('heading', { name: 'Bình luận tin tức' })).toBeInTheDocument()
    expect(screen.getByText('Không có dữ liệu')).toBeInTheDocument()
  })

  it('does not render row moderation actions when there are no comments', () => {
    renderWithProviders(<NewsComments />)
    expect(screen.queryByRole('button', { name: 'Duyệt' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Xóa' })).not.toBeInTheDocument()
  })
})
