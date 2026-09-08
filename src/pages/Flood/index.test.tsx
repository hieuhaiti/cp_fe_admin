/**
 * ============================================================
 * MANUAL TEST SCENARIO — MÔ PHỎNG VÀ DỰ BÁO NGẬP LỤT (FLOOD SIMULATION)
 * ============================================================
 *
 * [READ & SIMULATE - Xem bản đồ mô phỏng ngập lụt]
 * 1. Mở trang Dự báo ngập lụt (/flood).
 * 2. Kỳ vọng:
 *    - Bản đồ GIS hiển thị các lớp ranh giới phường/xã, độ sâu ngập và vùng ảnh hưởng.
 *    - Bảng điều khiển mô phỏng với các thông số: Lượng mưa (mm), Thời gian mưa (giờ), Mực nước triều (m).
 * 3. Thay đổi thông số mô phỏng và chạy tính toán.
 * 4. Kỳ vọng: Lớp phủ ngập lụt cập nhật theo kết quả tính toán mô hình thủy văn.
 * ============================================================
 */

import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import FloodPage from './index'
import { renderWithProviders } from '@/test/renderWithProviders'

vi.mock('@/service', () => ({
  floodService: new Proxy({}, { get: () => vi.fn().mockResolvedValue({ data: {} }) }),
  useApiQuery: vi.fn(() => ({ data: undefined, isLoading: false, isFetching: false, isError: false, refetch: vi.fn() })),
  useApiMutation: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false })),
}))
vi.mock('react-leaflet', () => ({ MapContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, TileLayer: () => null, GeoJSON: () => null, ImageOverlay: () => null, LayersControl: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, useMap: () => ({ fitBounds: vi.fn(), getZoom: () => 10 }) }))
vi.mock('leaflet', () => ({ default: { latLngBounds: vi.fn(() => ({ isValid: () => false })), CRS: {} } }))

describe('Flood page (all model and queue services mocked)', () => {
  it('renders the flood administration page without executing a model job', () => {
    renderWithProviders(<FloodPage />)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })
})
