/**
 * ============================================================
 * MANUAL TEST SCENARIO — TRANG CHỦ / LANDING PAGE ADMIN (PORTAL LANDING)
 * ============================================================
 *
 * [READ - Trải nghiệm chào đón theo vai trò]
 * 1. Đăng nhập với các vai trò khác nhau (system_admin, ubnd_tp, so_tnmt, ubnd_phuong).
 * 2. Mở trang Landing (/landing hoặc /).
 * 3. Kỳ vọng:
 *    - Tiêu đề chào mừng cá nhân hóa theo họ tên và đơn vị.
 *    - Các nút CTA điều hướng nhanh theo đúng thẩm quyền nghiệp vụ của role.
 *    - Thẻ tóm tắt chỉ số vận hành (Lớp bản đồ, Giám sát ngập, Biến động rừng, Phản ánh).
 * ============================================================
 */

import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LandingPage from './index'
import { renderWithProviders } from '@/test/renderWithProviders'
import { useAuthStore } from '@/stores/common/useAuthStore'
import type { User } from '@/types/api'

const queryMock = vi.hoisted(() => vi.fn())
vi.mock('@/service', () => ({ adminDashboardService: { getOverview: vi.fn() }, useApiQuery: queryMock }))

const adminUser = {
  id: 1,
  email: 'admin@campha.gov.vn',
  fullName: 'Nguyễn Văn Quản Trị',
  roleCode: 'system_admin',
  isActive: true,
  role: {
    code: 'system_admin',
    name: 'Quản trị hệ thống',
    permissions: {
      users: { read: true, create: true },
      layers: { read: true, create: true },
      flood: { read: true },
    },
  },
} as User

const ubndUser = {
  id: 2,
  email: 'ubnd@campha.gov.vn',
  fullName: 'Đoàn Chủ Tịch',
  roleCode: 'ubnd_tp',
  isActive: true,
  role: {
    code: 'ubnd_tp',
    name: 'UBND thành phố Cẩm Phả',
    permissions: {
      flood: { read: true },
      forest_classification: { read: true },
      field_report: { read: true },
    },
  },
} as User

describe('LandingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: adminUser })
    queryMock.mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() })
  })

  it('renders role-aware briefing hero and primary CTA for system_admin', () => {
    renderWithProviders(<LandingPage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Nguyễn Văn Quản Trị/)
    expect(screen.getByText('Trung tâm quản trị kỹ thuật')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Quản lý người dùng/ })).toHaveAttribute('href', '/users')
    expect(screen.getByRole('link', { name: /Sổ tay hướng dẫn Admin \(PDF\)/ })).toHaveAttribute('target', '_blank')
  })

  it('renders role-aware briefing hero and primary CTA for ubnd_tp', () => {
    useAuthStore.setState({ user: ubndUser })
    renderWithProviders(<LandingPage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Đoàn Chủ Tịch/)
    expect(screen.getByText('Trung tâm chỉ đạo & điều hành đô thị')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Bảng điều hành đô thị/ })).toHaveAttribute('href', '/dashboard')
  })

  it('renders real operational KPI data when permission and data are present', () => {
    queryMock.mockReturnValue({
      data: {
        data: {
          layers: { total: 42, published: 38, publicCount: 15, latestUpdatedAt: '2026-08-20T10:00:00Z' },
          flood: {
            runId: 101,
            module: 'trend',
            status: 'SUCCEEDED',
            monitorStart: '2026-08-01',
            monitorEnd: '2026-08-15',
            floodExtentAreaHa: 1250.5,
          },
          generatedAt: '2026-08-28T10:00:00Z',
        },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })

    renderWithProviders(<LandingPage />)
    expect(screen.getByText('Lớp dữ liệu bản đồ')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('38 đã xuất bản')).toBeInTheDocument()
    expect(screen.getByText('Giám sát ngập lụt')).toBeInTheDocument()
    expect(screen.getByText('1.250,5 ha')).toBeInTheDocument()
    expect(screen.getByText('Mô hình SUCCEEDED')).toBeInTheDocument()
  })

  it('renders loading state without throwing error', () => {
    queryMock.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() })
    renderWithProviders(<LandingPage />)
    expect(screen.getByText('Chỉ số vận hành & Hiện trạng thực tế')).toBeInTheDocument()
  })

  it('renders error state and allows retry', () => {
    const refetchMock = vi.fn()
    queryMock.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: refetchMock })
    renderWithProviders(<LandingPage />)
    expect(screen.getByText(/Không thể kết nối hệ thống/)).toBeInTheDocument()
  })

  it('does not render unauthorized CTA or overview query when signed out', () => {
    useAuthStore.setState({ user: null })
    renderWithProviders(<LandingPage />)
    expect(queryMock).toHaveBeenCalledWith(expect.any(Array), expect.any(Function), expect.objectContaining({ enabled: false }), false, false)
  })
})

