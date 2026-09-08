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

  it('rejects non-numeric minimum rainfall', async () => {
    renderDialog()
    fireEvent.change(screen.getByLabelText('Mã kịch bản *'), { target: { value: 'scenario_1' } })
    fireEvent.change(screen.getByLabelText('Tên kịch bản *'), { target: { value: 'Kịch bản thử' } })
    fireEvent.change(screen.getByLabelText('Lượng mưa tối thiểu (mm)'), { target: { value: 'abc' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mới' }))
    expect(await screen.findByText('Phải là số hợp lệ')).toBeInTheDocument()
  })

  it('submits exact Server-aligned create payload with numeric/null values', async () => {
    renderDialog()
    fireEvent.change(screen.getByLabelText('Tên kịch bản *'), { target: { value: 'Kịch bản Mưa Lớn' } })
    fireEvent.change(screen.getByLabelText('Lượng mưa tối thiểu (mm)'), { target: { value: '25.5' } })
    fireEvent.change(screen.getByLabelText('Lượng mưa tối đa (mm)'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('Triều tối thiểu (m)'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Mô tả'), { target: { value: '  Mô tả thử  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Chọn lớp bản đồ' }))
    fireEvent.click(await screen.findByRole('button', { name: /flood_layer/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mới' }))
    await waitFor(() => expect(createMutate).toHaveBeenCalledWith({
      code: 'kich_ban_mua_lon', nameVi: 'Kịch bản Mưa Lớn', layerCode: 'flood_layer',
      description: 'Mô tả thử', isActive: true, minRainfall: 25.5, maxRainfall: 100,
      minTide: null, maxTide: null,
    }))
  })

  it('prefills edit data and submits the update mutation', async () => {
    queryMock.mockImplementation((key: unknown) => String(key).includes('detail') ? {
      data: editResponse,
      error: null, isLoading: false,
    } : { data: layersResponse, error: null, isLoading: false })
    renderDialog({ scenarioId: 3 })
    expect(screen.getByLabelText('Tên kịch bản *')).toHaveValue('Kịch bản cũ')
    fireEvent.change(screen.getByLabelText('Tên kịch bản *'), { target: { value: 'Kịch bản mới' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật' }))
    await waitFor(() => expect(updateMutate).toHaveBeenCalledWith(expect.objectContaining({ code: 'scenario_1', nameVi: 'Kịch bản mới', layerCode: 'flood_layer', minRainfall: 10 })))
    expect(createMutate).not.toHaveBeenCalled()
  })

  it('shows loading and error states for edit detail', () => {
    queryMock.mockImplementation((key: unknown) => String(key).includes('detail') ? { data: undefined, error: new Error('detail failed'), isLoading: true } : { data: layersResponse, error: null, isLoading: false })
    renderDialog({ scenarioId: 3 })
    expect(screen.getByText('Đang tải dữ liệu...')).toBeInTheDocument()
    expect(screen.getByText('Không tải được chi tiết kịch bản')).toBeInTheDocument()
  })
})
