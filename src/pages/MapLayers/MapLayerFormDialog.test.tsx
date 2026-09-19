/**
 * ============================================================
 * MANUAL TEST SCENARIO — FORM TẠO/SỬA LỚP DỮ LIỆU (MAP LAYER FORM DIALOG)
 * ============================================================
 *
 * [CREATE - Thêm lớp dữ liệu mới]
 * 1. Mở MapLayerFormDialog (nhấn "Thêm lớp dữ liệu").
 * 2. Nhập các trường:
 *    - Tên lớp dữ liệu: Lớp Ngập Lụt Cẩm Phả (Mã lớp tự sinh: lop_ngap_lut_cam_pha)
 *    - Nhóm lớp: Ranh giới hành chính / Rừng / Ngập lụt
 *    - Kiểu hình học: Polygon (hoặc Line, Point)
 *    - Phạm vi: Nội bộ (is_public: false) hoặc Công khai (is_public: true)
 *    - Properties (JSON): {"source": "survey_2026", "accuracy": "high"}
 *    - Chú giải Legend: Nhãn "Khu vực ngập sâu" / Màu "#EF4444"
 * 3. Nhấn "Tạo mới".
 * 4. Kỳ vọng: Dữ liệu được chuẩn hóa, code sinh tự động chuẩn snake_case, submit thành công.
 *
 * [UPDATE / EDIT MODE - Chỉnh sửa lớp dữ liệu]
 * 1. Mở dialog với layerCode có sẵn (ví dụ: flood_layer).
 * 2. Kỳ vọng: Form tải đúng tên lớp, nhóm, kiểu hình học, trạng thái; trường mã code được giữ nguyên không đổi.
 *
 * [VALIDATION - Kiểm thử lỗi]
 * - Để trống tên lớp dữ liệu -> Báo lỗi bắt buộc.
 * - Nhập Properties JSON sai cấu trúc (ví dụ: "[1,2]") -> Báo lỗi định dạng JSON.
 * ============================================================
 */

import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MapLayerFormDialog from './MapLayerFormDialog'
import { renderWithProviders } from '@/test/renderWithProviders'

const queryMock = vi.hoisted(() => vi.fn())
vi.mock('@/service', () => ({ mapLayerService: { getByCode: vi.fn() }, useApiQuery: queryMock }))

function renderDialog(props: Partial<React.ComponentProps<typeof MapLayerFormDialog>> = {}) {
  return renderWithProviders(<MapLayerFormDialog open layerCode={null} onOpenChange={vi.fn()} onSubmit={vi.fn()} {...props} />)
}

describe('MapLayerFormDialog', () => {
  beforeEach(() => queryMock.mockReturnValue({ data: undefined, isLoading: false }))

  it('renders create mode and validates a missing layer name', async () => {
    const onSubmit = vi.fn()
    renderDialog({ onSubmit })
    expect(screen.getByRole('heading', { name: 'Thêm lớp dữ liệu mới' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mới' }))
    await waitFor(() => expect(onSubmit).not.toHaveBeenCalled())
  })

  it('creates a layer payload with normalized geometry and generated code', () => {
    const onSubmit = vi.fn()
    renderDialog({ onSubmit })
    fireEvent.change(screen.getByLabelText('Tên lớp dữ liệu *'), { target: { value: 'Lớp Ngập Lụt' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mới' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      code: 'lop_ngap_lut', name_vi: 'Lớp Ngập Lụt', geometry_type: 'POLYGON', epsg_code: 4326,
    }))
  })



  it('preloads edit mode and preserves the existing code and defaultStyle', () => {
    queryMock.mockReturnValue({
      data: {
        data: {
          code: 'flood_layer',
          name: 'Lớp cũ',
          name_vi: 'Lớp cũ',
          category: 'forest_district',
          category_name: 'Rừng',
          geometry_type: 'POLYGON',
          is_active: true,
          is_public: true,
          metadata: {
            defaultStyle: {
              fillColor: '#FF0000',
              fillOpacity: 0.8,
            },
          },
        },
      },
      isLoading: false,
    })
    const onSubmit = vi.fn()
    renderDialog({ layerCode: 'flood_layer', onSubmit })
    expect(screen.getByRole('heading', { name: 'Chỉnh sửa lớp dữ liệu' })).toBeInTheDocument()
    expect(screen.getByDisplayValue('Lớp cũ')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'flood_layer',
        metadata: {
          defaultStyle: {
            fillColor: '#FF0000',
            fillOpacity: 0.8,
          },
        },
      })
    )
  })

  it('allows toggling between UI and JSON mode for defaultStyle and submits correctly', async () => {
    const onSubmit = vi.fn()
    renderDialog({ onSubmit })
    fireEvent.change(screen.getByLabelText('Tên lớp dữ liệu *'), { target: { value: 'Lớp Thử Nghiệm' } })

    // Bấm nút JSON thứ hai (của phần kiểu vẽ defaultStyle)
    const jsonButtons = screen.getAllByRole('button', { name: /JSON/i })
    expect(jsonButtons.length).toBe(2)
    fireEvent.click(jsonButtons[1])

    const styleTextarea = screen.getByPlaceholderText(/fillColor/i)
    expect(styleTextarea).toBeInTheDocument()

    fireEvent.change(styleTextarea, {
      target: {
        value: JSON.stringify({
          fillColor: '#10B981',
          fillOpacity: 0.65,
          strokeColor: '#047857',
        }),
      },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Tạo mới' }))
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'lop_thu_nghiem',
          metadata: {
            defaultStyle: {
              fillColor: '#10B981',
              fillOpacity: 0.65,
              strokeColor: '#047857',
            },
          },
        })
      )
    })
  })

  it('keeps property row visible when user clears the value in input (reproduce and prevent bug)', () => {
    queryMock.mockReturnValue({
      data: {
        data: {
          code: 'test_layer',
          name: 'Lớp Test',
          name_vi: 'Lớp Test',
          geometry_type: 'POLYGON',
          metadata: {
            defaultStyle: {
              fillColor: '#3388FF',
              fillOpacity: 0.6,
            },
          },
        },
      },
      isLoading: false,
    })

    renderDialog({ layerCode: 'test_layer' })

    // Ban đầu có 2 thuộc tính: fillColor và fillOpacity
    expect(screen.getByDisplayValue('#3388FF')).toBeInTheDocument()
    const fillOpacityInput = screen.getByDisplayValue('0.6')
    expect(fillOpacityInput).toBeInTheDocument()

    // Người dùng xóa sạch giá trị của fillOpacity (trở về rỗng '')
    fireEvent.change(fillOpacityInput, { target: { value: '' } })

    // fillOpacity không được bị xóa khỏi StyleEditor! Nó phải vẫn là một input trên form
    // Nếu bị cleanStyleObject xóa, fillOpacity sẽ biến mất khỏi danh sách đang sửa và quay lại danh sách "Chọn thuộc tính để thêm"
    expect(screen.queryByPlaceholderText('0.6')).toBeInTheDocument()

    // Tiếp tục xóa fillColor
    const fillColorInput = screen.getByDisplayValue('#3388FF')
    fireEvent.change(fillColorInput, { target: { value: '' } })

    // fillColor input vẫn phải còn đó (được hiển thị với placeholder #3388FF)
    expect(screen.queryByPlaceholderText('#3388FF')).toBeInTheDocument()
  })
})
