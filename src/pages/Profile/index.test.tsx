/**
 * ============================================================
 * MANUAL TEST SCENARIO — QUẢN LÝ HỒ SƠ CÁ NHÂN (USER PROFILE)
 * ============================================================
 *
 * [READ - Xem thông tin tài khoản]
 * 1. Mở trang Hồ sơ cá nhân (/profile).
 * 2. Kỳ vọng: Form tự động điền sẵn Email (read-only), Họ và tên, Số điện thoại, Đường dẫn ảnh đại diện, Vai trò hiện tại.
 *
 * [UPDATE - Chỉnh sửa thông tin hồ sơ]
 * 1. Sửa Họ và tên: "Nguyễn Văn Cẩm Phả".
 * 2. Sửa Số điện thoại: "0912345678".
 * 3. Sửa Đường dẫn ảnh đại diện: "https://example.com/avatar.jpg".
 * 4. Nhấn "Lưu thay đổi".
 * 5. Kỳ vọng: Hồ sơ được cập nhật thành công, avatar trên Header cập nhật theo.
 *
 * [RESET - Hủy thay đổi]
 * 1. Thay đổi thông tin nhưng nhấn nút "Hủy thay đổi".
 * 2. Kỳ vọng: Form khôi phục về giá trị gốc từ server.
 *
 * [VALIDATION - Kiểm thử lỗi]
 * - Nhập số điện thoại chứa chữ (ví dụ "abc123") -> Báo lỗi "Số điện thoại không hợp lệ".
 * - Nhập URL avatar không hợp lệ (ví dụ "not-a-url") -> Báo lỗi "Đường dẫn ảnh không hợp lệ".
 * ============================================================
 */

import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProfilePage from './index'
import { renderWithProviders } from '@/test/renderWithProviders'
import { useAuthStore } from '@/stores/common/useAuthStore'
import type { UpdateProfileBody, User } from '@/types/api'

const mutate = vi.hoisted(() => vi.fn())
const useApiMutationMock = vi.hoisted(() => vi.fn())
const updateProfile = vi.hoisted(() => vi.fn())

vi.mock('@/service', () => ({
  authService: { updateProfile },
  useApiMutation: useApiMutationMock,
}))

const profileUser: User = {
  id: 1,
  email: 'admin@example.com',
  fullName: 'Quản trị cũ',
  phone: '0905123456',
  avatarUrl: 'https://example.com/old.png',
  roleCode: 'system_admin',
  isActive: true,
}

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useApiMutationMock.mockReturnValue({ mutate, isPending: false })
    useAuthStore.setState({ user: profileUser, fetchProfile: vi.fn().mockResolvedValue(true) })
  })

  it('prefills profile fields and keeps save disabled until dirty', () => {
    renderWithProviders(<ProfilePage />)
    expect(screen.getByLabelText(/Email/i)).toHaveValue('admin@example.com')
    expect(screen.getByLabelText(/Họ và tên/i)).toHaveValue('Quản trị cũ')
    expect(screen.getByRole('button', { name: /Lưu thay đổi/ })).toBeDisabled()
  })

  it('validates phone and avatar URL before updating', async () => {
    renderWithProviders(<ProfilePage />)
    fireEvent.change(screen.getByLabelText(/Số điện thoại/i), { target: { value: 'abc' } })
    fireEvent.change(screen.getByLabelText(/Đường dẫn ảnh đại diện/i), { target: { value: 'not-a-url' } })
    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/ }))
    expect(await screen.findByText('Số điện thoại không hợp lệ')).toBeInTheDocument()
    expect(screen.getByText('Đường dẫn ảnh không hợp lệ')).toBeInTheDocument()
    expect(mutate).not.toHaveBeenCalled()
  })

  it('submits trimmed UpdateProfileBody and reset restores server values', async () => {
    renderWithProviders(<ProfilePage />)
    fireEvent.change(screen.getByLabelText(/Họ và tên/i), { target: { value: '  Quản trị mới  ' } })
    fireEvent.change(screen.getByLabelText(/Số điện thoại/i), { target: { value: ' 0912345678 ' } })
    fireEvent.change(screen.getByLabelText(/Đường dẫn ảnh đại diện/i), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/ }))
    const expected: UpdateProfileBody = { fullName: 'Quản trị mới', phone: '0912345678' }
    await waitFor(() => expect(mutate).toHaveBeenCalledWith(expected))

    fireEvent.change(screen.getByLabelText(/Họ và tên/i), { target: { value: 'Chưa lưu' } })
    fireEvent.click(screen.getByRole('button', { name: 'Hủy thay đổi' }))
    expect(screen.getByLabelText(/Họ và tên/i)).toHaveValue('Quản trị cũ')
  })

  it('disables both actions while saving', () => {
    useApiMutationMock.mockReturnValue({ mutate, isPending: true })
    renderWithProviders(<ProfilePage />)
    expect(screen.getByRole('button', { name: /Đang lưu/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Hủy thay đổi' })).toBeDisabled()
  })
})
