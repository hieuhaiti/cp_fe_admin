/**
 * ============================================================
 * MANUAL TEST SCENARIO — QUẢN LÝ BẢN ĐỒ PDF VÀ ẢNH CHUYÊN ĐỀ (MAP IMAGES / PDF MAPS)
 * ============================================================
 *
 * [CREATE - Thêm mới bản đồ PDF]
 * 1. Mở trang Ảnh bản đồ (/map-images).
 * 2. Nhấn nút "Thêm ảnh bản đồ".
 * 3. Trong Form Dialog:
 *    - Tiêu đề *: "Bản đồ quy hoạch sử dụng đất thành phố Cẩm Phả đến năm 2030".
 *    - Tỉ lệ: "1:25.000" (hoặc 1:10.000, 1:5.000).
 *    - Năm bản đồ: 2026.
 *    - Cơ quan lập: "Phòng Tài nguyên và Môi trường Cẩm Phả".
 *    - Phạm vi (Visibility): Công khai (public) hoặc Nội bộ (private).
 *    - Tệp bản đồ *: Chọn quy-hoach-campha-2026.pdf (định dạng PDF, dung lượng <= 20MB).
 * 4. Nhấn "Tạo mới".
 * 5. Kỳ vọng: Upload thành công, bản ghi mới xuất hiện trên bảng dữ liệu.
 *
 * [READ - Xem danh sách & Xem chi tiết]
 * 1. Tìm kiếm theo tiêu đề "Bản đồ quy hoạch" hoặc lọc số lượng dòng hiển thị.
 * 2. Nhấp vào hàng dữ liệu bất kỳ trên bảng.
 * 3. Kỳ vọng: Dialog chi tiết mở ra hiển thị: Tiêu đề, Tỉ lệ, Năm, Cơ quan lập, Trạng thái công khai, Ngày tạo, Tên tệp gốc và nút tải/xem tệp.
 *
 * [UPDATE - Chỉnh sửa thông tin bản đồ]
 * 1. Nhấn icon "Sửa" (Pencil) trên hàng bản đồ cần sửa.
 * 2. Thay đổi Tiêu đề hoặc Tỉ lệ (nút Cập nhật chỉ bật khi có ít nhất 1 trường thay đổi).
 * 3. Nhấn "Cập nhật".
 * 4. Kỳ vọng: Gửi payload UpdatePdfMapBody kèm expectedUpdatedAt để khóa lạc quan (optimistic locking).
 *
 * [DELETE - Xóa bản đồ]
 * 1. Nhấn icon "Xóa" trên hàng bản đồ kiểm thử.
 * 2. Xác nhận trên dialog cảnh báo.
 * 3. Kỳ vọng: Bản đồ được xóa với expectedUpdatedAt contract, bảng tự động refresh.
 *
 * [VALIDATION - Kiểm thử lỗi]
 * - Để trống tiêu đề -> Báo lỗi bắt buộc.
 * - Chưa chọn file khi tạo mới -> Báo lỗi bắt buộc chọn tệp.
 * - Năm nhỏ hơn 1900 hoặc lớn hơn 2200 -> Báo lỗi năm không hợp lệ.
 * ============================================================
 */

import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MapImagePage from './index'
import { renderWithProviders } from '@/test/renderWithProviders'
import { useAuthStore } from '@/stores/common/useAuthStore'
import type { User } from '@/types/api'

const queryMock = vi.hoisted(() => vi.fn())
const mutationMock = vi.hoisted(() => vi.fn())
const mutates = vi.hoisted(() => [vi.fn(), vi.fn(), vi.fn()])
vi.mock('@/service', () => ({ mapImageService: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() }, useApiQuery: queryMock, useApiMutation: mutationMock }))
vi.mock('./MapImageDetailDialog', () => ({ default: () => null }))
vi.mock('./MapImageFormDialog', () => ({ default: ({ open }: { open: boolean }) => open ? <div>Map form opened</div> : null }))
const admin = { id: 1, email: 'a@a.com', roleCode: 'so_tnmt', isActive: true, role: { code: 'so_tnmt', permissions: { pdf_maps: { create: true, update: true, delete: true } } } } as User
const item = { id: 8, title: 'Bản đồ quy hoạch', scale_label: '1:25.000', map_year: 2026, visibility: 'public', updatedAt: '2026-03-01T00:00:00.000Z' }

describe('MapImage page', () => {
  beforeEach(() => { vi.clearAllMocks(); useAuthStore.setState({ user: admin }); queryMock.mockReturnValue({ data: { data: { items: [item] }, metadata: { total: 1, totalPages: 1 } }, isLoading: false, refetch: vi.fn() }); let m = 0; mutationMock.mockImplementation(() => ({ mutate: mutates[m++ % 3], isPending: false })) })
  it('renders and opens create form for permitted user', () => { renderWithProviders(<MapImagePage />); expect(screen.getByText('Bản đồ quy hoạch')).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: /Thêm ảnh bản đồ/ })); expect(screen.getByText('Map form opened')).toBeInTheDocument() })
  it('deletes with expectedUpdatedAt contract', () => { renderWithProviders(<MapImagePage />); fireEvent.click(screen.getByRole('button', { name: 'Xóa' })); fireEvent.click(screen.getByRole('button', { name: 'Xóa' })); expect(mutates[2]).toHaveBeenCalledWith({ id: 8, expectedUpdatedAt: '2026-03-01T00:00:00.000Z' }) })
})
