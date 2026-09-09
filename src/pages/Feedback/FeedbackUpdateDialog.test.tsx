/**
 * ============================================================
 * MANUAL TEST SCENARIO — FORM CẬP NHẬT TRẠNG THÁI PHẢN ÁNH (FEEDBACK UPDATE DIALOG)
 * ============================================================
 *
 * [UPDATE - Cập nhật trạng thái xử lý]
 * 1. Mở FeedbackUpdateDialog cho phản ánh "Phản ánh thử nghiệm" (trạng thái hiện tại: Chờ tiếp nhận / pending).
 * 2. Chọn trạng thái mới: "Đang xem xét" (under_review), "Đã duyệt" (approved), hoặc "Từ chối" (rejected).
 * 3. Nếu chọn "Từ chối": Nhập lý do (ví dụ: "Phản ánh không thuộc thẩm quyền xử lý của đơn vị.").
 * 4. Nhấn "Cập nhật trạng thái".
 * 5. Kỳ vọng: Gửi mutation cập nhật trạng thái thành công, form khóa tương tác khi đang xử lý.
 *
 * [VALIDATION - Kiểm thử lỗi]
 * - Chọn "Từ chối" nhưng để trống lý do (< 5 ký tự) -> Báo lỗi "Vui lòng nhập lý do từ chối có ít nhất 5 ký tự".
 * ============================================================
 */

import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import FeedbackUpdateDialog from './FeedbackUpdateDialog'
import { renderWithProviders } from '@/test/renderWithProviders'
import type { CitizenFeedback } from '@/types/api'

const feedback: CitizenFeedback = {
  id: 1,
  reference_code: 'CP-2026-00000001',
  title: 'Phản ánh thử nghiệm',
  status: 'pending',
  category: 'hien_trang',
  priority: 'normal',
}

function renderDialog(overrides: Partial<React.ComponentProps<typeof FeedbackUpdateDialog>> = {}) {
  return renderWithProviders(
    <FeedbackUpdateDialog
      open
      feedback={feedback}
      onOpenChange={vi.fn()}
      onUpdateStatus={vi.fn()}
      {...overrides}
    />
  )
}

describe('FeedbackUpdateDialog', () => {
  it('renders feedback title and allowed pending transitions', () => {
    renderDialog()
    expect(screen.getByText('Phản ánh thử nghiệm')).toBeInTheDocument()
    expect(screen.getByText('CP-2026-00000001')).toBeInTheDocument()
    const select = screen.getByRole('combobox').parentElement?.querySelector('select')
    expect(select).toHaveValue('under_review')
    expect(select?.querySelectorAll('option')).toHaveLength(3)
    expect(select?.textContent).toContain('Đang xem xét')
    expect(select?.textContent).toContain('Đã duyệt')
    expect(select?.textContent).toContain('Từ chối')
  })

  it('defaults to resolved for approved feedback and pre-fills reason', () => {
    const approvedFeedback: CitizenFeedback = {
      id: 27,
      reference_code: 'CP-2026-00000027',
      description: 'ngập sâu tại khu vực Quang hanh',
      title: 'ngập sâu tại khu vực Quang hanh',
      status: 'approved',
      category: 'ngap_lut',
      priority: 'high',
      review_reason: 'Đã xác minh hiện trường, chuẩn bị xử lý',
    }
    renderDialog({ feedback: approvedFeedback })

    const select = screen.getByRole('combobox').parentElement?.querySelector('select')
    expect(select).toHaveValue('resolved')
    expect(select?.querySelectorAll('option')).toHaveLength(1)
    expect(select?.textContent).toContain('Đã xử lý')

    const textarea = screen.getByLabelText(/Lý do xử lý/) as HTMLTextAreaElement
    expect(textarea.value).toBe('Đã xác minh hiện trường, chuẩn bị xử lý')
  })

  it('shows terminal notice when feedback is already resolved', () => {
    const resolvedFeedback: CitizenFeedback = {
      id: 28,
      reference_code: 'CP-2026-00000028',
      title: 'test phản ánh hiện trường',
      status: 'resolved',
      category: 'hien_trang',
      priority: 'normal',
    }
    renderDialog({ feedback: resolvedFeedback })
    expect(screen.getByText(/không có trạng thái tiếp theo khả dụng/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cập nhật trạng thái' })).toBeDisabled()
  })

  it('requires a reason when rejected', async () => {
    const onUpdateStatus = vi.fn()
    renderDialog({ onUpdateStatus })
    const select = screen.getByRole('combobox').parentElement?.querySelector('select') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'rejected' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật trạng thái' }))
    expect(await screen.findByText('Vui lòng nhập lý do từ chối có ít nhất 5 ký tự')).toBeInTheDocument()
    expect(onUpdateStatus).not.toHaveBeenCalled()
  })

  it('disables actions and shows loading text while saving', () => {
    const onOpenChange = vi.fn()
    renderDialog({ isLoading: true, onOpenChange })
    expect(screen.getByRole('button', { name: 'Đang lưu...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Hủy' })).toBeDisabled()
  })
})
