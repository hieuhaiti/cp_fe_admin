import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusDotBadge } from './StatusDotBadge'
import { TooltipProvider } from '@/components/ui/tooltip'

function renderBadge(props: Parameters<typeof StatusDotBadge>[0]) {
  return render(<TooltipProvider delayDuration={0}><StatusDotBadge {...props} /></TooltipProvider>)
}

describe('StatusDotBadge', () => {
  it.each(['neutral', 'success', 'warning', 'info', 'destructive'] as const)('renders one decorative dot with semantic %s colors', tone => {
    const { container } = renderBadge({ label: 'Đang xử lý', tone })
    const badge = container.querySelector('[data-status-dot-badge]')!
    expect(badge).toHaveAttribute('aria-label', 'Đang xử lý')
    expect(badge).toHaveAttribute('tabindex', '0')
    expect(badge.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1)
    expect(badge).toHaveTextContent('Đang xử lý')
    expect(badge).not.toHaveAttribute('aria-live')
    expect(badge).toHaveClass(tone === 'neutral' ? 'text-muted-foreground' : `text-(--${tone}-hover)` )
  })
  it('preserves legacy domain color props and forwards descriptive associations', () => {
    const { container } = renderBadge({ label: 'Đã duyệt', badgeClass: 'domain-badge', dotClass: 'domain-dot', id: 'approval-status', 'aria-describedby': 'approval-help' })
    expect(container.querySelector('#approval-status')).toHaveClass('domain-badge')
    expect(container.querySelector('#approval-status')).toHaveAttribute('aria-describedby', 'approval-help')
    expect(container.querySelector('[aria-hidden]')).toHaveClass('domain-dot')
  })
  it('exposes the full label in a keyboard-focus tooltip', async () => {
    const { container } = renderBadge({ label: 'Dọn dẹp thất bại: lớp có tên rất dài' })
    fireEvent.focus(container.querySelector('[data-status-dot-badge]')!)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Dọn dẹp thất bại: lớp có tên rất dài')
  })
  it('does not add a nested tab stop inside an action', () => {
    const { container } = render(<button aria-label="Xem tiến độ dọn"><StatusDotBadge label="Đang dọn" tone="warning" tooltip={false} /></button>)
    expect(container.querySelector('[data-status-dot-badge]')).not.toHaveAttribute('tabindex')
    expect(screen.getByRole('button', { name: 'Xem tiến độ dọn' })).toHaveTextContent('Đang dọn')
  })
})
