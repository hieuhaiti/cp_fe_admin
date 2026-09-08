/**
 * ============================================================
 * MANUAL TEST SCENARIO — CÁC TRANG LỖI HỆ THỐNG (HTTP ERROR PAGES)
 * ============================================================
 *
 * [READ & RECOVERY - Kiểm tra trang báo lỗi và nút điều hướng]
 * 1. Truy cập trực tiếp các route lỗi:
 *    - /400: Lỗi yêu cầu không hợp lệ (Bad Request).
 *    - /401: Lỗi chưa xác thực (Unauthorized).
 *    - /403: Lỗi không có quyền truy cập (Forbidden).
 *    - /404: Lỗi không tìm thấy trang (Not Found).
 *    - /500: Lỗi máy chủ nội bộ (Internal Server Error).
 *    - /503: Lỗi dịch vụ tạm thời không khả dụng (Service Unavailable).
 * 2. Kỳ vọng: Giao diện hiển thị mã lỗi tương ứng và nút hành động khôi phục (Về trang chủ / Đăng nhập lại).
 * ============================================================
 */

import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import BadRequestPage from './400BadRequestPage'
import UnauthorizedPage from './401UnauthorizedPage'
import ForbiddenPage from './403ForbiddenPage'
import NotFoundPage from './404NotFoundPage'
import InternalServerErrorPage from './500InternalServerErrorPage'
import ServiceUnavailablePage from './503ServiceUnavailablePage'
import { renderWithProviders } from '@/test/renderWithProviders'

const pages = [
  [BadRequestPage, '400'],
  [UnauthorizedPage, '401'],
  [ForbiddenPage, '403'],
  [NotFoundPage, '404'],
  [InternalServerErrorPage, '500'],
  [ServiceUnavailablePage, '503'],
] as const

describe('Admin error pages', () => {
  it.each(pages)('renders semantic main and status code for %s', (Page, code) => {
    renderWithProviders(<Page />)
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByText(code)).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('keeps 403 recovery button functional', () => {
    renderWithProviders(<ForbiddenPage />, { initialEntries: ['/403'] })
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))
    expect(window.location.pathname).toBe('/')
  })
})
