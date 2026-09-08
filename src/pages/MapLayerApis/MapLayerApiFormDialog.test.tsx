/**
 * ============================================================
 * MANUAL TEST SCENARIO — FORM TẠO/SỬA KHÓA API (MAP LAYER API FORM DIALOG)
 * ============================================================
 *
 * [CREATE - Tạo mới khóa API]
 * 1. Mở MapLayerApiFormDialog (nhấn "Tạo key").
 * 2. Nhập các trường:
 *    - Lớp bản đồ: Tìm và chọn layer có sẵn từ Combobox (layer_id: 7).
 *    - Tên key: "Khóa truy cập bản đồ ngập lụt".
 *    - Phạm vi (Scope): Đọc (read: true), Tốc độ (rate_per_min: 60).
 *    - Hạn dùng (expires_at): Để trống (vô thời hạn) hoặc chọn ngày trong tương lai.
 *    - Trạng thái: Kích hoạt (is_active: true).
 * 3. Nhấn "Tạo key".
 * 4. Kỳ vọng: Gửi payload CreateMapLayerApiBody hợp lệ, đóng form và cập nhật danh sách.
 *
 * [UPDATE / EDIT MODE - Chỉnh sửa thông tin khóa]
 * 1. Mở dialog ở chế độ Edit (truyền initialData).
 * 2. Sửa tên key thành "Khóa truy cập - Cập nhật 2026".
 * 3. Nhấn "Lưu thay đổi".
 * 4. Kỳ vọng: Gửi payload UpdateMapLayerApiBody đúng trường thay đổi.
 *
 * [VALIDATION - Kiểm thử lỗi]
 * - Không chọn lớp bản đồ -> Báo lỗi bắt buộc chọn lớp.
 * - Tên key rỗng -> Báo lỗi bắt buộc.
 * ============================================================
 */

import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MapLayerApiFormDialog from './MapLayerApiFormDialog'
import { renderWithProviders } from '@/test/renderWithProviders'
import type { CreateMapLayerApiBody, MapLayerApi } from '@/types/api'

const queryMock = vi.hoisted(() => vi.fn())
const mutationMock = vi.hoisted(() => vi.fn())
const createMutate = vi.hoisted(() => vi.fn())
const updateMutate = vi.hoisted(() => vi.fn())

vi.mock('@/service', () => ({
  mapLayerApiService: { create: vi.fn(), update: vi.fn(), getById: vi.fn() },
  useApiQuery: queryMock,
  useApiMutation: mutationMock,
}))

vi.mock('@/components/map-layer-apis/MapLayerApiForm', () => ({
  default: ({
    mode,
    initialData,
    submitting,
    onSubmitCreate,
    onSubmitUpdate,
    onCancel,
  }: {
    mode: 'create' | 'edit'
    initialData?: MapLayerApi | null
    submitting?: boolean
    onSubmitCreate: (payload: CreateMapLayerApiBody) => void
    onSubmitUpdate: (payload: Partial<CreateMapLayerApiBody>) => void
    onCancel?: () => void
  }) => (
    <div>
      <span>form-mode:{mode}</span>
      {initialData && <span>initial:{initialData.name}</span>}
      <button type="button" disabled={submitting} onClick={() => onSubmitCreate({ name: 'Registry key', layer_id: 7, scope: { read: true, rate_per_min: 60 }, is_active: true, expires_at: null })}>submit-create</button>
      <button type="button" disabled={submitting} onClick={() => onSubmitUpdate({ name: 'Registry renamed' })}>submit-update</button>
      <button type="button" disabled={submitting} onClick={onCancel}>cancel-form</button>
    </div>
  ),
}))

function arrangeMutations(pending = false) {
  mutationMock
    .mockReturnValueOnce({ mutate: createMutate, isPending: pending })
    .mockReturnValueOnce({ mutate: updateMutate, isPending: pending })
}

describe('MapLayerApiFormDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryMock.mockReturnValue({ data: undefined, error: null, isLoading: false })
    arrangeMutations()
  })

  it('renders create mode and submits the validated create shape', () => {
    renderWithProviders(<MapLayerApiFormDialog open apiId={null} onOpenChange={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Thêm API lớp bản đồ mới' })).toBeInTheDocument()
    expect(screen.getByText('form-mode:create')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'submit-create' }))
    expect(createMutate).toHaveBeenCalledWith({
      name: 'Registry key',
      layer_id: 7,
      scope: { read: true, rate_per_min: 60 },
      is_active: true,
      expires_at: null,
    })
  })

  it('loads edit detail and submits only the validated changed field', () => {
    queryMock.mockReturnValue({
      data: { data: { id: 9, name: 'Existing registry', layer_id: 7, scope: { read: true, rate_per_min: 60 }, is_active: true, version: 3 } },
      error: null,
      isLoading: false,
    })
    renderWithProviders(<MapLayerApiFormDialog open apiId={9} onOpenChange={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Chỉnh sửa API lớp bản đồ' })).toBeInTheDocument()
    expect(screen.getByText('initial:Existing registry')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'submit-update' }))
    expect(updateMutate).toHaveBeenCalledWith({ name: 'Registry renamed' })
  })

  it('renders edit loading and error states without the form', () => {
    queryMock.mockReturnValue({ data: undefined, error: new Error('detail failed'), isLoading: true })
    renderWithProviders(<MapLayerApiFormDialog open apiId={9} onOpenChange={vi.fn()} />)
    expect(screen.getByText('Đang tải dữ liệu...')).toBeInTheDocument()
    expect(screen.getByText('Không tải được chi tiết API')).toBeInTheDocument()
    expect(screen.queryByText('form-mode:edit')).not.toBeInTheDocument()
  })

  it('disables child actions while a mutation is pending', () => {
    mutationMock.mockReset()
    arrangeMutations(true)
    renderWithProviders(<MapLayerApiFormDialog open apiId={null} onOpenChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'submit-create' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'cancel-form' })).toBeDisabled()
  })
})
