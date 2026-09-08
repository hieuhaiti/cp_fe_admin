/**
 * ============================================================
 * MANUAL TEST SCENARIO — QUẢN LÝ KHÓA TRUY CẬP API LỚP BẢN ĐỒ (MAP LAYER APIS)
 * ============================================================
 *
 * [CREATE - Tạo mới API Key chia sẻ lớp]
 * 1. Mở trang Quản lý API lớp dữ liệu (/map-layer-apis).
 * 2. Nhấn nút "Tạo key".
 * 3. Trong Form Dialog:
 *    - Chọn lớp bản đồ: Chọn từ Combobox (tìm kiếm theo tên lớp từ server, ví dụ "Bản đồ ngập lụt", ID: 7).
 *    - Tên key: "API Key chia sẻ ứng dụng di động".
 *    - Quyền & Giới hạn: Đọc (Read), Giới hạn tốc độ: 60 yêu cầu/phút.
 *    - Trạng thái: Kích hoạt (is_active: true).
 * 4. Nhấn "Tạo key".
 * 5. Kỳ vọng: Server sinh API Key an toàn, hiển thị key đầy đủ duy nhất 1 lần để sao chép, danh sách cập nhật.
 *
 * [READ - Xem danh sách & Chi tiết API Key]
 * 1. Chọn Lớp bản đồ từ bộ lọc để tải danh sách các key thuộc lớp đó.
 * 2. Nhấp vào hàng dữ liệu bất kỳ trên bảng.
 * 3. Kỳ vọng: Dialog chi tiết mở ra hiển thị: Tên key, Tên lớp dữ liệu, Key rút gọn (prefix...last4), Tốc độ giới hạn, Lượt sử dụng, Thời điểm dùng gần nhất.
 *
 * [UPDATE - Chỉnh sửa thông tin & Tạo lại (Regenerate) Key]
 * 1. Chỉnh sửa: Nhấn icon "Sửa" -> Cập nhật tên key hoặc thay đổi giới hạn tốc độ -> Lưu -> Dữ liệu cập nhật.
 * 2. Tạo lại key: Nhấn icon "Tạo lại key" -> Xác nhận cảnh báo -> Server cấp key mới, key cũ bị thu hồi.
 *
 * [DELETE - Thu hồi / Xóa API Key]
 * 1. Nhấn icon "Xóa" trên hàng API key cần thu hồi.
 * 2. Xác nhận trên dialog cảnh báo.
 * 3. Kỳ vọng: API key bị vô hiệu hóa / xóa khỏi hệ thống.
 *
 * [VALIDATION - Dữ liệu không hợp lệ]
 * - Bỏ trống lớp bản đồ -> Form báo lỗi bắt buộc chọn lớp.
 * - Tên key rỗng -> Form báo lỗi bắt buộc nhập tên key.
 * ============================================================
 */

import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MapLayerApiListPage from './MapLayerApiListPage'
import { renderWithProviders } from '@/test/renderWithProviders'
import { useAuthStore } from '@/stores/common/useAuthStore'
import type { User } from '@/types/api'
const queryMock = vi.hoisted(() => vi.fn()); const mutationMock = vi.hoisted(() => vi.fn())
vi.mock('@/service', () => ({ mapLayerApiService: { getAll: vi.fn(), delete: vi.fn(), regenerate: vi.fn() }, mapLayerService: { getAll: vi.fn() }, useApiQuery: queryMock, useApiMutation: mutationMock }))
vi.mock('./MapLayerApiDetailDialog', () => ({ default: () => null })); vi.mock('./MapLayerApiFormDialog', () => ({ default: ({ open }: { open: boolean }) => open ? <div>API form opened</div> : null }))
const admin = { id: 1, email: 'a@a.com', roleCode: 'so_tnmt', isActive: true, role: { code: 'so_tnmt', permissions: { api_registry: { create: true, share: true } } } } as User
describe('MapLayerApiListPage', () => { beforeEach(() => { vi.clearAllMocks(); useAuthStore.setState({ user: admin }); queryMock.mockReturnValue({ data: { data: { items: [] }, metadata: { total: 0 } }, refetch: vi.fn() }); mutationMock.mockReturnValue({ mutate: vi.fn(), isPending: false }) }); it('renders layer-selection state and opens create dialog by permission', () => { renderWithProviders(<MapLayerApiListPage />); expect(screen.getByText('Chọn lớp bản đồ')).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Tạo key' })); expect(screen.getByText('API form opened')).toBeInTheDocument() }) })
