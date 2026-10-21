import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MainLayout } from './mainLayout'
import { renderWithProviders } from '@/test/renderWithProviders'

const media = vi.hoisted(() => ({ mobile: true }))
vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => media.mobile }))
vi.mock('@/components/layout/NotificationMenu', () => ({ NotificationMenu: () => null }))
vi.mock('@/components/layout/UserMenu', () => ({ UserMenu: () => null }))

describe('MainLayout responsive navigation', () => {
  beforeEach(() => { media.mobile = true })
  it('opens a modal menu, closes on Escape and restores trigger focus', async () => {
    const user = userEvent.setup()
    renderWithProviders(<MainLayout><p>Nội dung quản trị</p></MainLayout>)
    expect(document.querySelector('aside')).toBeNull()
    const trigger = screen.getByRole('button', { name: 'Mở menu quản trị' })
    await user.click(trigger)
    expect(screen.getByRole('dialog', { name: 'Menu quản trị' })).toBeVisible()
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })
  it('closes the drawer after safe navigation', async () => {
    const user = userEvent.setup()
    renderWithProviders(<MainLayout><p>Nội dung quản trị</p></MainLayout>)
    await user.click(screen.getByRole('button', { name: 'Mở menu quản trị' }))
    await user.click(screen.getByRole('button', { name: 'Tổng quan' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
  it('retains desktop sidebar and collapse action', async () => {
    media.mobile = false
    const user = userEvent.setup()
    renderWithProviders(<MainLayout><p>Nội dung quản trị</p></MainLayout>)
    expect(document.querySelector('aside')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mở menu quản trị' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Thu gọn menu' }))
    expect(screen.getByRole('button', { name: 'Mở rộng menu' })).toBeVisible()
  })
})
