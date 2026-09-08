/**
 * ============================================================
 * MANUAL TEST SCENARIO — QUẢN LÝ NGƯỜI DÙNG (USER MANAGEMENT)
 * ============================================================
 *
 * [CREATE - Thêm người dùng mới]
 * 1. Nhấn nút "Thêm người dùng" trên thanh công cụ.
 * 2. Nhập thông tin:
 *    - Email: cb.sotnmt.campha@quangninh.gov.vn
 *    - Mật khẩu: CamPha@2026!
 *    - Họ và tên: Lê Văn Thành
 *    - Số điện thoại: 0912345678
 *    - Vai trò: Sở TN&MT (so_tnmt)
 * 3. Nhấn "Tạo mới".
 * 4. Kỳ vọng: Form đóng, danh sách tải lại và hiển thị người dùng mới tạo.
 *
 * [READ - Xem danh sách & Xem chi tiết]
 * 1. Tìm kiếm theo email "cb.sotnmt.campha" hoặc họ tên "Lê Văn Thành".
 * 2. Lọc theo vai trò "Sở TN&MT".
 * 3. Nhấp vào hàng dữ liệu bất kỳ trên bảng.
 * 4. Kỳ vọng: Dialog chi tiết hiển thị đầy đủ thông tin: ID, Email, Họ tên, SĐT, Vai trò, Trạng thái, Ngày tạo.
 *
 * [UPDATE - Thao tác nghiệp vụ người dùng]
 * 1. Đổi vai trò: Nhấn icon "Đổi vai trò" -> Chọn "UBND thành phố" (ubnd_tp) -> Xác nhận.
 * 2. Đặt lại mật khẩu: Nhấn icon "Đặt lại mật khẩu" -> Nhập "NewPass@2026!" -> Xác nhận.
 * 3. Vô hiệu hóa / Kích hoạt: Nhấn icon "Vô hiệu hóa" -> Xác nhận -> Badge chuyển "Vô hiệu".
 *
 * [DELETE - Xóa người dùng]
 * 1. Nhấn icon "Xóa" trên hàng người dùng kiểm thử.
 * 2. Xác nhận xóa trên dialog cảnh báo.
 * 3. Kỳ vọng: Người dùng biến mất khỏi danh sách.
 *
 * [VALIDATION - Dữ liệu không hợp lệ để kiểm thử lỗi]
 * - Email sai định dạng: "invalid-email" -> Báo lỗi "Email không hợp lệ".
 * - Mật khẩu dưới 6 ký tự: "12345" -> Báo lỗi "Mật khẩu tối thiểu 6 ký tự".
 * - Họ tên trống -> Báo lỗi "Họ tên phải có ít nhất 2 ký tự".
 * ============================================================
 */

import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import UserPage from './index'
import { renderWithProviders } from '@/test/renderWithProviders'
import { useAuthStore } from '@/stores/common/useAuthStore'
import type { User } from '@/types/api'

const queryMock = vi.hoisted(() => vi.fn())
const mutationMock = vi.hoisted(() => vi.fn())
const mutates = vi.hoisted(() => Array.from({ length: 5 }, () => vi.fn()))
vi.mock('@/service', () => ({
  userService: { getAll: vi.fn(), create: vi.fn(), updateActive: vi.fn(), resetPassword: vi.fn(), updateRole: vi.fn(), delete: vi.fn() },
  authService: { getProfile: vi.fn() }, useApiQuery: queryMock, useApiMutation: mutationMock,
}))
vi.mock('./UserDetailDialog', () => ({ default: () => null }))
vi.mock('./UserFormDialog', () => ({ default: ({ open }: { open: boolean }) => open ? <div role="dialog">User form opened</div> : null }))

const admin = {
  id: 1, email: 'admin@example.com', fullName: 'Admin', roleCode: 'so_tnmt', isActive: true,
  role: { code: 'so_tnmt', name: 'Sở TN&MT', permissions: { users: { create: true, update: true, delete: true, change_role: true, change_status: true, reset_password: true } } },
} as User
const target = { id: 9, email: 'target@example.com', fullName: 'Target User', phone: '', roleCode: 'citizen', isActive: true, createdAt: '2026-01-01' }

describe('User page actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: admin })
    queryMock.mockImplementation((key: unknown) => String(key).includes('currentUser')
      ? { data: { data: { user: admin } }, refetch: vi.fn() }
      : { data: { data: { users: [target] }, metadata: { total: 1, totalPages: 1 } }, refetch: vi.fn() })
    let m = 0
    mutationMock.mockImplementation(() => ({ mutate: mutates[m++ % 5], isPending: false }))
  })

  it('renders all permission-backed user actions and opens create form', () => {
    renderWithProviders(<UserPage />)
    expect(screen.getByText('target@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thêm người dùng' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đổi vai trò' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đặt lại mật khẩu' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vô hiệu hóa' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Thêm người dùng' }))
    expect(screen.getByText('User form opened')).toBeInTheDocument()
  })

  it('submits exact active, reset-password, role and delete mutation variables', () => {
    renderWithProviders(<UserPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Vô hiệu hóa' }))
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
    expect(mutates[1]).toHaveBeenCalledWith({ id: 9, isActive: false })

    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }))
    fireEvent.change(screen.getByPlaceholderText(/Nhập mật khẩu mới/), { target: { value: 'Secret123!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
    expect(mutates[2]).toHaveBeenCalledWith({ id: 9, newPassword: 'Secret123!' })

    fireEvent.click(screen.getByRole('button', { name: 'Đổi vai trò' }))
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
    expect(mutates[3]).toHaveBeenCalledWith({ id: 9, roleCode: 'citizen' })

    fireEvent.click(screen.getByRole('button', { name: 'Xóa' }))
    fireEvent.click(screen.getByRole('button', { name: 'Xóa' }))
    expect(mutates[4]).toHaveBeenCalledWith(9)
  })
})
