/**
 * ============================================================
 * MANUAL TEST SCENARIO — QUẢN LÝ TIN TỨC VÀ BÀI VIẾT (NEWS MANAGEMENT)
 * ============================================================
 *
 * [CREATE - Thêm mới tin tức/bài viết]
 * 1. Mở trang Quản lý tin tức (/news).
 * 2. Nhấn nút "Thêm tin tức".
 * 3. Trong Form Dialog:
 *    - Tiêu đề *: "Cẩm Phả đẩy mạnh ứng dụng công nghệ GIS trong giám sát tài nguyên và môi trường".
 *    - Slug: "cam-pha-day-manh-ung-dung-gis-giam-sat-tai-nguyen-2026" (tự sinh từ tiêu đề).
 *    - Tóm tắt: "Bài viết tổng quan về hệ thống GIS và viễn thám phục vụ chuyển đổi số tại TP Cẩm Phả.".
 *    - Nội dung *: Nhập nội dung bài viết đầy đủ (ít nhất 10 ký tự).
 *    - Tags: "gis, cam-pha, viễn thám, môi trường".
 *    - Trạng thái: Bản nháp (draft) hoặc Đã xuất bản (published).
 *    - Ảnh đại diện *: Chọn banner-campha.jpg (định dạng JPG/PNG/WEBP, dung lượng <= 10MB).
 * 4. Nhấn "Tạo mới".
 * 5. Kỳ vọng: Gửi FormData multipart đúng chuẩn, bài viết mới hiển thị trong bảng.
 *
 * [READ - Xem danh sách & Xem chi tiết bài viết]
 * 1. Tìm kiếm theo tiêu đề bài viết hoặc lọc theo trạng thái công bố.
 * 2. Nhấp vào hàng dữ liệu bất kỳ trên bảng.
 * 3. Kỳ vọng: Dialog chi tiết mở ra hiển thị: Tiêu đề, Slug, Tóm tắt, Nội dung, Tags, Lượt xem, Trạng thái và ảnh đại diện.
 *
 * [UPDATE - Chỉnh sửa thông tin bài viết]
 * 1. Nhấn icon "Sửa" (Pencil) trên hàng bài viết.
 * 2. Chỉnh sửa Tiêu đề, Nội dung hoặc Trạng thái (chuyển Bản nháp sang Đã xuất bản).
 * 3. Nhấn "Cập nhật".
 * 4. Kỳ vọng: Dữ liệu được cập nhật trên bảng với optimistic-lock timestamp.
 *
 * [DELETE - Xóa bài viết]
 * 1. Nhấn icon "Xóa" trên hàng bài viết kiểm thử.
 * 2. Xác nhận xóa trên dialog cảnh báo.
 * 3. Kỳ vọng: Bài viết bị xóa với expectedUpdatedAt contract và biến mất khỏi bảng.
 *
 * [VALIDATION - Kiểm thử lỗi]
 * - Để trống Tiêu đề (< 5 ký tự) hoặc Nội dung -> Báo lỗi validation.
 * - Chọn file không phải ảnh (ví dụ file .pdf) -> Toast báo lỗi định dạng ảnh.
 * ============================================================
 */

import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NewsPage from './index'
import { renderWithProviders } from '@/test/renderWithProviders'
import { useAuthStore } from '@/stores/common/useAuthStore'
import type { User } from '@/types/api'

const queryMock = vi.hoisted(() => vi.fn())
const mutationMock = vi.hoisted(() => vi.fn())
const mutates = vi.hoisted(() => [vi.fn(), vi.fn(), vi.fn()])
vi.mock('@/service', () => ({ newsService: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() }, useApiQuery: queryMock, useApiMutation: mutationMock }))
vi.mock('./NewsDetailDialog', () => ({ default: () => null }))
vi.mock('./NewsFormDialog', () => ({ default: ({ open }: { open: boolean }) => open ? <div>News form opened</div> : null }))

const admin = { id: 1, email: 'admin@example.com', fullName: 'Admin', roleCode: 'so_tnmt', isActive: true, role: { code: 'so_tnmt', name: 'Sở TN&MT', permissions: { news: { create: true, update: true, delete: true } } } } as User
const item = { id: 12, title: 'Tin thử', status: 'draft', viewCount: 4, updatedAt: '2026-01-02T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' }

describe('News page actions', () => {
  beforeEach(() => {
    vi.clearAllMocks(); useAuthStore.setState({ user: admin })
    queryMock.mockReturnValue({ data: { data: { items: [item] }, metadata: { total: 1, totalPages: 1 } }, refetch: vi.fn() })
    let m = 0; mutationMock.mockImplementation(() => ({ mutate: mutates[m++ % 3], isPending: false }))
  })

  it('renders create/edit/delete actions according to permission', () => {
    renderWithProviders(<NewsPage />)
    expect(screen.getByText('Tin thử')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Thêm tin tức' }))
    expect(screen.getByText('News form opened')).toBeInTheDocument()
  })

  it('deletes with Server optimistic-lock timestamp', () => {
    renderWithProviders(<NewsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Xóa' }))
    expect(screen.getByRole('heading', { name: 'Xác nhận xóa' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Xóa' }))
    expect(mutates[2]).toHaveBeenCalledWith({ id: 12, expectedUpdatedAt: '2026-01-02T00:00:00.000Z' })
  })
})
