/**
 * ============================================================
 * MANUAL TEST SCENARIO — QUẢN LÝ VĂN BẢN VÀ TÀI LIỆU (DOCUMENTS)
 * ============================================================
 *
 * [CREATE - Thêm mới văn bản]
 * 1. Mở trang Văn bản tài liệu (/documents).
 * 2. Nhấn nút "Thêm văn bản".
 * 3. Trong Form Dialog:
 *    - Tiêu đề *: "Quyết định phê duyệt điều chỉnh cục bộ quy hoạch chung thành phố Cẩm Phả".
 *    - Mã văn bản *: "125/QĐ-UBND-2026".
 *    - Cơ quan ban hành *: "Ủy ban nhân dân thành phố Cẩm Phả".
 *    - Ngày ban hành: 2026-08-30.
 *    - Mô tả: "Văn bản công bố quy hoạch đô thị và hạ tầng kỹ thuật năm 2026.".
 *    - Phạm vi (Visibility): Công khai (public).
 *    - Tệp văn bản *: Chọn quyet-dinh-125.pdf (định dạng PDF, dung lượng <= 50MB).
 * 4. Nhấn "Tạo mới".
 * 5. Kỳ vọng: Gửi FormData multipart thành công, danh sách tự động tải lại và hiển thị văn bản mới.
 *
 * [READ - Xem danh sách & Chi tiết văn bản]
 * 1. Tìm kiếm theo tiêu đề "quy hoạch" hoặc mã "125/QĐ".
 * 2. Nhấp vào hàng dữ liệu bất kỳ trên bảng.
 * 3. Kỳ vọng: Dialog chi tiết mở ra hiển thị: Tiêu đề, Mã văn bản, Cơ quan ban hành, Ngày ban hành, Trạng thái công khai, Tên tệp đính kèm và nút xem tệp PDF trực tiếp.
 *
 * [UPDATE - Chỉnh sửa thông tin văn bản]
 * 1. Nhấn icon "Sửa" (Pencil) trên hàng văn bản.
 * 2. Thay đổi Tiêu đề hoặc Cơ quan ban hành.
 * 3. Nhấn "Cập nhật".
 * 4. Kỳ vọng: Nút cập nhật chỉ bật khi có thay đổi, gửi UpdateDocumentBody kèm expectedUpdatedAt cho optimistic lock.
 *
 * [DELETE - Xóa văn bản]
 * 1. Nhấn icon "Xóa" trên hàng văn bản kiểm thử.
 * 2. Xác nhận trên dialog cảnh báo.
 * 3. Kỳ vọng: Văn bản được xóa với expectedUpdatedAt contract và biến mất khỏi bảng.
 *
 * [VALIDATION - Kiểm thử lỗi]
 * - Để trống Tiêu đề, Mã văn bản hoặc Cơ quan ban hành -> Báo lỗi bắt buộc.
 * - Chưa chọn tệp PDF khi tạo mới -> Toast báo "Vui lòng chọn file văn bản để tải lên".
 * ============================================================
 */

import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DocumentsPage from './index'
import { renderWithProviders } from '@/test/renderWithProviders'
import { useAuthStore } from '@/stores/common/useAuthStore'
import type { User } from '@/types/api'

const queryMock = vi.hoisted(() => vi.fn())
const mutationMock = vi.hoisted(() => vi.fn())
const mutates = vi.hoisted(() => [vi.fn(), vi.fn(), vi.fn()])
vi.mock('@/service', () => ({ documentService: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() }, useApiQuery: queryMock, useApiMutation: mutationMock }))
vi.mock('./DocumentDetailDialog', () => ({ default: () => null }))
vi.mock('./DocumentFormDialog', () => ({ default: ({ open }: { open: boolean }) => open ? <div>Document form opened</div> : null }))
const admin = { id: 1, email: 'a@a.com', roleCode: 'so_tnmt', isActive: true, role: { code: 'so_tnmt', permissions: { documents: { create: true, update: true, delete: true } } } } as User
const item = { id: 5, title: 'Quyết định', document_code: 'QD-5', issuing_agency: 'UBND', visibility: 'public', updated_at: '2026-02-01T00:00:00.000Z' }

describe('Documents page', () => {
  beforeEach(() => { vi.clearAllMocks(); useAuthStore.setState({ user: admin }); queryMock.mockReturnValue({ data: { data: { items: [item] }, metadata: { total: 1, totalPages: 1 } }, isLoading: false, refetch: vi.fn() }); let m = 0; mutationMock.mockImplementation(() => ({ mutate: mutates[m++ % 3], isPending: false })) })
  it('renders and opens create form for permitted user', () => { renderWithProviders(<DocumentsPage />); expect(screen.getByText('QD-5')).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: /Thêm văn bản/ })); expect(screen.getByText('Document form opened')).toBeInTheDocument() })
  it('deletes with expectedUpdatedAt contract', () => { renderWithProviders(<DocumentsPage />); fireEvent.click(screen.getByRole('button', { name: 'Xóa' })); fireEvent.click(screen.getByRole('button', { name: 'Xóa' })); expect(mutates[2]).toHaveBeenCalledWith({ id: 5, expectedUpdatedAt: '2026-02-01T00:00:00.000Z' }) })
})
