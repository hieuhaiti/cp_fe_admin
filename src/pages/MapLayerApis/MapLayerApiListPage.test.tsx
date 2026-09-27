import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MapLayerApiListPage from './MapLayerApiListPage'
import { renderWithProviders } from '@/test/renderWithProviders'
import { useAuthStore } from '@/stores/common/useAuthStore'
import type { User } from '@/types/api'

const queryMock = vi.hoisted(() => vi.fn())
const mutationMock = vi.hoisted(() => vi.fn())

vi.mock('@/service', () => ({
  mapLayerApiService: {
    getAll: vi.fn(),
    delete: vi.fn(),
    regenerate: vi.fn(),
  },
  mapLayerService: { getAll: vi.fn() },
  useApiQuery: queryMock,
  useApiMutation: mutationMock,
}))

vi.mock('./MapLayerApiDetailDialog', () => ({ default: () => null }))
vi.mock('./MapLayerApiFormDialog', () => ({
  default: ({ open }: { open: boolean }) => (open ? <div>API form opened</div> : null),
}))
vi.mock('@/components/map-layer-apis/IssueKeyDialog', () => ({ default: () => null }))
vi.mock('@/components/map-layer-apis/TokenIssuedModal', () => ({ default: () => null }))

const admin = {
  id: 1,
  email: 'admin@campha.gov.vn',
  roleCode: 'so_tnmt',
  isActive: true,
  role: { code: 'so_tnmt', permissions: { api_registry: { create: true, share: true } } },
} as User

describe('MapLayerApiListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: admin })
    queryMock.mockReturnValue({
      data: { data: { items: [] }, metadata: { total: 0 } },
      refetch: vi.fn(),
      isLoading: false,
    })
    mutationMock.mockReturnValue({ mutate: vi.fn(), isPending: false })
  })

  it('renders list page and opens create dialog by permission', () => {
    renderWithProviders(<MapLayerApiListPage />)
    expect(screen.getByRole('heading', { name: 'Quản lý API Lớp bản đồ' })).toBeInTheDocument()
    expect(screen.getByText('Chưa có API lớp bản đồ nào được đăng ký.')).toBeInTheDocument()

    const createBtn = screen.getByRole('button', { name: /Đăng ký API mới/i })
    fireEvent.click(createBtn)
    expect(screen.getByText('API form opened')).toBeInTheDocument()
  })

  it('renders registered API items in table when data is returned', () => {
    queryMock.mockReturnValue({
      data: {
        data: {
          items: [
            {
              id: 12,
              layer_id: 94,
              slug: 'api-duong-ranh-gioi',
              name: 'API Đường ranh giới',
              layer_code: 'duong_ranh_gioi',
              layer_name: 'Đường ranh giới',
              read_fields: ['fid_xoa02', 'i'],
              search_fields: ['fid_xoa02'],
              is_active: true,
            },
          ],
        },
        metadata: { total: 1 },
      },
      refetch: vi.fn(),
      isLoading: false,
    })

    renderWithProviders(<MapLayerApiListPage />)
    expect(screen.getByText('API Đường ranh giới')).toBeInTheDocument()
    expect(screen.getByText('Đường ranh giới')).toBeInTheDocument()
    expect(screen.getByText('/api-duong-ranh-gioi/features')).toBeInTheDocument()
    expect(screen.getByText('2 trường đọc')).toBeInTheDocument()
  })
})