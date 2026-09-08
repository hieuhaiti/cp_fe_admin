/**
 * ============================================================
 * MANUAL TEST SCENARIO — ĐĂNG NHẬP HỆ THỐNG QUẢN TRỊ (ADMIN AUTH / LOGIN)
 * ============================================================
 *
 * [LOGIN - Đăng nhập tài khoản]
 * 1. Mở trang Đăng nhập (/login).
 * 2. Nhập Email: "admin@campha.gov.vn" (hoặc ubnd@campha.gov.vn, sotnmt@campha.gov.vn).
 * 3. Nhập Mật khẩu: "Secret@123".
 * 4. Nhấn "Truy cập hệ thống".
 * 5. Kỳ vọng: Đăng nhập thành công, lưu token vào storage, tự động điều hướng vào trang Dashboard/Landing.
 *
 * [VALIDATION - Kiểm thử lỗi]
 * - Nhập sai định dạng email (ví dụ "invalid") -> Báo lỗi "Vui lòng nhập địa chỉ email hợp lệ.".
 * - Để trống mật khẩu -> Báo lỗi bắt buộc nhập mật khẩu.
 * - Đăng nhập bằng tài khoản không có quyền admin -> Báo lỗi "Tài khoản không có quyền quản trị.".
 * ============================================================
 */

import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Login from './Login'
import { renderWithProviders } from '@/test/renderWithProviders'
import { useAuthStore } from '@/stores/common/useAuthStore'

const login = vi.hoisted(() => vi.fn())
const loginSuccess = vi.hoisted(() => vi.fn())
const fetchProfile = vi.hoisted(() => vi.fn())

vi.mock('@/service/authService', () => ({ default: { login } }))

function fillCredentials(email = ' admin@campha.gov.vn ', password = ' Secret@123 ') {
  fireEvent.change(screen.getByLabelText('Email đăng nhập'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Mật khẩu truy cập'), { target: { value: password } })
}

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchProfile.mockResolvedValue(true)
    useAuthStore.setState({
      isAuthenticated: false,
      loggedOut: false,
      loginSuccess,
      fetchProfile,
    })
  })

  it('validates email and required password without calling auth service', async () => {
    renderWithProviders(<Login />, { initialEntries: ['/login'] })
    fillCredentials('invalid', '')
    const submit = screen.getByRole('button', { name: /Truy cập hệ thống/ })
    fireEvent.submit(submit.closest('form')!)
    expect(await screen.findByText('Vui lòng nhập địa chỉ email hợp lệ.')).toBeInTheDocument()
    expect(login).not.toHaveBeenCalled()
  })

  it('trims the exact login payload and stores returned token contract', async () => {
    login.mockResolvedValue({
      status: 200,
      message: 'OK',
      data: {
        accessToken: 'access',
        refreshToken: 'refresh',
        tokenType: 'Bearer',
        expiresIn: 900,
        refreshExpiresIn: 86400,
      },
    })
    renderWithProviders(<Login />, { initialEntries: ['/login'] })
    fillCredentials()
    fireEvent.click(screen.getByRole('button', { name: /Truy cập hệ thống/ }))
    await waitFor(() => expect(login).toHaveBeenCalledWith({ email: 'admin@campha.gov.vn', password: 'Secret@123' }))
    expect(loginSuccess).toHaveBeenCalledWith({ accessToken: 'access', refreshToken: 'refresh', tokenType: 'Bearer', expiresIn: 900, refreshExpiresIn: 86400 })
    expect(fetchProfile).toHaveBeenCalledTimes(1)
  })

  it('shows authorization failure when profile is not an Admin', async () => {
    login.mockResolvedValue({ status: 200, data: { accessToken: 'access', refreshToken: 'refresh' } })
    fetchProfile.mockResolvedValue(false)
    renderWithProviders(<Login />, { initialEntries: ['/login'] })
    fillCredentials()
    fireEvent.click(screen.getByRole('button', { name: /Truy cập hệ thống/ }))
    expect(await screen.findByText('Tài khoản không có quyền quản trị.')).toBeInTheDocument()
  })

  it('locks submit and exposes pending text while login is unresolved', async () => {
    login.mockReturnValue(new Promise(() => undefined))
    renderWithProviders(<Login />, { initialEntries: ['/login'] })
    fillCredentials()
    fireEvent.click(screen.getByRole('button', { name: /Truy cập hệ thống/ }))
    expect(await screen.findByRole('button', { name: /Đang xác thực/ })).toBeDisabled()
  })
})
