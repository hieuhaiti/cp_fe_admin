/**
 * ============================================================
 * MANUAL TEST SCENARIO — FORM TRA CỨU VÀ MÔ PHỎNG NGẬP LỤT (KTTV INPUT FORM)
 * ============================================================
 *
 * [SEARCH & SIMULATE - Tra cứu kịch bản ngập theo thời tiết]
 * 1. Mở trang Kịch bản thủy văn -> Chọn Tab "Nhập kịch bản".
 * 2. Tự động nhập: Nhấn nút "Tự động" hoặc "Dùng dự báo mốc này" để lấy dữ liệu lượng mưa dự báo 24h từ WeatherAPI qua server.
 * 3. Làm mới: Nhấn nút "Làm mới" để yêu cầu server cập nhật dữ liệu mới từ WeatherAPI.
 * 4. Nhập thủ công:
 *    - Lượng mưa hiện tại: 25.5 mm/h.
 *    - Mực nước thủy triều: 1.2 m (hoặc để trống).
 * 5. Nhấn "Tra cứu kịch bản".
 * 6. Kỳ vọng: Hệ thống tra cứu API simulation, hiển thị thẻ kết quả "Đã tìm thấy kịch bản phù hợp", tên kịch bản, mã, lớp bản đồ và nút "Kích hoạt kịch bản này".
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
const getForecast = vi.hoisted(() => vi.fn())
const refreshForecast = vi.hoisted(() => vi.fn())
const getAllScenarios = vi.hoisted(() => vi.fn())
const updateScenario = vi.hoisted(() => vi.fn())

vi.mock('@/service', () => ({
  kttvScenarioService: { simulate, getAll: getAllScenarios, update: updateScenario },
  weatherForecastService: { getForecast, refreshForecast },
}))
vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
}))

const mockForecastPayload = {
  data: {
    location: { name: 'Cẩm Phả', region: 'Quảng Ninh', country: 'Vietnam', lat: 21.0, lon: 107.3, localtime: null },
    forecastDate: '2026-09-18',
    daySummary: {
      maxTempC: 30,
      minTempC: 24,
      avgTempC: 27,
      totalPrecipMm: 25,
      dailyChanceOfRain: 80,
      condition: { text: 'Mưa rào', icon: '', code: 1240 },
    },
    hours: Array.from({ length: 24 }, (_, i) => ({
      time: `2026-09-18 ${String(i).padStart(2, '0')}:00`,
      timeEpoch: 1789689600 + i * 3600,
      hour: `${String(i).padStart(2, '0')}:00`,
      tempC: 25,
      feelsLikeC: 27,
      humidity: 85,
      precipMm: i === 14 ? 35.5 : 5.0,
      chanceOfRain: i === 14 ? 90 : 20,
      condition: { text: i === 14 ? 'Mưa to' : 'Nhiều mây', icon: '', code: 1240 },
      windKph: 10,
      windDir: 'E',
      uv: 2,
    })),
    source: 'weatherapi',
    fetchedAt: '2026-09-18T00:00:00.000Z',
  },
}

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
    getForecast.mockResolvedValue(mockForecastPayload)
    refreshForecast.mockResolvedValue(mockForecastPayload)
    getAllScenarios.mockResolvedValue({ data: { items: [] } })
    updateScenario.mockResolvedValue({ data: {} })
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

  it('loads 24h weather forecast and allows applying forecast to form', async () => {
    renderWithProviders(<KttvInputForm />)
    expect(await screen.findByText(/Dự báo thời tiết 24h/)).toBeInTheDocument()
    expect(getForecast).toHaveBeenCalled()

    // Bấm nút tự động điền dự báo
    const autoBtn = screen.getByRole('button', { name: /Tự động/i })
    fireEvent.click(autoBtn)

    const rainfallInput = screen.getByLabelText(/Lượng mưa hiện tại/) as HTMLInputElement
    expect(Number(rainfallInput.value)).toBeGreaterThanOrEqual(0)
  })

  it('triggers refresh forecast when clicking Làm mới button', async () => {
    renderWithProviders(<KttvInputForm />)
    const refreshBtn = await screen.findByRole('button', { name: /Làm mới/i })
    await waitFor(() => expect(refreshBtn).not.toBeDisabled())
    fireEvent.click(refreshBtn)

    await waitFor(() => expect(refreshForecast).toHaveBeenCalled())
  })

  it('activates multiple matched scenarios across types simultaneously', async () => {
    const mockItems = [
      { id: 1, code: 'scenario_light', name_vi: 'Kịch bản ngập nhẹ', type: 'hien_trang', layer_code: 'kich_ban_ngap_nhe', min_rainfall: '0', max_rainfall: '50', is_active: false },
      { id: 2, code: 'scenario_light_improved', name_vi: 'Kịch bản ngập nhe', type: 'cai_tao', layer_code: 'kich_ban_ngap_nhe_sau_cai_tao', min_rainfall: '0', max_rainfall: '50', is_active: false },
    ]
    getAllScenarios.mockResolvedValue({
      data: { items: mockItems },
    })

    const { queryClient } = renderWithProviders(<KttvInputForm />)
    await waitFor(() => expect(queryClient.getQueryData(['admin-scenarios-for-simulation'])).toBeDefined())

    fireEvent.change(screen.getByLabelText(/Lượng mưa hiện tại/), { target: { value: '25.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tra cứu kịch bản' }))

    const activateBtn = await screen.findByRole('button', { name: /Kích hoạt đồng thời cả 2 kịch bản từng loại/ })
    expect(activateBtn).toBeInTheDocument()

    fireEvent.click(activateBtn)
    await waitFor(() => {
      expect(updateScenario).toHaveBeenCalledWith(1, { isActive: true })
      expect(updateScenario).toHaveBeenCalledWith(2, { isActive: true })
    })
  })
})
