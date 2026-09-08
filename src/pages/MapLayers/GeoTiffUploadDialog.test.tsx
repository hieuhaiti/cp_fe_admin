/**
 * ============================================================
 * MANUAL TEST SCENARIO — TẢI VÀ CÔNG BỐ GEOTIFF (GEOTIFF UPLOAD DIALOG)
 * ============================================================
 *
 * [CREATE / UPLOAD - Tải lên và công bố tệp GeoTIFF]
 * 1. Mở Dialog Tải GeoTIFF (nhấn nút "Tải GeoTIFF").
 * 2. Nhập các trường:
 *    - Tệp GeoTIFF *: Chọn map.tif (định dạng .tif / .tiff, dung lượng <= 500MB).
 *    - Tên lớp *: "Lớp ngập lụt Cẩm Phả".
 *    - EPSG *: 4326 (khớp chuẩn SRID metadata của raster).
 *    - Danh mục: Ranh giới / Ngập lụt / Rừng.
 * 3. Nhấn "Tải lên và công bố".
 * 4. Kỳ vọng: Hệ thống upload storage -> tạo image metadata -> xuất bản layer thành công -> đóng dialog và gọi callback onPublished.
 *
 * [VALIDATION - Kiểm thử lỗi]
 * - Nhấn submit mà chưa chọn file -> Toast báo "Vui lòng chọn tệp GeoTIFF."
 * - Chọn file không phải TIFF (ví dụ: map.png) -> Toast báo "Chỉ hỗ trợ tệp .tif hoặc .tiff."
 * - Nhập mã EPSG không hợp lệ (ví dụ: "abc") -> Toast báo "Mã EPSG không hợp lệ."
 * ============================================================
 */

import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GeoTiffUploadDialog from './GeoTiffUploadDialog'
import { renderWithProviders } from '@/test/renderWithProviders'
import { makeFile } from '@/test/fixtures'

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  createImage: vi.fn(),
  publishImage: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))
vi.mock('@/service', () => ({
  remoteSensingService: {
    createImage: mocks.createImage,
    publishImage: mocks.publishImage,
  },
  mapLayerService: {
    getTimeSeriesCatalog: vi.fn().mockResolvedValue({ data: [] }),
    getById: vi.fn().mockResolvedValue({ data: { updatedAt: '2026-01-01' } }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
  },
  useApiQuery: () => ({ data: { data: [] }, isLoading: false }),
}))
vi.mock('@/service/storageService', () => ({ default: { upload: mocks.upload } }))
vi.mock('react-toastify', () => ({ toast: { error: mocks.toastError, success: mocks.toastSuccess } }))

function renderDialog(props: Partial<React.ComponentProps<typeof GeoTiffUploadDialog>> = {}) {
  return renderWithProviders(
    <GeoTiffUploadDialog open onOpenChange={vi.fn()} onPublished={vi.fn()} {...props} />
  )
}

describe('GeoTiffUploadDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.upload.mockResolvedValue(1)
    mocks.createImage.mockResolvedValue({ data: { id: 9 } })
    mocks.publishImage.mockResolvedValue({ success: true })
  })

  it('rejects submit without a file in default Time Series mode', () => {
    renderDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Lưu vào chuỗi thời gian' }))
    expect(mocks.toastError).toHaveBeenCalledWith('Vui lòng chọn tệp ảnh bản đồ.')
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('rejects a non-GeoTIFF file', () => {
    renderDialog()
    fireEvent.change(screen.getByLabelText('Tệp ảnh bản đồ *'), {
      target: { files: [makeFile('map.png', 'image/png')] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu vào chuỗi thời gian' }))
    expect(mocks.toastError).toHaveBeenCalledWith('Chỉ hỗ trợ tệp .tif hoặc .tiff.')
  })

  it('uploads and creates a Time Series member without publishing standalone layer', async () => {
    const onPublished = vi.fn()
    const onOpenChange = vi.fn()
    renderDialog({ onPublished, onOpenChange })

    fireEvent.change(screen.getByLabelText('Tệp ảnh bản đồ *'), {
      target: { files: [makeFile('map.tif', 'image/tiff')] },
    })
    fireEvent.change(screen.getByLabelText(/Tên lớp/i), {
      target: { value: 'Lớp phủ 2018' },
    })
    fireEvent.change(screen.getByLabelText(/Khóa nhóm Time Series/i), {
      target: { value: 'cam-pha-do-thi' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu vào chuỗi thời gian' }))

    await waitFor(() => expect(mocks.createImage).toHaveBeenCalledTimes(1))
    expect(mocks.upload).toHaveBeenCalledWith(expect.any(File), 'raster')
    expect(mocks.createImage).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Lớp phủ 2018',
        coverageKey: 'cam-pha-do-thi',
        fileObjectId: 1,
      })
    )
    expect(mocks.publishImage).not.toHaveBeenCalled()
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      expect.stringContaining('cam-pha-do-thi')
    )
    expect(onPublished).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('rejects invalid EPSG in standalone mode', () => {
    renderDialog()
    fireEvent.click(screen.getByRole('button', { name: /Công bố lớp độc lập/i }))
    fireEvent.change(screen.getByLabelText('Tệp ảnh bản đồ *'), {
      target: { files: [makeFile('map.tif', 'image/tiff')] },
    })
    fireEvent.change(screen.getByLabelText(/Hệ tọa độ/i), {
      target: { value: 'abc' },
    })
    fireEvent.change(screen.getByLabelText(/Tên lớp/i), {
      target: { value: 'Lớp ngập' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Tải lên và công bố' }))

    expect(mocks.toastError).toHaveBeenCalledWith('Hệ tọa độ không hợp lệ.')
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('uploads, creates and publishes a valid GeoTIFF in standalone mode', async () => {
    const onPublished = vi.fn()
    const onOpenChange = vi.fn()
    renderDialog({ onPublished, onOpenChange })

    fireEvent.click(screen.getByRole('button', { name: /Công bố lớp độc lập/i }))
    fireEvent.change(screen.getByLabelText('Tệp ảnh bản đồ *'), {
      target: { files: [makeFile('map.tif', 'image/tiff')] },
    })
    fireEvent.change(screen.getByLabelText(/Tên lớp/i), {
      target: { value: 'Lớp ngập' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Tải lên và công bố' }))

    await waitFor(() => expect(mocks.publishImage).toHaveBeenCalledTimes(1))
    expect(mocks.upload).toHaveBeenCalledWith(expect.any(File), 'raster')
    expect(mocks.createImage).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Lớp ngập', fileObjectId: 1 })
    )
    expect(mocks.publishImage).toHaveBeenCalledWith(
      9,
      expect.objectContaining({ srid: 4326, nameVi: 'Lớp ngập' })
    )
    expect(onPublished).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows helpful guidance on standalone code conflict', async () => {
    mocks.publishImage.mockRejectedValueOnce({
      response: {
        data: {
          errors: ['RASTER_LAYER_CONFLICT'],
          message: 'Mã lớp đã tồn tại hoặc file đã liên kết với lớp khác',
        },
      },
    })
    renderDialog()

    fireEvent.click(screen.getByRole('button', { name: /Công bố lớp độc lập/i }))
    fireEvent.change(screen.getByLabelText('Tệp ảnh bản đồ *'), {
      target: { files: [makeFile('map.tif', 'image/tiff')] },
    })
    fireEvent.change(screen.getByLabelText(/Tên lớp/i), {
      target: { value: 'Lớp ngập' },
    })
    fireEvent.change(screen.getByLabelText(/Mã lớp độc lập/i), {
      target: { value: 'test' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Tải lên và công bố' }))

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1))
    expect(mocks.toastError).toHaveBeenCalledWith(
      expect.stringContaining('Mã lớp độc lập "test" đã tồn tại')
    )
  })

  it('gán coverageKey tùy chọn khi công bố lớp độc lập để sẵn sàng gộp Time Series', async () => {
    mocks.createImage.mockResolvedValue({ status: 201, data: { id: 88 } })
    mocks.publishImage.mockResolvedValue({ status: 200, data: { layer: { id: 99 } } })
    renderDialog()

    fireEvent.click(screen.getByRole('button', { name: /Công bố lớp độc lập/ }))

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, {
      target: { files: [makeFile('map2018.tif', 'image/tiff')] },
    })
    fireEvent.change(screen.getByLabelText(/^Tên lớp/), {
      target: { value: 'Lớp phủ 2018' },
    })
    fireEvent.change(screen.getByLabelText(/Mã lớp độc lập/i), {
      target: { value: 'lop_phu_2018' },
    })
    fireEvent.change(screen.getByLabelText(/Khóa chuỗi thời gian/i), {
      target: { value: 'cam-pha-lop-phu-do-thi' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Tải lên và công bố' }))

    await waitFor(() => {
      expect(mocks.createImage).toHaveBeenCalledWith(
        expect.objectContaining({
          coverageKey: 'cam-pha-lop-phu-do-thi',
          thematicGroup: 'remote_sensing',
        })
      )
      expect(mocks.publishImage).toHaveBeenCalledWith(
        88,
        expect.objectContaining({
          code: 'lop_phu_2018',
        })
      )
    })
  })
})

