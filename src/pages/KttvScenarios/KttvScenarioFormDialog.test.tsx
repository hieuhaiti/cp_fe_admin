/**
 * ============================================================
 * MANUAL TEST SCENARIO — FORM TẠO/SỬA KỊCH BẢN THỦY VĂN (KTTV SCENARIO FORM DIALOG)
 * ============================================================
 *
 * [CREATE - Thêm mới kịch bản]
 * 1. Mở KttvScenarioFormDialog (nhấn "Thêm kịch bản").
 * 2. Nhập các trường:
 *    - Tên kịch bản *: "Kịch bản Mưa Lớn" (Mã kịch bản tự sinh: "kich_ban_mua_lon").
 *    - Lượng mưa tối thiểu: 25.5 mm.
 *    - Lượng mưa tối đa: 100 mm.
 *    - Triều tối thiểu / tối đa: Để trống (null).
 *    - Lớp bản đồ: Chọn "flood_layer" từ combobox danh sách layer.
 *    - Mô tả: "Mô tả thử nghiệm kịch bản ngập lụt.".
 *    - Trạng thái: Kích hoạt (isActive: true).
 * 3. Nhấn "Tạo mới".
 * 4. Kỳ vọng: Payload gửi đúng format Server (code, nameVi, layerCode, minRainfall, maxRainfall, minTide, maxTide, isActive).
 *
 * [UPDATE / EDIT MODE - Chỉnh sửa kịch bản]
 * 1. Mở dialog ở chế độ Edit với scenarioId có sẵn.
 * 2. Kỳ vọng: Form tự động điền đúng tên kịch bản cũ, các ngưỡng mưa và triều.
 * 3. Sửa tên thành "Kịch bản mới" -> Nhấn "Cập nhật".
 * 4. Kỳ vọng: Gửi update mutation thành công.
 *
 * [VALIDATION - Kiểm thử lỗi]
 * - Để trống mã hoặc tên kịch bản -> Báo lỗi bắt buộc.
 * - Nhập lượng mưa không phải số (ví dụ "abc") -> Báo lỗi "Phải là số hợp lệ".
 * ============================================================
 */

import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import KttvScenarioFormDialog from './KttvScenarioFormDialog'
import { renderWithProviders } from '@/test/renderWithProviders'

const queryMock = vi.hoisted(() => vi.fn())
const mutationMock = vi.hoisted(() => vi.fn())
const createMutate = vi.hoisted(() => vi.fn())
const updateMutate = vi.hoisted(() => vi.fn())
const serviceMocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), getById: vi.fn(), getAll: vi.fn() }))
vi.mock('@/service', () => ({ kttvScenarioService: serviceMocks, mapLayerService: serviceMocks, useApiQuery: queryMock, useApiMutation: mutationMock }))

function renderDialog(props: Partial<React.ComponentProps<typeof KttvScenarioFormDialog>> = {}) {
  return renderWithProviders(<KttvScenarioFormDialog open scenarioId={null} onOpenChange={vi.fn()} {...props} />)
}

let mutationInvocation = 0
function arrangeMutations(pending = false) {
  mutationInvocation = 0
  mutationMock.mockImplementation(() => {
    const isCreate = mutationInvocation++ % 2 === 0
    return { mutate: isCreate ? createMutate : updateMutate, isPending: pending }
  })
}

const layersResponse = { data: { items: [{ id: 7, code: 'flood_layer', name_vi: 'Lớp ngập' }] } }
const editResponse = {
  data: {
    id: 3,
    code: 'scenario_1',
    name_vi: 'Kịch bản cũ',
    min_rainfall: 10,
    max_rainfall: null,
    min_tide: null,
    max_tide: null,
    layer_code: 'flood_layer',
    description: '',
    is_active: true,
  },
}
const caiTaoResponse = {
  data: {
    ...editResponse.data,
    type: 'cai_tao',
  },
}

describe('KttvScenarioFormDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryMock.mockImplementation((key: unknown) => String(key).includes('detail') ? { data: undefined, error: null, isLoading: false } : { data: layersResponse, error: null, isLoading: false })
    arrangeMutations()
  })

  it('renders create mode and validates required fields', async () => {
    renderDialog()
    expect(screen.getByRole('heading', { name: 'Thêm kịch bản ngập lụt' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mới' }))
    expect(await screen.findByText('Mã kịch bản là bắt buộc')).toBeInTheDocument()
    expect(screen.getByText('Tên kịch bản là bắt buộc')).toBeInTheDocument()
  })

  it('respects defaultType when opening in create mode', () => {
    renderDialog({ defaultType: 'cai_tao' })
    expect(screen.getByRole('combobox', { name: 'Phân loại kịch bản' })).toHaveTextContent('Cải tạo thoát nước')
  })

  it('rejects non-numeric minimum rainfall', async () => {
    renderDialog()
    fireEvent.change(screen.getByLabelText('Mã kịch bản *'), { target: { value: 'scenario_1' } })
    fireEvent.change(screen.getByLabelText('Tên kịch bản *'), { target: { value: 'Kịch bản thử' } })
    fireEvent.change(screen.getByLabelText('Lượng mưa tối thiểu (mm)'), { target: { value: 'abc' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mới' }))
    expect(await screen.findByText('Phải là số hợp lệ')).toBeInTheDocument()
  })

  it('submits exact Server-aligned create payload with numeric/null values and defaulted layer', async () => {
    renderDialog()
    fireEvent.change(screen.getByLabelText('Tên kịch bản *'), { target: { value: 'Kịch bản Mưa Lớn' } })
    fireEvent.change(screen.getByLabelText('Lượng mưa tối thiểu (mm)'), { target: { value: '25.5' } })
    fireEvent.change(screen.getByLabelText('Lượng mưa tối đa (mm)'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('Triều tối thiểu (m)'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Mô tả'), { target: { value: '  Mô tả thử  ' } })
    // Lớp bản đồ đã được tự động điền default từ layersResponse
    expect(screen.getByRole('button', { name: /flood_layer/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mới' }))
    await waitFor(() => expect(createMutate).toHaveBeenCalledWith({
      code: 'kich_ban_mua_lon', nameVi: 'Kịch bản Mưa Lớn', layerCode: 'flood_layer',
      description: 'Mô tả thử', isActive: true, minRainfall: 25.5, maxRainfall: 100,
      minTide: null, maxTide: null,
      type: 'hien_trang', rcp: null,
    }))
  })

  it('prefills edit data and linked map layer properly', async () => {
    queryMock.mockImplementation((key: unknown) => String(key).includes('detail') ? {
      data: editResponse,
      error: null, isLoading: false,
    } : { data: layersResponse, error: null, isLoading: false })
    renderDialog({ scenarioId: 3 })
    expect(screen.getByLabelText('Tên kịch bản *')).toHaveValue('Kịch bản cũ')
    expect(screen.getByRole('button', { name: /flood_layer/ })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Tên kịch bản *'), { target: { value: 'Kịch bản mới' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật' }))
    await waitFor(() => expect(updateMutate).toHaveBeenCalledWith(expect.objectContaining({ code: 'scenario_1', nameVi: 'Kịch bản mới', layerCode: 'flood_layer', minRainfall: 10 })))
    expect(createMutate).not.toHaveBeenCalled()
  })

  it('auto-fills default scenario classification on edit with cai_tao type', () => {
    queryMock.mockImplementation((key: unknown) =>
      String(key).includes('detail')
        ? {
            data: caiTaoResponse,
            error: null,
            isLoading: false,
          }
        : { data: layersResponse, error: null, isLoading: false }
    )
    renderDialog({ scenarioId: 3 })
    expect(screen.getByRole('combobox', { name: 'Phân loại kịch bản' })).toHaveTextContent('Cải tạo thoát nước')
  })

  it('auto-fills default scenario classification from initialScenario immediately', () => {
    const initial = {
      id: 5,
      code: 'scenario_5',
      name_vi: 'Kịch bản quy hoạch',
      type: 'quy_hoach' as const,
      rcp: 'rcp85' as const,
      min_rainfall: '50',
      max_rainfall: null,
      min_tide: null,
      max_tide: null,
      layer_code: 'flood_layer',
      description: '',
      is_active: true,
    }
    renderDialog({ scenarioId: 5, initialScenario: initial })
    expect(screen.getByRole('combobox', { name: 'Phân loại kịch bản' })).toHaveTextContent('Quy hoạch 2050')
    expect(screen.getByRole('combobox', { name: 'Nhánh kịch bản biến đổi khí hậu' })).toHaveTextContent('RCP 8.5')
  })

  it('shows loading and error states for edit detail', () => {
    queryMock.mockImplementation((key: unknown) => String(key).includes('detail') ? { data: undefined, error: new Error('detail failed'), isLoading: true } : { data: layersResponse, error: null, isLoading: false })
    renderDialog({ scenarioId: 3 })
    expect(screen.getByText('Đang tải dữ liệu...')).toBeInTheDocument()
    expect(screen.getByText('Không tải được chi tiết kịch bản')).toBeInTheDocument()
  })

  it('preserves newly selected layer and edited fields when layer search changes and submits correct payload', async () => {
    const searchLayers = {
      data: {
        items: [
          { id: 290, code: 'kich_ban_ngap_nhe_rcp8_5_2050', name_vi: 'Kịch bản ngập nhẹ - RCP8.5 - 2050' },
        ],
      },
    }

    let searchParam = ''
    queryMock.mockImplementation((key: unknown) => {
      const keyStr = String(key)
      if (keyStr.includes('detail')) {
        return { data: editResponse, error: null, isLoading: false }
      }
      if (keyStr.includes('map-layers-dropdown')) {
        if (keyStr.includes('nhẹ') || searchParam === 'nhẹ') {
          return { data: searchLayers, error: null, isLoading: false }
        }
        return { data: layersResponse, error: null, isLoading: false }
      }
      return { data: undefined, error: null, isLoading: false }
    })

    renderDialog({ scenarioId: 3 })

    expect(screen.getByLabelText('Tên kịch bản *')).toHaveValue('Kịch bản cũ')

    fireEvent.change(screen.getByLabelText('Tên kịch bản *'), { target: { value: 'Kịch bản ngập nhẹ cập nhật' } })

    const comboboxTrigger = screen.getByRole('button', { name: /flood_layer/ })
    fireEvent.click(comboboxTrigger)

    searchParam = 'nhẹ'
    const searchInput = screen.getByPlaceholderText('Tìm lớp bản đồ...')
    fireEvent.change(searchInput, { target: { value: 'nhẹ' } })

    const newLayerOption = await screen.findByRole('button', { name: /kich_ban_ngap_nhe_rcp8_5_2050/ })
    expect(newLayerOption).toBeInTheDocument()

    fireEvent.click(newLayerOption)

    searchParam = ''

    expect(await screen.findByRole('button', { name: /kich_ban_ngap_nhe_rcp8_5_2050/ })).toBeInTheDocument()
    expect(screen.getByText(/Kịch bản ngập nhẹ - RCP8.5 - 2050/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật' }))

    await waitFor(() => {
      expect(updateMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'scenario_1',
          nameVi: 'Kịch bản ngập nhẹ cập nhật',
          layerCode: 'kich_ban_ngap_nhe_rcp8_5_2050',
        })
      )
    })
  })
})
