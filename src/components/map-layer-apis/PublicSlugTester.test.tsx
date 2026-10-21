import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/renderWithProviders'
import PublicSlugTester from './PublicSlugTester'

const mocks = vi.hoisted(() => ({ getConsumerFeatures: vi.fn() }))
vi.mock('@/service', () => ({
  useApiQuery: () => ({ data: { data: { items: [] } } }),
  mapLayerApiService: { getConsumerFeatures: mocks.getConsumerFeatures },
}))

describe('Public API tester Vietnamese copy', () => {
  it('names sharing fields accurately', () => {
    renderWithProviders(<PublicSlugTester />)
    expect(screen.getByLabelText('Định danh đường dẫn API')).toBeInTheDocument()
    expect(screen.getByLabelText('Khóa chia sẻ')).toBeInTheDocument()
    expect(screen.getByText(/không dùng khóa API quản trị/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sao chép' })).toBeInTheDocument()
  })
  it('keeps the required-fields guard without calling the API', () => {
    renderWithProviders(<PublicSlugTester />)
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra API' }))
    expect(screen.getByText('Nhập định danh đường dẫn API và khóa chia sẻ')).toBeInTheDocument()
    expect(mocks.getConsumerFeatures).not.toHaveBeenCalled()
  })
})
