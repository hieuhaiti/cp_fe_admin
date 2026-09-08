/**
 * ============================================================
 * MANUAL TEST SCENARIO — FORM TRA CỨU VÀ MÔ PHỎNG NGẬP LỤT (KTTV INPUT FORM)
 * ============================================================
 *
 * [SEARCH & SIMULATE - Tra cứu kịch bản ngập theo thời tiết]
 * 1. Mở trang Kịch bản thủy văn -> Chọn Tab "Nhập kịch bản".
 * 2. Tự động nhập: Nhấn nút "Tự động nhập" để lấy dữ liệu lượng mưa thực tế thời gian thực từ OpenWeatherMap.
 * 3. Nhập thủ công:
 *    - Lượng mưa hiện tại: 25.5 mm/h.
 *    - Mực nước thủy triều: 1.2 m (hoặc để trống).
 * 4. Nhấn "Tra cứu kịch bản".
 * 5. Kỳ vọng: Hệ thống tra cứu API simulation, hiển thị thẻ kết quả "Đã tìm thấy kịch bản phù hợp", tên kịch bản, mã, lớp bản đồ và nút "Kích hoạt kịch bản này".
 *
 * [ACTIVATE - Kích hoạt kịch bản ngập]
 * 1. Nhấn nút "Kích hoạt kịch bản này" trên kết quả tra cứu.
 * 2. Kỳ vọng: Hệ thống kích hoạt kịch bản trên GIS, thông báo thành công.
 *
 * [VALIDATION - Kiểm thử lỗi]
 * - Để trống lượng mưa -> Báo lỗi "Lượng mưa là bắt buộc".
 * - Nhập lượng mưa âm (ví dụ: -1) -> Báo lỗi "Lượng mưa phải là số không âm".
 * ============================================================
 */

import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import KttvInputForm from './KttvInputForm'
import { renderWithProviders } from '@/test/renderWithProviders'

const simulate = vi.hoisted(() => vi.fn())
vi.mock('@/service', () => ({ kttvScenarioService: { simulate, getAll: vi.fn(), update: vi.fn() } }))
vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() } }))

describe('KttvInputForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    simulate.mockResolvedValue({
      data: {
        nameVi: 'Lớp ngập',
        geoserverLayer: 'ws:flood',
        simulationParams: { scenarioId: 1, scenarioCode: 's1', scenarioName: 'Kịch bản 1' },
      },
    })
  })

  it('rejects missing and negative rainfall', async () => {
    renderWithProviders(<KttvInputForm />)
    fireEvent.click(screen.getByRole('button', { name: 'Tra cứu kịch bản' }))
    expect(await screen.findByText('Lượng mưa là bắt buộc')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Lượng mưa hiện tại/), { target: { value: '-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tra cứu kịch bản' }))
    expect(await screen.findByText('Lượng mưa phải là số không âm')).toBeInTheDocument()
    expect(simulate).not.toHaveBeenCalled()
  })

  it('submits numeric rainfall and nullable tide contract', async () => {
    renderWithProviders(<KttvInputForm />)
    fireEvent.change(screen.getByLabelText(/Lượng mưa hiện tại/), { target: { value: '25.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tra cứu kịch bản' }))
    await waitFor(() => expect(simulate).toHaveBeenCalledWith({ rainfall: 25.5, tide: null }))
    expect(await screen.findByText('Đã tìm thấy kịch bản phù hợp')).toBeInTheDocument()
  })
})
