import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn(), put: vi.fn(),
}))
vi.mock('./common/apiClient', () => ({ default: api }))

import userService from './userService'
import newsService from './newsService'

describe('userService ↔ /admin/users contract', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses the expected list/detail/create routes', async () => {
    api.get.mockResolvedValue({ status: 200, message: 'OK', data: { items: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } }, metadata: { page: 1, limit: 10, total: 0, totalPages: 0 } })
    await userService.getAll({ page: 1, limit: 10 })
    expect(api.get).toHaveBeenCalledWith('/admin/users', { params: { page: 1, limit: 10 } })

    await userService.getById(7)
    expect(api.get).toHaveBeenCalledWith('/admin/users/7')

    const body = { email: 'user@example.com', password: 'Secret123!', fullName: 'User', roleCode: 'citizen' }
    await userService.create(body)
    expect(api.post).toHaveBeenCalledWith('/admin/users', body)
  })

  it('uses role, active, reset-password and delete routes', async () => {
    await userService.updateRole('7', { roleCode: 'citizen' })
    await userService.updateActive('7', { isActive: false })
    await userService.resetPassword('7', { newPassword: 'Secret123!' })
    await userService.delete('7')
    expect(api.patch).toHaveBeenNthCalledWith(1, '/admin/users/7/role', { roleCode: 'citizen' })
    expect(api.patch).toHaveBeenNthCalledWith(2, '/admin/users/7/active', { isActive: false })
    expect(api.post).toHaveBeenCalledWith('/admin/users/7/reset-password', { newPassword: 'Secret123!' })
    expect(api.del).toHaveBeenCalledWith('/admin/users/7')
  })
})

describe('newsService ↔ /admin/cms/news contract', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses public/admin list and detail routes', async () => {
    await newsService.getPublicList({ page: 1, limit: 10 })
    await newsService.getBySlug('flood-update')
    await newsService.getAll({ page: 1 })
    await newsService.getById(3)
    expect(api.get).toHaveBeenNthCalledWith(1, '/cms/news', { params: { page: 1, limit: 10 } })
    expect(api.get).toHaveBeenNthCalledWith(2, '/cms/news/flood-update')
    expect(api.get).toHaveBeenNthCalledWith(3, '/admin/cms/news', { params: { page: 1 } })
    expect(api.get).toHaveBeenNthCalledWith(4, '/admin/cms/news/3')
  })

  it('normalizes FormData and enforces optimistic-lock update/delete', async () => {
    const form = new FormData()
    form.append('title', 'News')
    form.append('content', 'Content')
    form.append('visibility', 'internal')
    form.append('status', 'published')
    form.append('expectedUpdatedAt', '2026-01-01T00:00:00.000Z')
    await newsService.create(form)
    expect(api.post).toHaveBeenCalledWith('/admin/cms/news', { title: 'News', content: 'Content', visibility: 'internal', status: 'published' })
    await newsService.update(3, form)
    expect(api.patch).toHaveBeenCalledWith('/admin/cms/news/3', expect.objectContaining({ expectedUpdatedAt: '2026-01-01T00:00:00.000Z' }))
    await expect(newsService.update(3, new FormData())).rejects.toThrow('Missing expectedUpdatedAt')
    await expect(newsService.delete(3, '')).rejects.toThrow('Missing expectedUpdatedAt')
    await newsService.delete(3, '2026-01-01T00:00:00.000Z')
    expect(api.del).toHaveBeenCalledWith('/admin/cms/news/3', undefined, { params: { expectedUpdatedAt: '2026-01-01T00:00:00.000Z' } })
  })
})
