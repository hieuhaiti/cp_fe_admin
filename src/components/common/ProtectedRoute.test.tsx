import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { renderWithProviders } from '@/test/renderWithProviders'
import { useAuthStore } from '@/stores/common/useAuthStore'
import type { User } from '@/types/api'

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const baseUser = {
  id: 1,
  email: 'admin@example.com',
  fullName: 'Administrator',
  roleCode: 'so_tnmt',
  isActive: true,
} as User

function renderGuard(permission?: { resource: string; action: string }) {
  return renderWithProviders(
    <Routes>
      <Route element={<ProtectedRoute permission={permission} />}>
        <Route path="/secure" element={<h1>Secure Page</h1>} />
      </Route>
      <Route path="/login" element={<h1>Login Page</h1>} />
      <Route path="/403" element={<h1>Forbidden Page</h1>} />
    </Routes>,
    { initialEntries: ['/secure'] }
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false, isAdmin: false, isInitializing: false, loggedOut: false })
  })

  it('renders an initialization gate before making an authorization decision', () => {
    useAuthStore.setState({ isInitializing: true })
    const { container } = renderGuard()
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument()
  })

  it('redirects unauthenticated users to login', () => {
    renderGuard()
    expect(screen.getByRole('heading', { name: 'Login Page' })).toBeInTheDocument()
  })

  it('redirects authenticated non-admin users to forbidden', () => {
    useAuthStore.setState({ user: baseUser, isAuthenticated: true, isAdmin: false })
    renderGuard()
    expect(screen.getByRole('heading', { name: 'Forbidden Page' })).toBeInTheDocument()
  })

  it('enforces route resource/action against user permissions', () => {
    useAuthStore.setState({
      user: { ...baseUser, role: { code: 'so_tnmt', name: 'Sở TN&MT', permissions: { users: { read: true } } } },
      isAuthenticated: true,
      isAdmin: true,
    })
    renderGuard({ resource: 'users', action: 'delete' })
    expect(screen.getByRole('heading', { name: 'Forbidden Page' })).toBeInTheDocument()
  })

  it('renders nested page when authentication and permission pass', () => {
    useAuthStore.setState({
      user: { ...baseUser, role: { code: 'so_tnmt', name: 'Sở TN&MT', permissions: { users: { read: true } } } },
      isAuthenticated: true,
      isAdmin: true,
    })
    renderGuard({ resource: 'users', action: 'read' })
    expect(screen.getByRole('heading', { name: 'Secure Page' })).toBeInTheDocument()
  })
})
