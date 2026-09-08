/**
 * ============================================================
 * MANUAL TEST SCENARIO — BẢNG ĐIỀU KHIỂN TỔNG QUAN (ADMIN DASHBOARD)
 * ============================================================
 *
 * [READ - Xem các chỉ số KPI & Biểu đồ tổng quan]
 * 1. Mở trang Bảng điều khiển (/dashboard hoặc /).
 * 2. Kỳ vọng:
 *    - Các thẻ thống kê: Tổng số người dùng, Lớp bản đồ GIS, Tin tức xuất bản, Phản ánh chờ xử lý.
 *    - Biểu đồ phân bổ dữ liệu (Bar chart) trực quan.
 *    - Danh sách phản ánh hiện trường mới nhất.
 * 3. Nhấn "Làm mới": Tải lại toàn bộ số liệu thời gian thực từ API.
 * ============================================================
 */

import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DashboardPage from './index'
import { renderWithProviders } from '@/test/renderWithProviders'

const queryMock = vi.hoisted(() => vi.fn())
const refetches = vi.hoisted(() => [vi.fn(), vi.fn(), vi.fn(), vi.fn()])
vi.mock('@/service', () => ({
  adminDashboardService: { getOverview: vi.fn() }, citizenFeedbackService: { getAll: vi.fn() },
  newsCommentService: { getAll: vi.fn() }, userService: { getAll: vi.fn() }, useApiQuery: queryMock,
}))
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  XAxis: () => null, YAxis: () => null, CartesianGrid: () => null, Tooltip: () => null, Cell: () => null,
}))

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    let call = 0
    queryMock.mockImplementation(() => ({ data: undefined, isLoading: false, refetch: refetches[call++] }))
  })

  it('renders empty-safe dashboard and calls all four refetch actions', () => {
    renderWithProviders(<DashboardPage />)
    expect(screen.getByRole('heading', { name: 'Bảng điều khiển' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Làm mới/ }))
    refetches.forEach((refetch) => expect(refetch).toHaveBeenCalledOnce())
  })

  it('disables refresh while any dashboard query is loading', () => {
    let call = 0
    queryMock.mockImplementation(() => ({ data: undefined, isLoading: call++ === 0, refetch: vi.fn() }))
    renderWithProviders(<DashboardPage />)
    expect(screen.getByRole('button', { name: /Làm mới/ })).toBeDisabled()
  })
})
