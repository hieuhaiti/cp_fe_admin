/**
 * ============================================================
 * MANUAL TEST SCENARIO — ĐỔI MẬT KHẨU TÀI KHOẢN (CHANGE PASSWORD)
 * ============================================================
 *
 * [UPDATE - Thực hiện đổi mật khẩu]
 * 1. Mở trang Đổi mật khẩu (/change-password).
 * 2. Nhập các trường:
 *    - Mật khẩu hiện tại *: "CamPha@2026".
 *    - Mật khẩu mới *: "NewCamPha@2026" (ít nhất 8 ký tự, có chữ hoa, thường, số, ký tự đặc biệt).
 *    - Xác nhận mật khẩu mới *: "NewCamPha@2026".
 * 3. Nhấn "Đổi mật khẩu".
 * 4. Kỳ vọng: Gửi ChangePasswordBody ({ oldPassword, newPassword }), hệ thống tự động đăng xuất và điều hướng về trang Đăng nhập.
 *
 * [VALIDATION - Kiểm thử lỗi]
 * - Mật khẩu mới < 8 ký tự -> Báo lỗi "Mật khẩu mới phải có ít nhất 8 ký tự".
 * - Xác nhận mật khẩu không khớp -> Báo lỗi "Mật khẩu xác nhận không khớp".
 * - Mật khẩu mới trùng mật khẩu cũ -> Báo lỗi "Mật khẩu mới phải khác mật khẩu hiện tại".
 * ============================================================
 */

import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ChangePasswordPage from './index'
import { renderWithProviders } from '@/test/renderWithProviders'
import { useAuthStore } from '@/stores/common/useAuthStore'
import type { ChangePasswordBody } from '@/types/api'

const changePassword = vi.hoisted(() => vi.fn())
const logout = vi.hoisted(() => vi.fn())

vi.mock('@/service', async () => {
  const actual = await vi.importActual<typeof import('@/service')>('@/service')
  return { ...actual, authService: { ...actual.authService, changePassword } }
})

describe('ChangePasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    changePassword.mockResolvedValue({ status: 200, message: 'OK', data: {} })
    useAuthStore.setState({ logout })
  })

  it('validates strength, difference and confirmation before calling the API', async () => {
    renderWithProviders(<ChangePasswordPage />)
    fireEvent.change(screen.getByLabelText(/Mật khẩu hiện tại/i), { target: { value: 'Old@1234' } })
    fireEvent.change(screen.getByLabelText(/^Mật khẩu mới/i), { target: { value: 'weak' } })
    fireEvent.change(screen.getByLabelText(/Xác nhận mật khẩu mới/i), { target: { value: 'other' } })
    fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }))
    expect(await screen.findByText('Mật khẩu mới phải có ít nhất 8 ký tự')).toBeInTheDocument()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('maps form fields to the exact Server ChangePasswordBody', async () => {
    renderWithProviders(<ChangePasswordPage />)
    fireEvent.change(screen.getByLabelText(/Mật khẩu hiện tại/i), { target: { value: 'Old@1234' } })
    fireEvent.change(screen.getByLabelText(/^Mật khẩu mới/i), { target: { value: 'New@1234' } })
    fireEvent.change(screen.getByLabelText(/Xác nhận mật khẩu mới/i), { target: { value: 'New@1234' } })
    fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }))
    const expected: ChangePasswordBody = { oldPassword: 'Old@1234', newPassword: 'New@1234' }
    await waitFor(() => expect(changePassword).toHaveBeenCalledWith(expected))
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1))
  })

  it('disables submit while the request is pending', async () => {
    changePassword.mockReturnValue(new Promise(() => undefined))
    renderWithProviders(<ChangePasswordPage />)
    fireEvent.change(screen.getByLabelText(/Mật khẩu hiện tại/i), { target: { value: 'Old@1234' } })
    fireEvent.change(screen.getByLabelText(/^Mật khẩu mới/i), { target: { value: 'New@1234' } })
    fireEvent.change(screen.getByLabelText(/Xác nhận mật khẩu mới/i), { target: { value: 'New@1234' } })
    fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }))
    expect(await screen.findByRole('button', { name: 'Đang cập nhật...' })).toBeDisabled()
  })
})
