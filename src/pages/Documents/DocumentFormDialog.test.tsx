/**
 * ============================================================
 * MANUAL TEST SCENARIO — FORM TẠO/SỬA VĂN BẢN (DOCUMENT FORM DIALOG)
 * ============================================================
 *
 * [CREATE - Thêm mới văn bản]
 * 1. Mở DocumentFormDialog (nhấn "Thêm văn bản").
 * 2. Nhập các trường:
 *    - Tiêu đề *: "Quyết định thử nghiệm Cẩm Phả".
 *    - Mã văn bản *: "01/QĐ".
 *    - Cơ quan ban hành *: "UBND Cẩm Phả".
 *    - Ngày ban hành: 2026-08-30.
 *    - Mô tả: "Văn bản phục vụ kiểm tra luồng tạo hồ sơ.".
 *    - Phạm vi: Công khai (public).
 *    - File văn bản *: Chọn decision.pdf (định dạng PDF, dung lượng <= 50MB).
 * 3. Nhấn "Tạo mới".
 * 4. Kỳ vọng: Gửi FormData multipart chứa đầy đủ title, documentCode, issuingAgency, file.
 *
 * [UPDATE / EDIT MODE - Chỉnh sửa thông tin văn bản]
 * 1. Mở dialog ở chế độ Edit với documentId có sẵn.
 * 2. Kỳ vọng: Nút "Cập nhật" bị vô hiệu hóa khi chưa thay đổi dữ liệu.
 * 3. Sửa tiêu đề thành "Quyết định sửa đổi" -> Nút "Cập nhật" bật sáng -> Nhấn cập nhật.
 *
 * [VALIDATION - Kiểm thử lỗi]
 * - Để trống file khi tạo mới -> Toast báo "Vui lòng chọn file văn bản để tải lên".
 * - Để trống tiêu đề, mã văn bản hoặc cơ quan ban hành -> Báo lỗi bắt buộc.
 * ============================================================
 */

import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DocumentFormDialog from './DocumentFormDialog'
import { renderWithProviders } from '@/test/renderWithProviders'
import { makeFile } from '@/test/fixtures'

const toastMock = vi.hoisted(() => ({ error: vi.fn(), info: vi.fn() }))
const useApiQueryMock = vi.hoisted(() => vi.fn())
vi.mock('@/service', () => ({ documentService: { getById: vi.fn() }, useApiQuery: useApiQueryMock }))
vi.mock('react-toastify', () => ({ toast: toastMock }))

function renderDialog(props: Partial<React.ComponentProps<typeof DocumentFormDialog>> = {}) {
  return renderWithProviders(<DocumentFormDialog open documentId={null} onOpenChange={vi.fn()} onSubmit={vi.fn()} {...props} />)
}

describe('DocumentFormDialog', () => {
  beforeEach(() => useApiQueryMock.mockReturnValue({ data: undefined, isLoading: false }))

  it('requires a document file when creating', async () => {
    renderDialog()
    fireEvent.change(screen.getByLabelText('Tiêu đề *'), { target: { value: 'Quyết định thử nghiệm' } })
    fireEvent.change(screen.getByLabelText('Mã văn bản *'), { target: { value: '01/QD' } })
    fireEvent.change(screen.getByLabelText('Cơ quan ban hành *'), { target: { value: 'UBND Cẩm Phả' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mới' }))
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('Vui lòng chọn file văn bản để tải lên'))
  })

  it('submits FormData with required fields and file', async () => {
    const onSubmit = vi.fn()
    renderDialog({ onSubmit })
    fireEvent.change(document.querySelector('input[type=file]') as HTMLInputElement, { target: { files: [makeFile('decision.pdf', 'application/pdf')] } })
    fireEvent.change(screen.getByLabelText('Tiêu đề *'), { target: { value: ' Quyết định thử nghiệm ' } })
    fireEvent.change(screen.getByLabelText('Mã văn bản *'), { target: { value: ' 01/QD ' } })
    fireEvent.change(screen.getByLabelText('Cơ quan ban hành *'), { target: { value: ' UBND Cẩm Phả ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mới' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const payload = onSubmit.mock.calls[0][0] as FormData
    expect(payload.get('title')).toBe('Quyết định thử nghiệm')
    expect(payload.get('documentCode')).toBe('01/QD')
    expect(payload.get('issuingAgency')).toBe('UBND Cẩm Phả')
    expect(payload.get('file')).toBeInstanceOf(File)
  })

  it('disables update until an edit field changes', () => {
    useApiQueryMock.mockReturnValue({ data: { data: { id: 3, title: 'Cũ', document_code: '01', issuing_agency: 'UBND', visibility: 'public', original_name: 'old.pdf' } }, isLoading: false })
    renderDialog({ documentId: 3 })
    const button = screen.getByRole('button', { name: 'Cập nhật' })
    expect(button).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Tiêu đề *'), { target: { value: 'Mới' } })
    expect(button).not.toBeDisabled()
  })
})

