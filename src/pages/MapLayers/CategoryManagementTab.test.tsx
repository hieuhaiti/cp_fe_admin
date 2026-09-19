import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CategoryManagementTab from './CategoryManagementTab'
import { renderWithProviders } from '@/test/renderWithProviders'
import { layerCategoryService } from '@/service'

vi.mock('@/service', () => ({
  layerCategoryService: {
    getAll: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    updateVisibility: vi.fn(),
  },
}))

describe('CategoryManagementTab', () => {
  const mockCategories = [
    {
      id: 1,
      key: 'hanh_chinh',
      name: 'Hành chính',
      isVisible: true,
      layerCount: 5,
    },
    {
      id: 2,
      key: 'dia_danh',
      name: 'Địa danh',
      isVisible: false,
      layerCount: 0,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(layerCategoryService.getAll).mockResolvedValue({
      status: 200,
      message: 'Thành công',
      data: mockCategories,
    })
  })

  it('renders category table with quick info and visibility buttons', async () => {
    renderWithProviders(<CategoryManagementTab />)

    expect(await screen.findByText('Hành chính')).toBeInTheDocument()
    expect(screen.getByText('Địa danh')).toBeInTheDocument()
    expect(screen.getByText('5 lớp')).toBeInTheDocument()
    expect(screen.getByText('0 lớp')).toBeInTheDocument()

    // Visibility status buttons
    expect(screen.getByText('Hiện trên WebGIS')).toBeInTheDocument()
    expect(screen.getByText('Ẩn trên WebGIS')).toBeInTheDocument()
  })

  it('filters categories by search term', async () => {
    renderWithProviders(<CategoryManagementTab />)

    expect(await screen.findByText('Hành chính')).toBeInTheDocument()

    const searchInput = screen.getByPlaceholderText('Tìm danh mục...')
    fireEvent.change(searchInput, { target: { value: 'dia danh' } })

    expect(screen.getByText('Địa danh')).toBeInTheDocument()
    expect(screen.queryByText('Hành chính')).not.toBeInTheDocument()
  })

  it('toggles category visibility when clicking visibility button', async () => {
    vi.mocked(layerCategoryService.updateVisibility).mockResolvedValueOnce({
      status: 200,
      message: 'Cập nhật thành công',
      data: {
        id: 1,
        key: 'hanh_chinh',
        name: 'Hành chính',
        isVisible: false,
        layerCount: 5,
      },
    })

    renderWithProviders(<CategoryManagementTab />)

    const toggleBtn = await screen.findByRole('button', { name: /Chuyển trạng thái hiển thị của Hành chính/i })
    fireEvent.click(toggleBtn)

    await waitFor(() => {
      expect(layerCategoryService.updateVisibility).toHaveBeenCalledWith('hanh_chinh', false)
    })
  })

  it('disables delete button when layerCount > 0 and enables when layerCount === 0', async () => {
    renderWithProviders(<CategoryManagementTab />)

    await screen.findByText('Hành chính')

    // Category with 5 layers has disabled delete button
    const deleteBtnDisabled = screen.getByRole('button', { name: 'Xóa danh mục Hành chính' })
    expect(deleteBtnDisabled).toBeDisabled()

    // Category with 0 layers has enabled delete button
    const deleteBtnEnabled = screen.getByRole('button', { name: 'Xóa danh mục Địa danh' })
    expect(deleteBtnEnabled).not.toBeDisabled()
  })

  it('opens add category modal and creates category', async () => {
    vi.mocked(layerCategoryService.create).mockResolvedValueOnce({
      status: 201,
      message: 'Tạo thành công',
      data: {
        id: 15,
        key: 'giao_thong_moi',
        name: 'Giao thông mới',
        isVisible: true,
        layerCount: 0,
      },
    })

    renderWithProviders(<CategoryManagementTab />)

    const addBtn = screen.getByRole('button', { name: /Thêm danh mục/i })
    fireEvent.click(addBtn)

    expect(await screen.findByText('Thêm danh mục lớp mới')).toBeInTheDocument()

    const nameInput = screen.getByPlaceholderText('VD: Hạ tầng cấp thoát nước')
    fireEvent.change(nameInput, { target: { value: 'Giao thông mới' } })

    const submitBtn = screen.getByRole('button', { name: 'Tạo danh mục' })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(layerCategoryService.create).toHaveBeenCalledWith('Giao thông mới')
    })
  })
})
