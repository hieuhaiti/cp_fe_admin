/**
 * ============================================================
 * MANUAL TEST SCENARIO — PHÁT VÀ GỬI THÔNG BÁO HỆ THỐNG (NOTIFICATION SEND)
 * ============================================================
 *
 * [CREATE / SEND - Gửi thông báo đến người dùng]
 * 1. Mở trang Gửi thông báo (/notifications/send).
 * 2. Chọn đối tượng nhận:
 *    - "Tất cả người dùng" (target: 'all').
 *    - Hoặc "Theo vai trò": Chọn Sở TN&MT, UBND Phường...
 *    - Hoặc "Người dùng cụ thể": Tìm kiếm theo tên/email và chọn từ combobox.
 * 3. Chọn Kênh: "Hệ thống" (channel: 'system') và Loại: "Thông báo chung" (type: 'announcement').
 * 4. Nhập Tiêu đề *: "Thông báo nâng cấp hệ thống GIS Cẩm Phả".
 * 5. Nhập Nội dung *: "Hệ thống sẽ tiến hành bảo trì định kỳ từ 22:00 đến 23:00 ngày hôm nay.".
 * 6. Nhấn nút "Gửi thông báo".
 * 7. Kỳ vọng: Gửi thành công, các tài khoản nhận được notification trong chuông thông báo.
 *
 * [VALIDATION - Kiểm thử lỗi]
 * - Để trống Tiêu đề hoặc Nội dung -> Thông báo lỗi bắt buộc nhập.
 * ============================================================
 */

import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NotificationSendPage from './index'
import { renderWithProviders } from '@/test/renderWithProviders'
import type { SendNotificationBody } from '@/types/api'

const sendMutate = vi.hoisted(() => vi.fn())
const queryMock = vi.hoisted(() => vi.fn())
const mutationMock = vi.hoisted(() => vi.fn())

vi.mock('@/service', () => ({
  notificationService: { send: vi.fn() },
  userService: { getAll: vi.fn() },
  useApiQuery: queryMock,
  useApiMutation: mutationMock,
}))
vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

describe('NotificationSendPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryMock.mockReturnValue({ data: { data: { items: [] } }, isLoading: false })
    mutationMock.mockReturnValue({ mutate: sendMutate, isPending: false })
  })

  it('renders the real send form even though App does not mount this module', () => {
    renderWithProviders(<NotificationSendPage />)
    expect(screen.getByRole('heading', { name: 'Gửi thông báo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gửi thông báo' })).toBeEnabled()
  })

  it('rejects empty title/body without mutating', () => {
    renderWithProviders(<NotificationSendPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Gửi thông báo' }))
    expect(sendMutate).not.toHaveBeenCalled()
  })

  it('submits exact all-recipient SendNotificationBody defaults', () => {
    renderWithProviders(<NotificationSendPage />)
    const [title, body] = screen.getAllByRole('textbox')
    fireEvent.change(title, { target: { value: 'Cảnh báo hệ thống' } })
    fireEvent.change(body, { target: { value: 'Nội dung thông báo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi thông báo' }))
    const expected: SendNotificationBody = {
      target: 'all', channel: 'system', type: 'announcement',
      title: 'Cảnh báo hệ thống', body: 'Nội dung thông báo',
    }
    expect(sendMutate).toHaveBeenCalledWith(expected, expect.objectContaining({ onSuccess: expect.any(Function) }))
  })

  it('disables send action while pending', () => {
    mutationMock.mockReturnValue({ mutate: sendMutate, isPending: true })
    renderWithProviders(<NotificationSendPage />)
    expect(screen.getByRole('button', { name: 'Đang gửi...' })).toBeDisabled()
  })
})
