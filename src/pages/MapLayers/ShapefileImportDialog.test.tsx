import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ShapefileImportDialog from './ShapefileImportDialog'
import { renderWithProviders } from '@/test/renderWithProviders'
import { makeFile } from '@/test/fixtures'

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  importShapefile: vi.fn(),
  getImportJob: vi.fn(),
  getImportErrors: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock('@/service', () => ({
  mapLayerService: {
    importShapefile: mocks.importShapefile,
    getImportJob: mocks.getImportJob,
    getImportErrors: mocks.getImportErrors,
  },
  storageService: {
    upload: mocks.upload,
  },
  layerCategoryService: {
    getAll: vi.fn().mockResolvedValue({
      status: 200,
      message: 'Thành công',
      data: [
        { id: 1, key: 'ranh_gioi', name: 'Ranh giới hành chính' },
        { id: 2, key: 'quy_hoach', name: 'Quy hoạch xây dựng' },
      ],
    }),
  },
  useApiQuery: () => ({ data: { data: [] }, isLoading: false }),
}))

vi.mock('@/service/storageService', () => ({ default: { upload: mocks.upload } }))
vi.mock('react-toastify', () => ({ toast: { error: mocks.toastError, success: mocks.toastSuccess } }))

function renderDialog(props: Partial<React.ComponentProps<typeof ShapefileImportDialog>> = {}) {
  return renderWithProviders(
    <ShapefileImportDialog
      open={true}
      onOpenChange={vi.fn()}
      onSuccess={vi.fn()}
      {...props}
    />
  )
}

describe('ShapefileImportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.upload.mockResolvedValue(101)
    mocks.importShapefile.mockResolvedValue({
      data: { id: 202, status: 'queued', progress: 0 },
    })
    mocks.getImportJob.mockResolvedValue({
      data: { id: 202, status: 'completed', progress: 100, feature_count: 45, geometry_type: 'MULTIPOLYGON' },
    })
  })

  it('renders dialog with shapefile guidance and required inputs', () => {
    renderDialog()

    expect(screen.getByText('Nhập lớp bản đồ từ Shapefile')).toBeInTheDocument()
    expect(screen.getByText(/Yêu cầu cấu trúc tệp Shapefile/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Tên lớp hiển thị/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Mã lớp kỹ thuật/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tiến hành nhập Shapefile/i })).toBeInTheDocument()
  })

  it('validates submission when no file is selected', () => {
    renderDialog()

    const submitBtn = screen.getByRole('button', { name: /Tiến hành nhập Shapefile/i })
    expect(submitBtn).toBeDisabled()
  })

  it('automatically generates code from Vietnamese nameVi', async () => {
    renderDialog()

    const nameInput = screen.getByLabelText(/Tên lớp hiển thị/)
    const codeInput = screen.getByLabelText(/Mã lớp kỹ thuật/) as HTMLInputElement

    fireEvent.change(nameInput, { target: { value: 'Ranh Giới Đô Thị 2030' } })

    expect(codeInput.value).toBe('ranh_gioi_do_thi_2030')
  })

  it('uploads file to storage and enqueues shapefile import', async () => {
    const onSuccess = vi.fn()
    renderDialog({ onSuccess })

    const file = makeFile('boundary.zip', 'application/zip', 1024)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).toBeTruthy()

    fireEvent.change(fileInput, { target: { files: [file] } })

    const nameInput = screen.getByLabelText(/Tên lớp hiển thị/)
    fireEvent.change(nameInput, { target: { value: 'Ranh giới Cẩm Phả' } })

    const submitBtn = screen.getByRole('button', { name: /Tiến hành nhập Shapefile/i })
    expect(submitBtn).not.toBeDisabled()
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mocks.upload).toHaveBeenCalledWith(file, 'layers')
    })

    await waitFor(() => {
      expect(mocks.importShapefile).toHaveBeenCalledWith(
        expect.objectContaining({
          fileObjectId: 101,
          code: expect.stringMatching(/^[a-z][a-z0-9_]+$/),
          nameVi: 'Ranh giới Cẩm Phả',
          targetSrid: 4326,
          isPublic: true,
        })
      )
    })

    await waitFor(() => {
      expect(mocks.getImportJob).toHaveBeenCalledWith(202)
    })

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  it('handles and displays error when import job fails', async () => {
    mocks.getImportJob.mockResolvedValueOnce({
      data: {
        id: 202,
        status: 'failed',
        error_code: 'SHAPEFILE_CRS_UNKNOWN',
        error_message: 'Shapefile thiếu CRS EPSG xác định',
      },
    })
    mocks.getImportErrors.mockResolvedValueOnce({
      data: {
        items: [
          { id: 1, source_row: 1, error_code: 'GEOMETRY_INVALID', error_message: 'Hình học tự cắt' },
        ],
      },
    })

    renderDialog()

    const file = makeFile('boundary.zip', 'application/zip', 1024)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [file] } })

    const nameInput = screen.getByLabelText(/Tên lớp hiển thị/)
    fireEvent.change(nameInput, { target: { value: 'Lớp Lỗi' } })

    const submitBtn = screen.getByRole('button', { name: /Tiến hành nhập Shapefile/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText('Nhập Shapefile thất bại')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByText(/Shapefile thiếu CRS EPSG xác định/)).toBeInTheDocument()
    })
  })
})
