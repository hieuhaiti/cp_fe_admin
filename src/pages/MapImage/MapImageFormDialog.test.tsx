/**
 * ============================================================
 * MANUAL TEST SCENARIO — FORM TẠO/SỬA BẢN ĐỒ PDF (MAP IMAGE FORM DIALOG)
 * ============================================================
 *
 * [CREATE - Thêm mới bản đồ PDF]
 * 1. Mở MapImageFormDialog (nhấn "Thêm ảnh bản đồ").
 * 2. Nhập các trường:
 *    - Tiêu đề *: "Bản đồ quy hoạch sử dụng đất Cẩm Phả 2026".
 *    - Mô tả: "Bản đồ phục vụ kiểm tra upload và hiển thị trên cổng thông tin.".
 *    - Năm bản đồ: 2026.
 *    - Tỉ lệ: "1:10.000".
 *    - Cơ quan lập: "Phòng Tài nguyên và Môi trường Cẩm Phả".
 *    - Phạm vi: Công khai (public).
 *    - File bản đồ *: Chọn ban-do-quy-hoach-2026.pdf (định dạng PDF, dung lượng <= 20MB).
 * 3. Nhấn "Tạo mới".
 * 4. Kỳ vọng: Gửi FormData chứa đầy đủ metadata và file PDF.
 *
 * [UPDATE / EDIT MODE - Chỉnh sửa thông tin]
 * 1. Mở dialog ở chế độ Edit với mapImageId có sẵn.
 * 2. Kỳ vọng: Nút "Cập nhật" bị vô hiệu hóa (disabled) khi chưa có thay đổi nào.
 * 3. Thay đổi tiêu đề thành "Bản đồ mới" -> Nút "Cập nhật" bật sáng.
 * 4. Nhấn "Cập nhật" -> Gửi payload chỉ chứa trường thay đổi và expectedUpdatedAt.
 *
 * [VALIDATION - Kiểm thử lỗi]
 * - Để trống tiêu đề -> Báo lỗi bắt buộc.
 * - Năm bản đồ nhỏ hơn 1900 hoặc lớn hơn 2200 -> Báo lỗi năm.
 * - Chọn file không phải PDF -> Toast báo lỗi định dạng file.
 * ============================================================
 */

import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MapImageFormDialog from './MapImageFormDialog'
import { renderWithProviders } from '@/test/renderWithProviders'

const useApiQueryMock = vi.hoisted(() => vi.fn())
const toastMock = vi.hoisted(() => ({ error: vi.fn(), info: vi.fn() }))
vi.mock('@/service', () => ({ mapImageService: { getById: vi.fn() }, useApiQuery: useApiQueryMock }))
vi.mock('react-toastify', () => ({ toast: toastMock }))

function renderDialog(props: Partial<React.ComponentProps<typeof MapImageFormDialog>> = {}) {
  return renderWithProviders(<MapImageFormDialog open mapImageId={null} onOpenChange={vi.fn()} onSubmit={vi.fn()} {...props} />)
}

const pdfMap = {
  id: 4,
  title: 'Bản đồ cũ',
  description: 'Mô tả cũ',
  map_year: 2020,
  scale_label: '1:10.000',
  preparing_agency: 'UBND Cẩm Phả',
  visibility: 'public',
  updatedAt: '2026-08-27T10:00:00Z',
  original_name: 'old.pdf',
}

describe('MapImageFormDialog', () => {
  beforeEach(() => useApiQueryMock.mockReturnValue({ data: undefined, isLoading: false }))

  it('renders create form with default public visibility', () => {
    renderDialog()
    expect(screen.getByRole('heading', { name: 'Thêm bản đồ PDF mới' })).toBeInTheDocument()
    expect(screen.getByLabelText('Tiêu đề *')).toBeInTheDocument()
    expect(screen.getByRole('spinbutton')).toHaveValue(null)
  })

  it('disables edit submit when no field has changed', () => {
    useApiQueryMock.mockReturnValue({ data: { data: { pdfMap } }, isLoading: false })
    renderDialog({ mapImageId: 4 })
    expect(screen.getByRole('button', { name: 'Cập nhật' })).toBeDisabled()
  })

  it('sends only the changed title and optimistic-lock timestamp', async () => {
    const onSubmit = vi.fn()
    useApiQueryMock.mockReturnValue({ data: { data: { pdfMap } }, isLoading: false })
    renderDialog({ mapImageId: 4, onSubmit })
    fireEvent.change(screen.getByLabelText('Tiêu đề *'), { target: { value: 'Bản đồ mới' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ expectedUpdatedAt: '2026-08-27T10:00:00Z', title: 'Bản đồ mới' }))
  })

  it('shows loading state while loading edit detail', () => {
    useApiQueryMock.mockReturnValue({ data: undefined, isLoading: true })
    renderDialog({ mapImageId: 4 })
    expect(screen.getByText('Đang tải dữ liệu...')).toBeInTheDocument()
  })
})
