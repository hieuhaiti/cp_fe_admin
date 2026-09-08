/**
 * ============================================================
 * MANUAL TEST SCENARIO — FORM TẠO/SỬA NGƯỜI DÙNG (USER FORM DIALOG)
 * ============================================================
 *
 * [CREATE - Thêm người dùng mới]
 * 1. Mở UserFormDialog (nhấn "Thêm người dùng").
 * 2. Nhập các trường:
 *    - Email: cb.sotnmt.campha@quangninh.gov.vn
 *    - Mật khẩu: CamPha@2026!
 *    - Họ và tên: Lê Văn Thành
 *    - Số điện thoại: 0912345678
 *    - Vai trò: Sở TN&MT (so_tnmt) / Quản trị hệ thống (system_admin) / Người dân (citizen)
 * 3. Nhấn "Tạo mới".
 * 4. Kỳ vọng: Dữ liệu được trim khoảng trắng, phone rỗng được bỏ qua, payload gửi đúng roleCode.
 *
 * [READ / DETAIL MODE - Xem thông tin người dùng hiện tại]
 * 1. Mở dialog với userId cụ thể (edit mode).
 * 2. Kỳ vọng: Header hiển thị "Chỉnh sửa người dùng", thông tin email, họ tên, vai trò được hiển thị đầy đủ.
 *
 * [VALIDATION - Kiểm thử thông báo lỗi]
 * - Để trống email hoặc nhập "user@" -> Báo "Email không hợp lệ".
 * - Mật khẩu "123" -> Báo "Mật khẩu tối thiểu 6 ký tự".
 * - Họ và tên "A" -> Báo "Họ tên phải có ít nhất 2 ký tự".
 * - Số điện thoại "abc123" -> Báo "Số điện thoại không hợp lệ (8-20 ký tự)".
 * ============================================================
 */

import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import UserFormDialog from './UserFormDialog'
import { renderWithProviders } from '@/test/renderWithProviders'

const useApiQueryMock = vi.hoisted(() => vi.fn())
vi.mock('@/service', () => ({
  userService: { getById: vi.fn() },
  useApiQuery: useApiQueryMock,
}))

function renderDialog(props: Partial<React.ComponentProps<typeof UserFormDialog>> = {}) {
  return renderWithProviders(
    <UserFormDialog open userId={null} onOpenChange={vi.fn()} onSubmit={vi.fn()} {...props} />,
  )
}

beforeEach(() => {
  useApiQueryMock.mockReturnValue({ data: undefined })
})

describe('UserFormDialog', () => {
  it('renders create form with default citizen role', () => {
    renderDialog()
    expect(screen.getByRole('heading', { name: 'Thêm người dùng mới' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email *')).toBeInTheDocument()
    expect(screen.getByLabelText('Mật khẩu *')).toBeInTheDocument()
    expect(screen.getByLabelText('Họ và tên *')).toBeInTheDocument()
  })

  it('shows validation errors and does not submit an empty form', async () => {
    const onSubmit = vi.fn()
    renderDialog({ onSubmit })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mới' }))
    expect(await screen.findByText('Email không hợp lệ')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits trimmed values and omits an empty phone', async () => {
    const onSubmit = vi.fn()
    renderDialog({ onSubmit })
    fireEvent.change(screen.getByLabelText('Email *'), { target: { value: ' admin@example.com ' } })
    fireEvent.change(screen.getByLabelText('Mật khẩu *'), { target: { value: 'secret123' } })
    fireEvent.change(screen.getByLabelText('Họ và tên *'), { target: { value: ' Nguyễn Văn A ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mới' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit).toHaveBeenCalledWith({
      email: 'admin@example.com', password: 'secret123', fullName: 'Nguyễn Văn A', roleCode: 'citizen',
    })
  })

  it('closes when cancel is clicked', () => {
    const onOpenChange = vi.fn()
    renderDialog({ onOpenChange })
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows existing data in edit mode without rendering a create form', () => {
    useApiQueryMock.mockReturnValue({ data: { data: { id: 7, email: 'old@example.com', fullName: 'Người dùng cũ', roleCode: 'citizen', isActive: true } } })
    renderDialog({ userId: 7 })
    expect(screen.getByRole('heading', { name: 'Chỉnh sửa người dùng' })).toBeInTheDocument()
    expect(screen.getByText('old@example.com')).toBeInTheDocument()
    expect(screen.getByText('Người dùng cũ')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tạo mới' })).not.toBeInTheDocument()
  })
})
