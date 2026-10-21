import { fireEvent, screen, waitFor, within } from '@testing-library/react'
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
    expect(screen.getByText('Đang hiển thị')).toBeInTheDocument()
    expect(screen.getByText('Đang ẩn')).toBeInTheDocument()
  })

  it('filters categories by search term', async () => {
    renderWithProviders(<CategoryManagementTab />)

    expect(await screen.findByText('Hành chính')).toBeInTheDocument()

    const searchInput = screen.getByPlaceholderText('Tìm danh mục')
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

    const toggleBtn = await screen.findByRole('button', { name: 'Ẩn danh mục Hành chính trên WebGIS' })
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

  it.each([
    { key: 'flood', name: 'Ngập lụt', feature: 'Ngập lụt', isVisible: true },
    { key: 'flood', name: 'Ngập lụt', feature: 'Ngập lụt', isVisible: false },
    { key: 'forest', name: 'Phân loại đối tượng', feature: 'Phân loại đối tượng', isVisible: true },
    { key: 'forest', name: 'Phân loại đối tượng', feature: 'Phân loại đối tượng', isVisible: false },
  ])('locks automatic category $key when API visibility is $isVisible', async ({ key, name, feature, isVisible }) => {
    vi.mocked(layerCategoryService.getAll).mockResolvedValueOnce({
      status: 200,
      message: 'Thành công',
      data: [{ id: 3, key, name, isVisible, layerCount: 0 }],
    })

    renderWithProviders(<CategoryManagementTab />)

    expect(await screen.findByText(name)).toBeInTheDocument()
    expect(screen.getByText('Tự động · Chỉ đọc')).toBeInTheDocument()
    expect(screen.getByText(`Danh mục do chức năng ${feature} quản lý.`, { exact: false }))
      .toHaveTextContent('Không thể sửa hoặc xóa.')
    expect(screen.getByText('Ẩn khỏi danh sách lớp')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: `${isVisible ? 'Ẩn' : 'Hiển thị'} danh mục ${name} trên WebGIS` }))
      .not.toBeInTheDocument()

    const deleteButton = screen.getByRole('button', { name: `Xóa danh mục ${name}` })
    expect(deleteButton).toBeDisabled()
    fireEvent.click(deleteButton)

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(layerCategoryService.updateVisibility).not.toHaveBeenCalled()
    expect(layerCategoryService.delete).not.toHaveBeenCalled()
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

    const dialog = await screen.findByRole('dialog', { name: 'Thêm danh mục' })
    expect(dialog).not.toHaveAttribute('aria-describedby')
    expect(within(dialog).queryByText(/Mã nhận diện/)).not.toBeInTheDocument()

    const nameInput = within(dialog).getByLabelText(/Tên danh mục/)
    fireEvent.change(nameInput, { target: { value: 'Giao thông mới' } })

    const submitBtn = within(dialog).getByRole('button', { name: 'Thêm danh mục' })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(layerCategoryService.create).toHaveBeenCalledWith('Giao thông mới')
    })
  })
})
