import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CategorySelect from './CategorySelect'
import { renderWithProviders } from '@/test/renderWithProviders'
import { layerCategoryService } from '@/service'

vi.mock('@/service', () => ({
  layerCategoryService: {
    getAll: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('CategorySelect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(layerCategoryService.getAll).mockResolvedValue({
      status: 200,
      message: 'Thành công',
      data: [
        { id: 1, key: 'land_cover', name: 'Lớp phủ mặt đất' },
        { id: 2, key: 'flood', name: 'Ngập lụt và thủy văn' },
        { id: 3, key: 'giao_thong', name: 'Giao thông' },
      ],
    })
  })

  it('renders select trigger and label correctly', async () => {
    renderWithProviders(
      <CategorySelect
        category="flood"
        categoryName="Ngập lụt và thủy văn"
        onCategoryChange={vi.fn()}
        label="Nhóm lớp bản đồ"
        required
      />
    )

    expect(screen.getByText(/Nhóm lớp bản đồ/)).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('preserves an existing legacy or custom category not yet in default list', async () => {
    renderWithProviders(
      <CategorySelect
        category="custom_existing"
        categoryName="Danh mục cũ tùy chỉnh"
        onCategoryChange={vi.fn()}
      />
    )

    const trigger = screen.getByRole('combobox')
    fireEvent.click(trigger)
    await waitFor(() => {
      expect(screen.getAllByText('Danh mục cũ tùy chỉnh').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows create new category form when selecting __create_new__ or other', async () => {
    renderWithProviders(
      <CategorySelect
        category=""
        onCategoryChange={vi.fn()}
        onCategoryNameChange={vi.fn()}
      />
    )

    const trigger = screen.getByRole('combobox')
    fireEvent.click(trigger)

    const createOption = await screen.findByText('+ Thêm danh mục mới...')
    fireEvent.click(createOption)

    expect(screen.getByText('Tên danh mục mới')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Lưu/i })).toBeInTheDocument()
  })

  it('creates new category on server, updates select and triggers callbacks', async () => {
    vi.mocked(layerCategoryService.create).mockResolvedValueOnce({
      status: 201,
      message: 'Tạo thành công',
      data: {
        id: 10,
        key: 'ngap_ven_bien',
        name: 'Ngập ven biển',
      },
    })

    const onCategoryChange = vi.fn()
    const onCategoryNameChange = vi.fn()

    renderWithProviders(
      <CategorySelect
        category=""
        onCategoryChange={onCategoryChange}
        onCategoryNameChange={onCategoryNameChange}
      />
    )

    fireEvent.click(screen.getByRole('combobox'))
    const createOption = await screen.findByText('+ Thêm danh mục mới...')
    fireEvent.click(createOption)

    const input = screen.getByPlaceholderText('Nhập tên danh mục (VD: Ngập ven biển)')
    fireEvent.change(input, { target: { value: 'Ngập ven biển' } })

    const saveBtn = screen.getByRole('button', { name: /Lưu/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(layerCategoryService.create).toHaveBeenCalledWith('Ngập ven biển')
      expect(onCategoryChange).toHaveBeenCalledWith('ngap_ven_bien')
      expect(onCategoryNameChange).toHaveBeenCalledWith('Ngập ven biển')
    })
  })

  it('displays error message when category creation fails', async () => {
    vi.mocked(layerCategoryService.create).mockRejectedValueOnce({
      body: { message: 'Tên danh mục đã tồn tại' },
    })

    renderWithProviders(
      <CategorySelect
        category=""
        onCategoryChange={vi.fn()}
        onCategoryNameChange={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('combobox'))
    const createOption = await screen.findByText('+ Thêm danh mục mới...')
    fireEvent.click(createOption)

    const input = screen.getByPlaceholderText('Nhập tên danh mục (VD: Ngập ven biển)')
    fireEvent.change(input, { target: { value: 'Giao thông' } })

    const saveBtn = screen.getByRole('button', { name: /Lưu/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(screen.getByText('Tên danh mục đã tồn tại')).toBeInTheDocument()
    })
  })

  it('cancels create new category form when closing', async () => {
    renderWithProviders(
      <CategorySelect
        category=""
        onCategoryChange={vi.fn()}
        onCategoryNameChange={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('combobox'))
    const createOption = await screen.findByText('+ Thêm danh mục mới...')
    fireEvent.click(createOption)

    expect(screen.getByText('Tên danh mục mới')).toBeInTheDocument()

    const closeBtn = screen.getByRole('button', { name: 'Đóng thêm mới' })
    fireEvent.click(closeBtn)

    expect(screen.queryByText('Tên danh mục mới')).not.toBeInTheDocument()
  })

  it('does not render inline manage dialog button anymore', async () => {
    vi.mocked(layerCategoryService.getAll).mockResolvedValueOnce({
      status: 200,
      message: 'Thành công',
      data: [
        { id: 1, key: 'land_cover', name: 'Lớp phủ mặt đất' },
        { id: 10, key: 'ngap_ven_bien', name: 'Ngập ven biển' },
      ],
    })

    renderWithProviders(
      <CategorySelect
        category="ngap_ven_bien"
        categoryName="Ngập ven biển"
        onCategoryChange={vi.fn()}
        onCategoryNameChange={vi.fn()}
        label="Nhóm lớp bản đồ"
      />
    )

    // Inline management button should not be present
    expect(screen.queryByRole('button', { name: /Quản lý/i })).not.toBeInTheDocument()
  })

  it('filters categories in real time when typing in search input and selects item', async () => {
    const onCategoryChange = vi.fn()
    const onCategoryNameChange = vi.fn()

    renderWithProviders(
      <CategorySelect
        category=""
        onCategoryChange={onCategoryChange}
        onCategoryNameChange={onCategoryNameChange}
        label="Nhóm lớp bản đồ"
      />
    )

    // Open combobox popover
    fireEvent.click(screen.getByRole('combobox'))

    const searchInput = await screen.findByPlaceholderText('Tìm kiếm danh mục...')
    expect(searchInput).toBeInTheDocument()

    // Type "giao" to filter for "Giao thông"
    fireEvent.change(searchInput, { target: { value: 'giao' } })

    // "Giao thông" should be visible, "Lớp phủ mặt đất" should not be visible in filtered results
    expect(screen.getByText('Giao thông')).toBeInTheDocument()
    expect(screen.queryByText('Lớp phủ mặt đất')).not.toBeInTheDocument()

    // Click on filtered item
    fireEvent.click(screen.getByText('Giao thông'))

    expect(onCategoryChange).toHaveBeenCalledWith('giao_thong')
    expect(onCategoryNameChange).toHaveBeenCalledWith('Giao thông')
  })

  it('pre-populates search query into new category input when clicking add new', async () => {
    renderWithProviders(
      <CategorySelect
        category=""
        onCategoryChange={vi.fn()}
        onCategoryNameChange={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('combobox'))
    const searchInput = await screen.findByPlaceholderText('Tìm kiếm danh mục...')

    fireEvent.change(searchInput, { target: { value: 'Ven biển' } })

    // Click "+ Thêm danh mục mới..."
    const addBtn = screen.getByText('+ Thêm danh mục mới...')
    fireEvent.click(addBtn)

    const newNameInput = screen.getByPlaceholderText('Nhập tên danh mục (VD: Ngập ven biển)')
    expect(newNameInput).toHaveValue('Ven biển')
  })

  it('displays error state directly when category loading fails and does not fallback to hardcoded options', async () => {
    vi.mocked(layerCategoryService.getAll).mockRejectedValue(new Error('Máy chủ gặp sự cố (500)'))

    renderWithProviders(
      <CategorySelect
        category=""
        onCategoryChange={vi.fn()}
        onCategoryNameChange={vi.fn()}
        label="Nhóm lớp bản đồ"
      />
    )

    // Trigger shows error text
    const trigger = await screen.findByRole('combobox')
    await waitFor(() => {
      expect(trigger).toHaveTextContent('Lỗi tải danh mục (nhấn để xem/thử lại)')
    })

    // Error banner below trigger shows error message
    expect(screen.getByText(/Lỗi tải danh mục: Máy chủ gặp sự cố \(500\)/)).toBeInTheDocument()

    // Clicking trigger opens popover with error UI
    fireEvent.click(trigger)
    expect(await screen.findByText('Không thể tải danh sách danh mục')).toBeInTheDocument()
    expect(screen.getByText('Máy chủ gặp sự cố (500)')).toBeInTheDocument()

    // No hardcoded categories are displayed
    expect(screen.queryByText('Phân loại đối tượng theo huyện')).not.toBeInTheDocument()
    expect(screen.queryByText('Lớp phủ mặt đất')).not.toBeInTheDocument()
  })
})
