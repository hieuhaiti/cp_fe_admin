/**
 * ============================================================
 * MANUAL TEST SCENARIO — NHẬP LỚP DỮ LIỆU GEOJSON (IMPORT GEOJSON)
 * ============================================================
 *
 * [CREATE / IMPORT - Nhập tệp GeoJSON mới]
 * 1. Mở trang Nhập GeoJSON (/map-layers/import-geojson).
 * 2. Nhập các trường:
 *    - Tên lớp *: "Lớp Ngập Cẩm Phả" (Mã lớp tự sinh: "lop_ngap")
 *    - Tệp dữ liệu *: Chọn tệp flood.geojson (định dạng .geojson hoặc .json, dung lượng <= 50MB).
 *    - Trạng thái công khai: Tắt (Nội bộ / is_public: false) hoặc Bật (Công khai / is_public: true).
 * 3. Bản đồ xem trước hiển thị GeoJSON tương tác.
 * 4. Import remains unavailable until a backend endpoint is implemented.
 * 5. Expect disabled submission and no mutation, including Enter and direct submit events.
 *
 * [RESET - Làm mới form]
 * 1. Nhấn nút "Làm mới".
 * 2. Kỳ vọng: Tên lớp và tệp được xóa trắng, form trở về trạng thái ban đầu.
 *
 * [VALIDATION - Kiểm thử lỗi]
 * - Submission is blocked independently of field validation while import is unavailable.
 * - Chọn file sai định dạng (ví dụ: data.txt) -> Toast báo "Chỉ chấp nhận file .geojson hoặc .json".
 * - File vượt quá 50MB -> Toast báo "Kích thước file không được quá 50MB".
 * - File JSON cú pháp lỗi -> Hiển thị cảnh báo "Không đọc được GeoJSON hoặc file JSON không hợp lệ".
 * ============================================================
 */

import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ImportGeoJsonPage from './ImportGeoJson'
import { renderWithProviders } from '@/test/renderWithProviders'

const mutation = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }))
const toast = vi.hoisted(() => ({ error: vi.fn() }))
vi.mock('@/service', () => ({ mapLayerService: { importGeoJson: vi.fn() }, useApiMutation: vi.fn(() => mutation) }))
vi.mock('react-toastify', () => ({ toast }))
vi.mock('@/components/features/GeoJsonMapPreview', () => ({ default: () => <div data-testid="geojson-preview" /> }))
vi.mock('@/stores/common/useAuthStore', () => ({ useAuthStore: (selector: (state: { user: null }) => unknown) => selector({ user: null }) }))

const fileInput = () => document.querySelector('input[type=file]') as HTMLInputElement
const geojson = JSON.stringify({ type: 'FeatureCollection', features: [] })
const makeFile = (name: string, type: string, content = geojson) => new File([content], name, { type })

function renderPage() { return renderWithProviders(<ImportGeoJsonPage />) }

describe('ImportGeoJsonPage', () => {
  beforeEach(() => { mutation.mutate.mockClear(); mutation.isPending = false; toast.error.mockClear() })

  it('explains unavailable import and disables submission on the direct page', () => {
    renderPage()
    const submit = screen.getByRole('button', { name: 'Nhập dữ liệu' })
    expect(submit).toBeDisabled()
    expect(submit).toHaveAttribute('aria-describedby', 'geojson-import-unavailable')
    fireEvent.click(submit)
    expect(mutation.mutate).not.toHaveBeenCalled()
  })

  it('rejects unsupported extension and oversized file', async () => {
    renderPage()
    fireEvent.change(fileInput(), { target: { files: [makeFile('data.txt', 'text/plain')] } })
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Chỉ chấp nhận tệp có phần mở rộng .geojson hoặc .json'))
    toast.error.mockClear()
    const oversized = makeFile('large.json', 'application/json')
    Object.defineProperty(oversized, 'size', { value: 51 * 1024 * 1024 })
    fireEvent.change(fileInput(), { target: { files: [oversized] } })
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Kích thước file không được quá 50MB'))
  })

  it('preserves preview but blocks click, Enter and direct form submission', async () => {
    const user = userEvent.setup()
    renderPage()
    const name = screen.getByLabelText('Tên lớp *')
    fireEvent.change(name, { target: { value: 'Lớp Ngập' } })
    fireEvent.change(fileInput(), { target: { files: [makeFile('flood.geojson', 'application/geo+json')] } })
    expect(await screen.findByTestId('geojson-preview')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Nhập dữ liệu' }))
    await user.click(name)
    await user.keyboard('{Enter}')
    const form = name.closest('form')
    if (!form) throw new Error('Import form missing')
    fireEvent.submit(form)
    expect(mutation.mutate).not.toHaveBeenCalled()
  })

  it('shows preview error for invalid JSON and reset clears form', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText('Tên lớp *'), { target: { value: 'Tên lỗi' } })
    fireEvent.change(fileInput(), { target: { files: [makeFile('bad.json', 'application/json', '{bad')] } })
    expect(await screen.findByText('Không đọc được tệp dữ liệu hoặc nội dung tệp không hợp lệ')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Làm mới' }))
    expect(screen.getByLabelText('Tên lớp *')).toHaveValue('')
  })
})
