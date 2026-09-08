import { useState, useMemo } from 'react'
import { Eye, Pen, Plus, RefreshCw, Trash2, Clock, Copy } from 'lucide-react'
import { toast } from 'react-toastify'
import PageLayout from '@/layout/pageLayout'
import ToolTableCustom from '@/components/features/ToolTableCustom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { mapLayerService, useApiQuery } from '@/service'
import { useAuthStore } from '@/stores/common/useAuthStore'
import { hasPerm } from '@/lib/permissions'
import { formatDateTime } from '@/lib/date'
import type { ApiResponse, TimeSeriesCatalogLayer } from '@/types/api'
import TimeSeriesDetailDialog from './TimeSeriesDetailDialog'
import TimeSeriesCreateDialog from './TimeSeriesCreateDialog'
import TimeSeriesEditDialog from './TimeSeriesEditDialog'
import TimeSeriesDeleteDialog from './TimeSeriesDeleteDialog'

function getCatalog(data: unknown): TimeSeriesCatalogLayer[] {
  const response = data as ApiResponse<TimeSeriesCatalogLayer[]> | undefined
  return (response?.data ?? []).filter(
    (layer) =>
      layer.timeSeries?.enabled === true &&
      Array.isArray(layer.timeSeries.values) &&
      layer.timeSeries.values.length > 0
  )
}

export default function TimeSeriesPage() {
  const { user } = useAuthStore()

  // Phân quyền theo server permissions
  const canRead = hasPerm(user, 'raster', 'read')
  const canCreate = hasPerm(user, 'raster', 'create')
  const canPublish = canCreate && hasPerm(user, 'layers', 'create')
  const canUpdate = hasPerm(user, 'layers', 'update')
  const canDelete = hasPerm(user, 'layers', 'delete')

  // Tìm kiếm và phân trang phía giao diện. API danh mục lớp theo thời gian
  // không hỗ trợ tham số phân trang/lọc nên giao diện không tự thêm tham số.
  const [keyword, setKeyword] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [limit, setLimit] = useState(10)

  // Dialog states
  const [createOpen, setCreateOpen] = useState(false)
  const [detailLayer, setDetailLayer] = useState<TimeSeriesCatalogLayer | null>(null)
  const [editItem, setEditItem] = useState<TimeSeriesCatalogLayer | null>(null)
  const [deleteItem, setDeleteItem] = useState<TimeSeriesCatalogLayer | null>(null)

  const catalogQuery = useApiQuery(
    ['webMap', 'timeSeriesLayers'],
    () => mapLayerService.getTimeSeriesCatalog(),
    { enabled: canRead, staleTime: 0 }
  )

  const filteredLayers = useMemo(() => {
    const term = keyword.trim().toLocaleLowerCase('vi')
    const catalog = getCatalog(catalogQuery.data)
    if (!term) return catalog
    return catalog.filter((layer) =>
      [
        layer.code,
        layer.nameVi,
        layer.category,
        layer.categoryName,
        layer.geoserverLayer,
        layer.timeSeries?.coverageKey,
      ].some((value) => value?.toLocaleLowerCase('vi').includes(term))
    )
  }, [catalogQuery.data, keyword])

  const totalPages = Math.max(1, Math.ceil(filteredLayers.length / limit))
  const layers = filteredLayers.slice((currentPage - 1) * limit, currentPage * limit)

  const refetchData = () => {
    catalogQuery.refetch()
  }

  if (!canRead) {
    return (
      <PageLayout
        title="Lớp dữ liệu theo thời gian"
        description="Quản lý danh mục ảnh vệ tinh theo nhiều mốc thời gian."
      >
        <div className="text-destructive py-12 text-center">
          Bạn không có quyền truy cập danh mục lớp dữ liệu theo thời gian.
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Quản lý lớp dữ liệu theo thời gian"
      description="Chọn nhóm dữ liệu để tổng hợp các ảnh cùng nhóm thành lớp dữ liệu theo thời gian."
    >
   
      <ToolTableCustom
        searchValue={keyword}
        setSearchValue={(value: string) => {
          setKeyword(value)
          setCurrentPage(1)
        }}
        filter={
          <div className="flex items-center gap-2">
            <Select
              value={`${limit}`}
              onValueChange={(v) => {
                setLimit(parseInt(v, 10))
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              tooltip="Làm mới dữ liệu"
              onClick={refetchData}
              disabled={catalogQuery.isFetching}
            >
              <RefreshCw className={`size-4 ${catalogQuery.isFetching ? 'animate-spin' : ''}`} />
            </Button>

            {canPublish && (
              <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
                <Plus className="size-4" />
                <span>Tổng hợp lớp chuỗi thời gian</span>
              </Button>
            )}
          </div>
        }
        total={filteredLayers.length}
        pagination={{
          currentPage,
          totalPages,
          onPageChange: (page: number) => setCurrentPage(page),
        }}
      >
        <Table className="relative">
          <TableHeader className="sticky top-0 z-20">
            <TableRow>
              <TableHead className="w-12">STT</TableHead>
              <TableHead>Mã lớp</TableHead>
              <TableHead>Khóa chuỗi</TableHead>
              <TableHead>Tên lớp</TableHead>
              <TableHead>Nhóm dữ liệu</TableHead>
              <TableHead>Số mốc</TableHead>
              <TableHead>Mốc mới nhất</TableHead>
              <TableHead>Phạm vi</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {catalogQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-muted-foreground py-8 text-center text-sm">
                  Đang tải danh mục chuỗi thời gian...
                </TableCell>
              </TableRow>
            ) : catalogQuery.isError ? (
              <TableRow>
                <TableCell colSpan={9} className="text-destructive py-8 text-center text-sm">
                  Không thể tải danh mục bản đồ số. Vui lòng thử lại.
                </TableCell>
              </TableRow>
            ) : layers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-muted-foreground py-8 text-center text-sm">
                  Chưa có lớp chuỗi thời gian đã xuất bản nào trong danh mục bản đồ số.
                </TableCell>
              </TableRow>
            ) : (
              layers.map((item, index) => {
                const values = item.timeSeries.values
                const latestTime = values.at(-1)
                const coverageKey = item.timeSeries.coverageKey
                return (
                  <TableRow
                    key={String(item.id)}
                    className="hover:cursor-pointer"
                    onClick={() => setDetailLayer(item)}
                  >
                    <TableCell className="text-muted-foreground text-xs">
                      {(currentPage - 1) * limit + index + 1}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-semibold text-primary">
                      {item.code}
                    </TableCell>
                    <TableCell className="text-xs">
                      {coverageKey ? (
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="font-mono text-[11px] font-normal">
                            {coverageKey}
                          </Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-6 text-muted-foreground hover:text-foreground"
                            title="Sao chép khóa chuỗi"
                            aria-label={`Sao chép khóa chuỗi ${coverageKey}`}
                            onClick={(event) => {
                              event.stopPropagation()
                              navigator.clipboard.writeText(coverageKey)
                              toast.success(`Đã sao chép khóa: ${coverageKey}`)
                            }}
                          >
                            <Copy className="size-3" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm text-foreground">{item.nameVi}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {item.categoryName || item.category || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-xs font-normal">
                        <Clock className="mr-1 size-3" />
                        {values.length} mốc
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {latestTime ? formatDateTime(latestTime) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.isPublic ? 'default' : 'outline'} className="text-xs">
                        {item.isPublic ? 'Công khai' : 'Nội bộ'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          tooltip="Xem chi tiết"
                          onClick={(event) => {
                            event.stopPropagation()
                            setDetailLayer(item)
                          }}
                        >
                          <Eye className="size-4" />
                        </Button>

                        {canUpdate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            tooltip="Chỉnh sửa"
                            onClick={(event) => {
                              event.stopPropagation()
                              setEditItem(item)
                            }}
                          >
                            <Pen className="size-4" />
                          </Button>
                        )}

                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            tooltip="Xóa"
                            onClick={(event) => {
                              event.stopPropagation()
                              setDeleteItem(item)
                            }}
                          >
                            <Trash2 className="text-destructive size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </ToolTableCustom>

      {/* Hộp thoại */}
      <TimeSeriesCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={refetchData}
      />

      <TimeSeriesDetailDialog
        open={!!detailLayer}
        onOpenChange={(open) => !open && setDetailLayer(null)}
        layer={detailLayer}
      />

      <TimeSeriesEditDialog
        open={!!editItem}
        onOpenChange={(open) => !open && setEditItem(null)}
        layer={editItem}
        onSuccess={refetchData}
      />

      <TimeSeriesDeleteDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        layer={deleteItem}
        onSuccess={refetchData}
      />
    </PageLayout>
  )
}
