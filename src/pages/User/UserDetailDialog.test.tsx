import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/renderWithProviders'
import { beforeEach, expect, it, vi } from 'vitest'
import UserDetailDialog from './UserDetailDialog'

const query = vi.hoisted(() => vi.fn())
vi.mock('@/service', () => ({ userService: { getById: vi.fn() }, useApiQuery: query }))

beforeEach(() => query.mockReset())

it('displays Vietnamese permissions without changing enabled permissions', () => {
  const permissions = {
    users: { read: true, delete: false, reset_password: true },
    api_registry: ['share', 'grant'],
    custom_resource: ['custom_action'],
  }
  query.mockReturnValue({ data: { data: { id: 7, email: 'test@example.com', role_permissions: permissions } } })
  renderWithProviders(<UserDetailDialog open userId={7} onOpenChange={vi.fn()} />)
  expect(screen.getByText('Người dùng:')).toBeInTheDocument()
  expect(screen.getByText('Xem')).toBeInTheDocument()
  expect(screen.getByText('Đặt lại mật khẩu')).toBeInTheDocument()
  expect(screen.getByText('API bản đồ:')).toBeInTheDocument()
  expect(screen.getByText('Chia sẻ')).toBeInTheDocument()
  expect(screen.getByText('Phân quyền')).toBeInTheDocument()
  expect(screen.queryByText('Xóa')).not.toBeInTheDocument()
  expect(screen.getByText('custom_resource:')).toBeInTheDocument()
  expect(screen.getByText('custom_action')).toBeInTheDocument()
  expect(permissions.users.delete).toBe(false)
  expect(permissions.api_registry).toEqual(['share', 'grant'])
})
