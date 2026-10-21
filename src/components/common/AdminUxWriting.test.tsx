import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GEOMETRY_TYPE_LABEL } from '@/constant/mapLayerConstant'
import PageLayout from '@/layout/pageLayout'
import LoadingInline from '@/components/common/LoadingInline'
import LoadingOverlay from '@/components/common/LoadingOverlay'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from '@/components/ui/pagination'

describe('Shared Admin UX writing', () => {
  it.each([
    ['POINT', 'Dữ liệu điểm'],
    ['MULTIPOINT', 'Dữ liệu đa điểm'],
    ['LINESTRING', 'Dữ liệu đường'],
    ['MULTILINESTRING', 'Dữ liệu đa đường'],
    ['POLYGON', 'Dữ liệu vùng'],
    ['MULTIPOLYGON', 'Dữ liệu đa vùng'],
    ['GEOMETRY', 'Dữ liệu hình học'],
    ['RASTER', 'Ảnh bản đồ'],
  ])('localizes geometry %s without changing its key', (value, label) => {
    expect(GEOMETRY_TYPE_LABEL[value]).toBe(label)
  })

  it('omits an absent description while preserving useful descriptions', () => {
    const view = render(<PageLayout title="Tin tức"><span>Nội dung</span></PageLayout>)
    expect(screen.getByRole('heading', { level: 1, name: 'Tin tức' })).toBeInTheDocument()
    expect(view.container.querySelector('p')).toBeNull()
    view.rerender(<PageLayout title="Tin tức" description="Chỉ hiển thị bài viết đã xuất bản."><span>Nội dung</span></PageLayout>)
    expect(screen.getByText('Chỉ hiển thị bài viết đã xuất bản.')).toBeInTheDocument()
  })

  it('localizes pagination without changing destinations', () => {
    render(<Pagination><PaginationContent><PaginationItem><PaginationPrevious href="?page=1" /></PaginationItem><PaginationItem><PaginationNext href="?page=3" /></PaginationItem></PaginationContent></Pagination>)
    expect(screen.getByRole('navigation', { name: 'Phân trang' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Trang trước' })).toHaveAttribute('href', '?page=1')
    expect(screen.getByRole('link', { name: 'Trang sau' })).toHaveAttribute('href', '?page=3')
  })

  it('gives the canonical dialog close button a Vietnamese name', () => {
    render(<Dialog open><DialogContent aria-describedby={undefined}><DialogTitle>Chi tiết</DialogTitle></DialogContent></Dialog>)
    expect(screen.getByRole('button', { name: 'Đóng' })).toBeInTheDocument()
    expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-describedby')
  })

  it.each(['inline', 'center'])('announces inline loading in %s mode', (position) => {
    render(<LoadingInline position={position} />)
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải')
  })

  it('announces overlay loading', () => {
    render(<LoadingOverlay />)
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải')
  })
})
