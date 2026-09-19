import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { mapLayerService, useApiQuery } from '@/service'
import type { ApiResponse, MapLayer } from '@/types/api'
import { formatDateTime } from '@/lib/date'
import { getMapLayerCategoryLabel, ROLE_LABEL_MAP } from '@/constant/mapLayerConstant'
import {
  buildMapProxyExportUrl,
  downloadGeoJsonFile,
  downloadRasterFile,
} from '@/lib/geoserver'
import { toast } from 'react-toastify'
import { useState } from 'react'
import { CalendarClock, Database, Download, Info, RefreshCw, ShieldCheck } from 'lucide-react'

interface MapLayerDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  layerId: number | string | null
}

type MapLayerDetailData = MapLayer | { mapLayer?: MapLayer }

const LAYER_KIND_LABEL: Record<string, string> = {
  basemap: 'Lớp nền',
  overlay: 'Lớp chuyên đề',
}

function getLayerDetail(response?: ApiResponse<MapLayerDetailData>): MapLayer | null {
  const data = response?.data
  if (!data) return null
  if ('mapLayer' in data) return data.mapLayer ?? null
  return data as MapLayer
}



function formatCount(value?: number | string | null): string {
  if (value === null || value === undefined || value === '') return '-'
  const count = Number(value)
  return Number.isFinite(count) ? count.toLocaleString('vi-VN') : String(value)
}

function CodeValue({ children }: { children?: ReactNode }) {
  if (children === null || children === undefined || children === '') return <>-</>
  return (
    <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs break-all">{children}</code>
  )
}

function DetailField({
  label,
  children,
  wide = false,
}: {
  label: string
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div className={wide ? 'space-y-1 sm:col-span-2' : 'space-y-1'}>
      <dt className="text-muted-foreground text-xs font-medium">{label}</dt>
      <dd className="text-sm break-words">{children ?? '-'}</dd>
    </div>
  )
}



function BooleanBadge({
  value,
  trueLabel,
  falseLabel,
  tone = 'success',
}: {
  value?: boolean
  trueLabel: string
  falseLabel: string
  tone?: 'success' | 'info' | 'warning'
}) {
  if (value === undefined) return <Badge variant="secondary">Chưa xác định</Badge>

  const toneClass = {
    info: 'border-info/30 bg-info/10 text-info',
    success: 'border-success/30 bg-success/10 text-success',
    warning: 'border-warning/30 bg-warning/10 text-warning',
  }[tone]

  return (
    <Badge variant="outline" className={value ? toneClass : 'text-muted-foreground'}>
      {value ? trueLabel : falseLabel}
    </Badge>
  )
}

export default function MapLayerDetailDialog({
  open,
  onOpenChange,
  layerId,
}: MapLayerDetailDialogProps) {
  const dbQuery = useApiQuery(
    ['mapLayer', layerId],
    () => mapLayerService.getById(layerId!),
    { enabled: layerId !== null && open, staleTime: 0 },
    false,
    false
  )

  const layer = getLayerDetail(dbQuery.data as ApiResponse<MapLayerDetailData> | undefined)
  const isPublished = !!layer?.geoserver_layer
  const createdAt = layer?.created_at ?? layer?.createdAt
  const updatedAt = layer?.updated_at ?? layer?.updatedAt

  // Auto-detect định dạng nguồn:
  //  1. geometry_type = RASTER → chắc chắn TIFF (coverage).
  //  2. source_url chứa .tif/.tiff → gốc là GeoTIFF, ưu tiên tải TIFF dù metadata
  //     có thể ghi POLYGON (backend đã vectorize để hiển thị, nhưng file gốc
  //     vẫn nằm trên GeoServer dưới dạng coverage store cùng tên).
  //  3. Còn lại → dùng GeoJSON (WFS).
  const isRaster = String(layer?.geometry_type || '').toUpperCase() === 'RASTER'
  const preferTiff = isRaster
  const downloadFormatLabel = preferTiff ? 'ảnh bản đồ' : 'dữ liệu đường nét'
  const canDownload = !!(layer?.id && isPublished)
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    if (!layer?.id) return
    const baseName = layer.code || layer.name_vi || 'layer'
    setDownloading(true)
    try {
      const downloadUrl = await buildMapProxyExportUrl(layer.id, preferTiff ? 'wcs' : 'wfs')
      if (preferTiff) {
        await downloadRasterFile(downloadUrl, baseName)
      } else {
        await downloadGeoJsonFile(downloadUrl, baseName)
      }
      toast.success(`Đã tải xuống ${downloadFormatLabel}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(message || `Không thể tải ${downloadFormatLabel}`)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <div className="shrink-0 border-b px-6 py-5 pr-12">
          <DialogTitle>Chi tiết lớp dữ liệu bản đồ</DialogTitle>
          <DialogDescription className="mt-1">
            Thông tin nghiệp vụ, nguồn dữ liệu và trạng thái công bố của lớp đã chọn
          </DialogDescription>
        </div>

        {dbQuery.isLoading ? (
          <div
            className="text-muted-foreground flex min-h-56 items-center justify-center gap-2 px-6"
            role="status"
          >
            <RefreshCw className="size-4 animate-spin" aria-hidden="true" />
            Đang tải thông tin lớp dữ liệu...
          </div>
        ) : dbQuery.isError ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-destructive" role="alert">
              Không thể tải thông tin lớp dữ liệu.
            </p>
            <Button variant="outline" size="sm" onClick={() => dbQuery.refetch()}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Thử lại
            </Button>
          </div>
        ) : layer ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="mb-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold break-words">
                    {layer.name_vi || layer.name || layer.code}
                  </h3>
                  <div className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
                    <span>Mã lớp</span>
                    <CodeValue>{layer.code}</CodeValue>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <BooleanBadge
                    value={layer.publish_status === 'published'}
                    trueLabel="Đã xuất bản"
                    falseLabel="Bản nháp"
                    tone="success"
                  />
                  <BooleanBadge
                    value={layer.is_public}
                    trueLabel="Công khai"
                    falseLabel="Nội bộ"
                    tone="info"
                  />
                  <BooleanBadge
                    value={layer.is_enable_default}
                    trueLabel="Bật mặc định"
                    falseLabel="Tắt mặc định"
                    tone="warning"
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!canDownload || downloading}
                        onClick={handleDownload}
                        aria-label={
                          canDownload
                            ? preferTiff
                              ? 'Tải ảnh bản đồ'
                              : 'Tải dữ liệu đường nét'
                            : 'Lớp dữ liệu chưa được công bố'
                        }
                      >
                        <Download className="size-4" aria-hidden="true" />
                        {downloading
                          ? `Đang tải ${downloadFormatLabel}…`
                          : `Tải ${downloadFormatLabel}`}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {canDownload
                        ? preferTiff
                          ? 'Tải ảnh bản đồ'
                          : 'Tải dữ liệu đường nét'
                        : 'Lớp dữ liệu chưa được công bố'}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              {layer.description_vi && (
                <p className="text-muted-foreground mt-3 text-sm whitespace-pre-wrap">
                  {layer.description_vi}
                </p>
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Info className="text-primary size-4" aria-hidden="true" />
                    Thông tin nghiệp vụ
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">

                    <DetailField label="Mã lớp">
                      <CodeValue>{layer.code}</CodeValue>
                    </DetailField>
                    <DetailField label="Tên tiếng Việt">{layer.name_vi || '-'}</DetailField>
                    <DetailField label="Tên tiếng Anh">{layer.name_en || '-'}</DetailField>
                    <DetailField label="Mô tả tiếng Việt" wide>
                      <span className="whitespace-pre-wrap">{layer.description_vi || '-'}</span>
                    </DetailField>
                    <DetailField label="Mô tả tiếng Anh" wide>
                      <span className="whitespace-pre-wrap">{layer.description_en || '-'}</span>
                    </DetailField>
                    <DetailField label="Danh mục">
                      {layer.category_name || getMapLayerCategoryLabel(layer.category)}
                    </DetailField>
                    <DetailField label="Loại lớp">
                      {layer.layer_kind
                        ? (LAYER_KIND_LABEL[layer.layer_kind] ?? layer.layer_kind)
                        : '-'}
                    </DetailField>
                    <DetailField label="Năm dữ liệu">{layer.data_year ?? '-'}</DetailField>
                    <DetailField label="Thứ tự hiển thị">{layer.sort_order ?? '-'}</DetailField>
                  </dl>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Database className="text-primary size-4" aria-hidden="true" />
                    Dữ liệu không gian
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                    <DetailField label="Kiểu dữ liệu">
                      <Badge variant="secondary">
                        {String(layer.geometry_type || '').toUpperCase().includes('POINT')
                          ? 'Dữ liệu điểm'
                          : String(layer.geometry_type || '').toUpperCase().includes('LINE')
                            ? 'Dữ liệu đường'
                            : String(layer.geometry_type || '').toUpperCase().includes('POLYGON')
                              ? 'Dữ liệu vùng'
                              : String(layer.geometry_type || '').toUpperCase() === 'RASTER'
                                ? 'Ảnh bản đồ'
                                : 'Chưa xác định'}
                      </Badge>
                    </DetailField>
                    <DetailField label="Hệ tọa độ">
                      {layer.epsg_code || layer.srid ? (
                        <CodeValue>{layer.epsg_code ?? layer.srid}</CodeValue>
                      ) : (
                        '-'
                      )}
                    </DetailField>
                    <DetailField label="Số đối tượng">
                      {formatCount(layer.feature_count)}
                    </DetailField>
                    <DetailField label="Mức thu phóng nhỏ nhất">{layer.min_zoom ?? '-'}</DetailField>
                    <DetailField label="Mức thu phóng lớn nhất">{layer.max_zoom ?? '-'}</DetailField>

                  </dl>
                </CardContent>
              </Card>


              <Card className="lg:col-span-2">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CalendarClock className="text-primary size-4" aria-hidden="true" />
                    Thời gian cập nhật
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-3">
                    <DetailField label="Ngày tạo">
                      {createdAt ? formatDateTime(createdAt) : '-'}
                    </DetailField>
                    <DetailField label="Ngày cập nhật">
                      {updatedAt ? formatDateTime(updatedAt) : '-'}
                    </DetailField>
                    <DetailField label="Cập nhật dữ liệu gần nhất">
                      {layer.last_updated_at ? formatDateTime(layer.last_updated_at) : '-'}
                    </DetailField>
                  </dl>
                </CardContent>
              </Card>

              {Array.isArray((layer as any).permissions) && (layer as any).permissions.length > 0 && (
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ShieldCheck className="text-primary size-4" aria-hidden="true" />
                      Phân quyền truy cập theo vai trò
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b text-xs font-medium text-muted-foreground">
                          <tr>
                            <th className="pb-2">Vai trò</th>
                            <th className="pb-2 text-center">Xem</th>
                            <th className="pb-2 text-center">Xuất dữ liệu</th>
                            <th className="pb-2 text-center">Chỉnh sửa</th>
                            <th className="pb-2 text-center">Xóa</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {(layer as any).permissions.map((p: any) => (
                            <tr key={p.roleCode} className="hover:bg-muted/30">
                              <td className="py-2.5 font-medium">
                                {ROLE_LABEL_MAP[p.roleCode] || 'Vai trò người dùng'}
                              </td>
                              <td className="py-2.5 text-center">
                                <span
                                  className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                                    p.canView
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-slate-100 text-slate-400'
                                  }`}
                                >
                                  {p.canView ? 'Cho phép' : 'Chặn'}
                                </span>
                              </td>
                              <td className="py-2.5 text-center">
                                <span
                                  className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                                    p.canExport
                                      ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                      : 'bg-slate-100 text-slate-400'
                                  }`}
                                >
                                  {p.canExport ? 'Cho phép' : 'Chặn'}
                                </span>
                              </td>
                              <td className="py-2.5 text-center">
                                <span
                                  className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                                    p.canEdit
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                      : 'bg-slate-100 text-slate-400'
                                  }`}
                                >
                                  {p.canEdit ? 'Cho phép' : 'Chặn'}
                                </span>
                              </td>
                              <td className="py-2.5 text-center">
                                <span
                                  className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                                    p.canDelete
                                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                      : 'bg-slate-100 text-slate-400'
                                  }`}
                                >
                                  {p.canDelete ? 'Cho phép' : 'Chặn'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground flex min-h-56 items-center justify-center px-6">
            Không có dữ liệu lớp bản đồ.
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
