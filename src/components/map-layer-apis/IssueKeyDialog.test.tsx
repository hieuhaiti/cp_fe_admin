import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import IssueKeyDialog from './IssueKeyDialog'
import { renderWithProviders } from '@/test/renderWithProviders'

const mutation = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }))
vi.mock('@/service', () => ({ mapLayerApiService: { issueKey: vi.fn() }, useApiMutation: () => mutation }))
vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const props = { open: true, onOpenChange: vi.fn(), registryId: 1, allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'], onKeyIssued: vi.fn() }
const scopeCheckbox = (name: string) => {
  const label = screen.getByText(name).closest('label')
  if (!label) throw new Error(`Missing scope label: ${name}`)
  return within(label).getByRole('checkbox')
}

describe('IssueKeyDialog lifecycle — isolated service', () => {
  beforeEach(() => vi.clearAllMocks())
  it('resets only scopes after close/reopen and preserves other draft fields', async () => {
    const user = userEvent.setup()
    const { rerender } = renderWithProviders(<IssueKeyDialog {...props} />)
    await user.type(screen.getByLabelText(/Tên khóa gợi nhớ/), 'Khóa thử nghiệm')
    await user.type(screen.getByLabelText(/Đơn vị/), 'Đối tác thử nghiệm')
    await user.clear(screen.getByLabelText(/Hạn mức truy cập/))
    await user.type(screen.getByLabelText(/Hạn mức truy cập/), '75')
    await user.click(screen.getByRole('button', { name: '7 ngày' }))
    await user.click(scopeCheckbox('features:create'))
    expect(scopeCheckbox('features:create')).toHaveAttribute('data-state', 'checked')
    rerender(<IssueKeyDialog {...props} open={false} />)
    rerender(<IssueKeyDialog {...props} />)
    expect(scopeCheckbox('features:create')).toHaveAttribute('data-state', 'unchecked')
    expect(screen.getByLabelText(/Tên khóa gợi nhớ/)).toHaveValue('Khóa thử nghiệm')
    expect(screen.getByLabelText(/Đơn vị/)).toHaveValue('Đối tác thử nghiệm')
    expect(screen.getByLabelText(/Hạn mức truy cập/)).toHaveValue(75)
    expect(screen.getByLabelText(/Thời hạn hiệu lực/)).toHaveValue(168)
    expect(mutation.mutate).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Cấp khóa' }))
    expect(mutation.mutate).toHaveBeenCalledWith({ name: 'Khóa thử nghiệm', consumer: 'Đối tác thử nghiệm', scopes: ['features:read'], quotaPerMinute: 75, expiresInHours: 168 })
  })
  it('keeps method restrictions and cancel behavior', async () => {
    const user = userEvent.setup()
    renderWithProviders(<IssueKeyDialog {...props} allowedMethods={['GET']} />)
    for (const name of ['features:create', 'features:update', 'features:delete']) expect(scopeCheckbox(name)).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Hủy' }))
    expect(props.onOpenChange).toHaveBeenCalledWith(false)
    expect(mutation.mutate).not.toHaveBeenCalled()
  })
})
