/**
 * ============================================================
 * MANUAL TEST SCENARIO — CỔNG TEST & HƯỚNG DẪN API CÔNG KHAI (MAP LAYER API PUBLIC)
 * ============================================================
 *
 * [READ & TEST - Thử nghiệm API công khai]
 * 1. Truy cập trang Public Map APIs (/public/map-apis).
 * 2. Chọn Tab "Test API":
 *    - Nhập slug chia sẻ của lớp bản đồ.
 *    - Nhập API Key hoặc dùng Public Key mặc định.
 *    - Nhấn "Gửi yêu cầu thử nghiệm".
 *    - Kỳ vọng: Hiển thị phản hồi GeoJSON features thành công.
 *
 * [INTEGRATION GUIDE - Hướng dẫn tích hợp]
 * 1. Chọn Tab "Hướng dẫn tích hợp" (?tab=guide).
 * 2. Kỳ vọng: Hiển thị đầy đủ tài liệu hướng dẫn:
 *    - Endpoint: /api/v1/shared/{slug}/features
 *    - Cấu trúc Header, Tham số truy vấn (BBOX, limit, page).
 *    - Mẫu code tích hợp JavaScript/OpenLayers/Leaflet.
 * ============================================================
 */

import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import MapLayerApiPublicPage from './MapLayerApiPublicPage'
import { renderWithProviders } from '@/test/renderWithProviders'

vi.mock('@/components/map-layer-apis/PublicSlugTester', () => ({ default: () => <div>Public tester content</div> }))

describe('MapLayerApiPublicPage', () => {
  it('defaults invalid tabs to the API tester', () => {
    renderWithProviders(<MapLayerApiPublicPage />, { initialEntries: ['/public/map-apis?tab=invalid'] })
    expect(screen.getByText('Public tester content')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Test API' })).toHaveAttribute('data-state', 'active')
  })

  it('renders integration guide from the guide search param', () => {
    renderWithProviders(<MapLayerApiPublicPage />, { initialEntries: ['/public/map-apis?tab=guide'] })
    expect(screen.getByRole('tab', { name: 'Hướng dẫn tích hợp' })).toHaveAttribute('data-state', 'active')
    expect(screen.getByText('Tổng quan')).toBeInTheDocument()
    expect(screen.getByText('/api/v1/shared/{slug}/features')).toBeInTheDocument()
  })
})
