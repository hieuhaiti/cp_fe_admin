import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/renderWithProviders'
import MapLayerApiDetailDialog from './MapLayerApiDetailDialog'

const query = vi.hoisted(() => vi.fn())
const mutate = vi.hoisted(() => vi.fn())
vi.mock('@/service', () => ({
  mapLayerApiService: {},
  useApiQuery: query,
  useApiMutation: () => ({ mutate, isPending: false }),
}))
vi.mock('@/components/map-layer-apis/IssueKeyDialog', () => ({ default: () => null }))
vi.mock('@/components/map-layer-apis/TokenIssuedModal', () => ({ default: () => null }))

// Simulated presentation fixtures, not evidence of live key revocation/rotation.
const fixtures = [
  { id: 'active', name: 'Khóa hoạt động', expires_at: '2999-01-01T00:00:00Z', expected: 'Đang hoạt động' },
  { id: 'expired', name: 'Khóa hết hạn', expires_at: '2000-01-01T00:00:00Z', expected: 'Đã hết hạn' },
  { id: 'rotated', name: 'Khóa đã xoay', rotated_at: '2026-01-01T00:00:00Z', expires_at: '2000-01-01T00:00:00Z', expected: 'Đã thay khóa' },
  { id: 'revoked', name: 'Khóa thu hồi', revoked_at: '2026-02-01T00:00:00Z', rotated_at: '2026-01-01T00:00:00Z', expires_at: '2000-01-01T00:00:00Z', expected: 'Đã thu hồi' },
]

beforeEach(() => {
  vi.clearAllMocks()
  query.mockImplementation(([key]: string[]) => ({
    data: { data: key === 'mapLayerApiDetailDialog'
      ? { id: 7, name: 'API kiểm thử', is_active: true, allowed_methods: ['GET'] }
      : key === 'mapLayerApiKeys' ? { items: fixtures } : {} },
    refetch: vi.fn(),
  }))
})

describe('API key status presentation — isolated fixtures', () => {
  it.each(fixtures)('renders $id with existing revoked > rotated > expired precedence', ({ name, expected, id }) => {
    renderWithProviders(<MapLayerApiDetailDialog open apiId={7} onOpenChange={vi.fn()} />)
    const row = screen.getByText(name).closest('tr')!
    const badge = within(row).getByLabelText(expected)
    expect(badge).toHaveAttribute('data-status-dot-badge')
    expect(badge).toHaveAttribute('tabindex', '0')
    expect(row.querySelectorAll('[data-status-dot-badge]')).toHaveLength(1)
    expect(within(row).queryAllByRole('button')).toHaveLength(id === 'revoked' ? 0 : 2)
    expect(mutate).not.toHaveBeenCalled()
  })
})
