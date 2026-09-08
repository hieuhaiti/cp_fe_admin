/**
 * ============================================================
 * MANUAL TEST SCENARIO — FORM TẠO/SỬA TIN TỨC (NEWS FORM DIALOG)
 * ============================================================
 *
 * [CREATE - Thêm mới tin tức]
 * 1. Mở NewsFormDialog (nhấn "Thêm tin tức").
 * 2. Nhập các trường:
 *    - Tiêu đề *: "Cẩm Phả cập nhật dữ liệu bản đồ đô thị năm 2026".
 *    - Slug: "cam-pha-cap-nhat-du-lieu-ban-do-do-thi".
 *    - Nội dung *: "Nội dung bài viết dùng để kiểm thử form quản trị tin tức.".
 *    - Tags: "gis, flood, cam-pha".
 *    - Trạng thái: Bản nháp (is_published: false).
 *    - Ảnh đại diện: Chọn thumb.jpg (file ảnh hợp lệ JPG/PNG <= 10MB).
 * 3. Nhấn "Tạo mới".
 * 4. Kỳ vọng: Gửi FormData multipart đúng hợp đồng, các tag trùng lặp được chuẩn hóa.
 *
 * [UPDATE / EDIT MODE - Chỉnh sửa tin tức]
 * 1. Mở dialog ở chế độ Edit với newsId có sẵn.
 * 2. Kỳ vọng: Form tự động tải đúng Tiêu đề, Nội dung, Slug, Tags, Trạng thái từ server.
 * 3. Nhấn "Cập nhật" -> Gửi payload cập nhật thành công.
 *
 * [VALIDATION - Kiểm thử lỗi]
 * - Để trống tiêu đề (< 5 ký tự) -> Báo lỗi "Tiêu đề phải có ít nhất 5 ký tự".
 * - Để trống nội dung -> Báo lỗi "Nội dung là bắt buộc".
 * - Chọn file tài liệu (ví dụ: thumb.pdf) -> Toast báo "Chỉ chấp nhận file ảnh".
 * ============================================================
 */

import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NewsFormDialog from './NewsFormDialog'
import { renderWithProviders } from '@/test/renderWithProviders'
import { makeFile } from '@/test/fixtures'

const useApiQueryMock = vi.hoisted(() => vi.fn())
const toastMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))
vi.mock('@/service', () => ({ newsService: { getById: vi.fn() }, useApiQuery: useApiQueryMock }))
vi.mock('react-toastify', () => ({ toast: toastMock }))

function renderDialog(props: Partial<React.ComponentProps<typeof NewsFormDialog>> = {}) {
  return renderWithProviders(<NewsFormDialog open newsId={null} onOpenChange={vi.fn()} onSubmit={vi.fn()} {...props} />)
}

describe('NewsFormDialog', () => {
  beforeEach(() => useApiQueryMock.mockReturnValue({ data: undefined, isLoading: false }))

  it('shows validation errors for missing title and content', async () => {
    const onSubmit = vi.fn()
    renderDialog({ onSubmit })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mới' }))
    expect(await screen.findByText('Tiêu đề phải có ít nhất 5 ký tự')).toBeInTheDocument()
    expect(screen.getByText('Nội dung là bắt buộc')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits normalized FormData including repeated tags', async () => {
    const onSubmit = vi.fn()
    renderDialog({ onSubmit })
    fireEvent.change(screen.getByLabelText('Tiêu đề *'), { target: { value: 'Tin thử nghiệm' } })
    fireEvent.change(screen.getByLabelText('Slug'), { target: { value: 'tin-thu-nghiem' } })
    fireEvent.change(screen.getByLabelText('Nội dung *'), { target: { value: 'Nội dung' } })
    fireEvent.change(screen.getByLabelText('Tags (phân cách bằng dấu phẩy)'), { target: { value: 'gis, flood, gis' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mới' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const payload = onSubmit.mock.calls[0][0] as FormData
    expect(payload.get('slug')).toBe('tin-thu-nghiem')
    expect(payload.getAll('tags')).toEqual(['gis', 'flood', 'gis'])
    expect(payload.get('is_published')).toBe('false')
  })

  it('prevents invalid thumbnail files through upload validation', () => {
    renderDialog()
    fireEvent.change(document.querySelector('input[type=file]') as HTMLInputElement, {
      target: { files: [makeFile('thumb.pdf', 'application/pdf')] },
    })
    expect(toastMock.error).toHaveBeenCalledWith(expect.stringContaining('Chỉ chấp nhận file ảnh'))
  })

  it('preloads edit data and shows update action', () => {
    useApiQueryMock.mockReturnValue({ data: { data: { news: { id: 2, title: 'Tin cũ', content: 'Nội dung cũ', slug: 'tin-cu', tags: ['gis'], is_published: true, is_featured: false } } }, isLoading: false })
    renderDialog({ newsId: 2 })
    expect(screen.getByRole('heading', { name: 'Chỉnh sửa tin tức' })).toBeInTheDocument()
    expect(screen.getByLabelText('Tiêu đề *')).toHaveValue('Tin cũ')
    expect(screen.getByRole('button', { name: 'Cập nhật' })).toBeInTheDocument()
  })
})
