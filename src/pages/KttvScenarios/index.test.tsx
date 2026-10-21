/**
 * ============================================================
 * MANUAL TEST SCENARIO — QUẢN LÝ KỊCH BẢN THỦY VĂN / NGẬP LỤT (KTTV SCENARIOS)
 * ============================================================
 *
 * [CREATE - Thêm mới kịch bản ngập]
 * 1. Mở trang Kịch bản thủy văn (/kttv-scenarios).
 * 2. Nhấn nút "Thêm kịch bản".
 * 3. Trong Form Dialog:
 *    - Mã kịch bản *: "KB_MUA_LON_TRIEU_CUONG_2026".
 *    - Tên kịch bản *: "Kịch bản mưa lớn kết hợp triều cường tại trung tâm Cẩm Phả".
 *    - Lượng mưa (mm): Min: 50.0 - Max: 150.0.
 *    - Mực nước triều (m): Min: 1.5 - Max: 3.5.
 *    - Mã lớp bản đồ: Chọn lớp "Lớp ngập lụt" từ Combobox (layer_code: flood_7).
 *    - Mô tả: "Kịch bản ứng phó sự kiện ngập diện rộng khu vực ven biển Cẩm Phả.".
 *    - Trạng thái: Kích hoạt (is_active: true).
 * 4. Nhấn "Lưu kịch bản".
 * 5. Kỳ vọng: Kịch bản được tạo và hiển thị trong danh sách.
 *
 * [READ - Xem danh sách & Tra cứu kịch bản phù hợp]
 * 1. Xem danh sách kịch bản trong Tab "Quản lý kịch bản".
 * 2. Chuyển sang Tab "Nhập kịch bản":
 *    - Nhập lượng mưa hiện tại: 85.5 mm.
 *    - Nhập mực nước triều: 2.1 m.
 *    - Nhấn "Tra cứu kịch bản".
 *    - Kỳ vọng: Hệ thống tính toán và hiển thị kịch bản khớp tương ứng cùng lớp bản đồ ngập dự báo.
 *
 * [UPDATE - Chỉnh sửa thông số kịch bản]
 * 1. Nhấp vào hàng kịch bản hoặc nhấn icon "Sửa" (Pencil).
 * 2. Thay đổi ngưỡng lượng mưa hoặc mực nước triều.
 * 3. Nhấn "Lưu kịch bản".
 * 4. Kỳ vọng: Dữ liệu kịch bản được cập nhật thành công.
 *
 * [DELETE - Xóa kịch bản]
 * 1. Nhấn icon "Xóa" trên hàng kịch bản kiểm thử.
 * 2. Xác nhận trên dialog cảnh báo.
 * 3. Kỳ vọng: Kịch bản được xóa bằng ID chính xác (ví dụ ID: 7).
 *
 * [VALIDATION - Kiểm thử lỗi]
 * - Lượng mưa âm hoặc để trống -> Báo lỗi validation.
 * - Mã kịch bản trùng hoặc để trống -> Báo lỗi bắt buộc.
 * ============================================================
 */

import { act, fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import KttvScenariosPage from './index'
import KttvConvertFromLayersDialog from './KttvConvertFromLayersDialog'
import { toast } from 'react-toastify'
import { renderWithProviders } from '@/test/renderWithProviders'
import { useAuthStore } from '@/stores/common/useAuthStore'
import type { User } from '@/types/api'
const queryMock = vi.hoisted(() => vi.fn()); const mutationMock = vi.hoisted(() => vi.fn()); const remove = vi.hoisted(() => vi.fn())
vi.mock('@/service', () => ({ kttvScenarioService: { getAll: vi.fn(), delete: vi.fn() }, useApiQuery: queryMock, useApiMutation: mutationMock }))
vi.mock('./KttvScenarioFormDialog', () => ({ default: ({ open }: { open: boolean }) => open ? <div>Scenario form opened</div> : null }))
vi.mock('./KttvInputForm', () => ({ default: () => <div>KTTV input form</div> }))
vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const admin = { id: 1, email: 'a@a.com', roleCode: 'so_tnmt', isActive: true, role: { code: 'so_tnmt', permissions: { flood: { read: true, run: true } } } } as User
const item = { id: 7, code: 'KB7', name_vi: 'Kịch bản 7', layer_code: 'flood_7', is_active: true }
describe('KTTV scenario index', () => { beforeEach(() => { vi.clearAllMocks(); useAuthStore.setState({ user: admin }); queryMock.mockReturnValue({ data: { data: { items: [item], pagination: { total: 1 } } }, refetch: vi.fn() }); mutationMock.mockReturnValue({ mutate: remove, isPending: false }) }); it('opens create form by permission', () => { renderWithProviders(<KttvScenariosPage />); fireEvent.click(screen.getByRole('button', { name: 'Thêm kịch bản' })); expect(screen.getByText('Scenario form opened')).toBeInTheDocument() }); it('deletes by exact scenario id', () => { renderWithProviders(<KttvScenariosPage />); fireEvent.click(screen.getByRole('button', { name: 'Xóa' })); fireEvent.click(screen.getByRole('button', { name: 'Xóa' })); expect(remove).toHaveBeenCalledWith(7) }) })

describe('KTTV success notification ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: admin })
    queryMock.mockReturnValue({ data: { data: { items: [item] } }, refetch: vi.fn() })
    mutationMock.mockReturnValue({ mutate: remove, isPending: false })
  })

  it('keeps one local delete success toast', () => {
    renderWithProviders(<KttvScenariosPage />)
    const [, options, notification] = mutationMock.mock.calls[0]
    expect(notification).toBe(false)
    act(() => options.onSuccess())
    expect(toast.success).toHaveBeenCalledExactlyOnceWith('Xóa kịch bản thành công')
  })

  it('keeps the conversion result counts without a default success toast', () => {
    const onConverted = vi.fn()
    const onOpenChange = vi.fn()
    renderWithProviders(<KttvConvertFromLayersDialog open={false} onOpenChange={onOpenChange} onConverted={onConverted} />)
    const [, options, notification] = mutationMock.mock.calls[0]
    expect(notification).toBe(false)
    act(() => options.onSuccess({ data: { created: [{}], skipped: [{}] } }))
    expect(toast.success).toHaveBeenCalledExactlyOnceWith('Đã chuyển đổi thành công 1 kịch bản ngập (bỏ qua 1 kịch bản đã tồn tại)')
    expect(onConverted).toHaveBeenCalledOnce()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
