import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, beforeEach, expect, it, vi } from 'vitest'
import KttvConvertFromLayersDialog from './KttvConvertFromLayersDialog'
import { renderWithProviders } from '@/test/renderWithProviders'

const getLayers = vi.hoisted(() => vi.fn())
const convertFromLayers = vi.hoisted(() => vi.fn())
vi.mock('@/service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/service')>()
  return {
    ...actual,
    mapLayerService: { ...actual.mapLayerService, getAll: getLayers },
    kttvScenarioService: { ...actual.kttvScenarioService, convertFromLayers },
  }
})
const layer = (code: string) => ({ code, name_vi: `Lớp ${code}`, category_name: 'Kịch bản ngập lụt' })
function openDialog() {
  return renderWithProviders(<KttvConvertFromLayersDialog open onOpenChange={vi.fn()} />)
}
async function search(value: string) {
  fireEvent.change(screen.getByPlaceholderText('Tìm kiếm lớp bản đồ theo tên hoặc mã...'), { target: { value } })
  await waitFor(() => expect(getLayers).toHaveBeenCalledWith(expect.objectContaining({ q: value })))
}
describe('KttvConvertFromLayersDialog selection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getLayers.mockResolvedValue({ data: { items: [layer('a'), layer('b')] } })
    convertFromLayers.mockResolvedValue({ data: { created: [], skipped: [] } })
  })
  it('selects and clears displayed layers without a checkbox update loop', async () => {
    openDialog()
    fireEvent.click(await screen.findByRole('button', { name: /Chọn tất cả/ }))
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    screen.getAllByRole('checkbox').forEach((checkbox) => expect(checkbox).toBeChecked())
    expect(screen.getByRole('button', { name: 'Chuyển đổi 2 lớp' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: /Bỏ chọn tất cả/ }))
    screen.getAllByRole('checkbox').forEach((checkbox) => expect(checkbox).not.toBeChecked())
    expect(screen.getByRole('button', { name: 'Chuyển đổi 0 lớp' })).toBeDisabled()
  })
  it('checks displayed codes rather than counts and preserves hidden selections', async () => {
    getLayers.mockImplementation(({ q }: { q?: string }) => Promise.resolve({
      data: { items: q === 'khác' ? [layer('c'), layer('d')] : [layer('a'), layer('b')] },
    }))
    openDialog()
    fireEvent.click(await screen.findByRole('button', { name: /Chọn tất cả/ }))
    await search('khác')
    await screen.findByText('Lớp c')
    fireEvent.click(screen.getByRole('button', { name: /Chọn tất cả/ }))
    expect(screen.getByRole('button', { name: 'Chuyển đổi 4 lớp' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: /Bỏ chọn tất cả/ }))
    expect(screen.getByRole('button', { name: 'Chuyển đổi 2 lớp' })).toBeEnabled()
    screen.getAllByRole('checkbox').forEach((checkbox) => expect(checkbox).not.toBeChecked())
    fireEvent.click(screen.getByRole('button', { name: 'Chuyển đổi 2 lớp' }))
    await waitFor(() => expect(convertFromLayers).toHaveBeenCalledWith(expect.objectContaining({ layerCodes: ['a', 'b'], type: 'hien_trang' })))
  })
  it('toggles a layer once by label, checkbox and keyboard', async () => {
    const user = userEvent.setup()
    openDialog()
    await screen.findByText('Lớp a')
    await user.click(screen.getByText('Lớp a'))
    expect(screen.getByRole('checkbox', { name: /Lớp a/ })).toBeChecked()
    await user.click(screen.getByRole('checkbox', { name: /Lớp a/ }))
    expect(screen.getByRole('checkbox', { name: /Lớp a/ })).not.toBeChecked()
    screen.getByRole('checkbox', { name: /Lớp a/ }).focus()
    await user.keyboard('[Space]')
    expect(screen.getByRole('checkbox', { name: /Lớp a/ })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Chuyển đổi 1 lớp' })).toBeEnabled()
  })
  it('adds only missing displayed codes for partial selection without duplicates', async () => {
    openDialog()
    const all = await screen.findByRole('button', { name: /Chọn tất cả/ })
    fireEvent.click(screen.getAllByRole('checkbox')[0])
    fireEvent.click(all)
    expect(screen.getByRole('button', { name: 'Chuyển đổi 2 lớp' })).toBeEnabled()
  })
  it('does not treat a failed layer query as an empty result', async () => {
    getLayers.mockRejectedValue(new Error('Network error'))
    openDialog()
    expect(await screen.findByText('Không thể tải danh sách lớp bản đồ.')).toBeInTheDocument()
    getLayers.mockResolvedValue({ data: { items: [layer('a')] } })
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText('Lớp a')).toBeInTheDocument()
  })
})