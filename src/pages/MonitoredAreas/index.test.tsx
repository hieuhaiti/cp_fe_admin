/**
 * ============================================================
 * MANUAL TEST SCENARIO — QUẢN LÝ KHU VỰC THEO DÕI (MONITORED AREAS)
 * ============================================================
 *
 * [CREATE - Thêm mới khu vực theo dõi]
 * 1. Mở trang Khu vực theo dõi (/monitored-areas).
 * 2. Nhấn nút "Thêm khu vực".
 * 3. Trong Form Dialog:
 *    - Tên khu vực: "Khu vực theo dõi sạt lở đồi Cẩm Phả".
 *    - Mã địa bàn: "22001".
 *    - Ghi chú: "Theo dõi biến động rừng và hiện trạng mặt đất quý III/2026.".
 *    - Polygon GeoJSON *:
 *      {
 *        "type": "Polygon",
 *        "coordinates": [[[107.25, 20.95], [107.27, 20.95], [107.27, 20.97], [107.25, 20.97], [107.25, 20.95]]]
 *      }
 * 4. Nhấn "Tạo khu vực".
 * 5. Kỳ vọng: Tạo khu vực thành công, bản ghi mới xuất hiện trên bảng.
 *
 * [READ - Xem danh sách & Chi tiết dòng thời gian]
 * 1. Tìm kiếm theo mã địa bàn "22001".
 * 2. Nhấp vào hàng dữ liệu bất kỳ trên bảng.
 * 3. Kỳ vọng: Dialog chi tiết mở ra hiển thị: Mã khu vực, Tên khu vực, Mã địa bàn, Người tạo, Tổng số phiên đo, Ghi chú và Bảng dòng thời gian các phiên đo đo đạc thực địa.
 *
 * [VALIDATION - Kiểm thử lỗi]
 * - Nhập GeoJSON kiểu "Point" hoặc không đủ 4 điểm -> Báo lỗi "GeoJSON phải là Polygon hợp lệ, có ít nhất 4 điểm".
 * ============================================================
 */

import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MonitoredAreasPage from './index'
import { renderWithProviders } from '@/test/renderWithProviders'
import { useAuthStore } from '@/stores/common/useAuthStore'
import type { CreateMonitoredAreaBody, User } from '@/types/api'

const createMutate = vi.hoisted(() => vi.fn())
const createArea = vi.hoisted(() => vi.fn())
const queryMock = vi.hoisted(() => vi.fn())
const mutationMock = vi.hoisted(() => vi.fn())

vi.mock('@/service', () => ({
  fieldMeasurementService: { getAreas: vi.fn(), getAreaById: vi.fn(), createArea },
  useApiQuery: queryMock,
  useApiMutation: mutationMock,
}))

const creator = {
  id: 4, email: 'measure@example.com', fullName: 'Creator', roleCode: 'so_tnmt', isActive: true,
  role: { code: 'so_tnmt', name: 'Sở TN&MT', permissions: { field_measurements: { create: true } } },
} as User

const listResponse = { data: { items: [] }, metadata: { page: 1, limit: 10, total: 0, totalPages: 1 } }

describe('MonitoredAreasPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: creator })
    queryMock.mockImplementation((key: unknown) => String(key).includes('monitored-area,') ? { data: undefined, isLoading: false } : { data: listResponse, isLoading: false, refetch: vi.fn() })
    createArea.mockResolvedValue({ status: 200, data: {} })
    mutationMock.mockImplementation((mutationFn: (variables: unknown) => unknown) => ({
      mutate: (variables: unknown) => {
        createMutate(variables)
        return mutationFn(variables)
      },
      isPending: false,
    }))
  })

  it('renders no-data state and permission-gated create action', () => {
    renderWithProviders(<MonitoredAreasPage />)
    expect(screen.getByRole('heading', { name: 'Khu vực theo dõi' })).toBeInTheDocument()
    expect(screen.getByText('Chưa có khu vực theo dõi.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Thêm khu vực/ })).toBeInTheDocument()
  })

  it('validates invalid GeoJSON before create mutation', async () => {
    renderWithProviders(<MonitoredAreasPage />)
    fireEvent.click(screen.getByRole('button', { name: /Thêm khu vực/ }))
    fireEvent.change(screen.getByLabelText(/Ranh giới khu vực/i), { target: { value: '{"type":"Point","coordinates":[1,2]}' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo khu vực' }))
    expect(await screen.findByText('Ranh giới khu vực phải hợp lệ và có ít nhất 4 điểm')).toBeInTheDocument()
    expect(createMutate).not.toHaveBeenCalled()
  })

  it('submits trimmed CreateMonitoredAreaBody with parsed polygon', async () => {
    renderWithProviders(<MonitoredAreasPage />)
    fireEvent.click(screen.getByRole('button', { name: /Thêm khu vực/ }))
    fireEvent.change(screen.getByLabelText(/Tên khu vực/i), { target: { value: '  Khu A  ' } })
    fireEvent.change(screen.getByLabelText(/Mã địa bàn/i), { target: { value: '  22001 ' } })
    fireEvent.change(screen.getByLabelText(/Ghi chú/i), { target: { value: '  Theo dõi quý I  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo khu vực' }))
    await waitFor(() => expect(createArea).toHaveBeenCalledWith(expect.objectContaining({ name: 'Khu A', communeCode: '22001', note: 'Theo dõi quý I' })))
    const submitted = createArea.mock.calls[0][0] as CreateMonitoredAreaBody
    expect(submitted.geom.type).toBe('Polygon')
    expect(submitted.geom.coordinates[0]).toHaveLength(4)
  })

  it('hides create action without field_measurements:create', () => {
    useAuthStore.setState({ user: { ...creator, role: { code: 'so_tnmt', name: 'Sở TN&MT', permissions: {} } } })
    renderWithProviders(<MonitoredAreasPage />)
    expect(screen.queryByRole('button', { name: /Thêm khu vực/ })).not.toBeInTheDocument()
  })
})
