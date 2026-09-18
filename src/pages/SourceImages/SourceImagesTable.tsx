import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TruncatedBadge } from '@/components/common/TruncatedBadge'
import { formatDateTime } from '@/lib/date'
function formatFileSize(bytes?: number | string | null): string {
  if (!bytes) return '—'
  const num = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes
  if (isNaN(num)) return '—'
  if (num < 1024) return `${num} B`
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`
  if (num < 1024 * 1024 * 1024) return `${(num / (1024 * 1024)).toFixed(1)} MB`
  return `${(num / (1024 * 1024 * 1024)).toFixed(2)} GB`
}
import { Layers, FolderInput, Trash2, ShieldAlert, Clock, AlertCircle } from 'lucide-react'
import type { SatelliteImageMember, LayerLifecycleInfo } from '@/types/api'

function LayerStatusBadge({
  layer,
  onViewCleanup,
}: {
  layer?: LayerLifecycleInfo | null
  type?: 'standalone' | 'timeSeries'
  onViewCleanup?: (layerId: number | string) => void
}) {
  if (!layer) {
    return <span className="text-muted-foreground text-xs">—</span>
  }

  const isDeleted = Boolean(layer.deletedAt)

  if (!isDeleted) {
    return (
      <TruncatedBadge
        variant="default"
        maxWidthClass="max-w-36"
        className="gap-1 font-mono text-[10px] bg-emerald-600 hover:bg-emerald-700"
        label={layer.code}
      >
        <span className="size-1.5 shrink-0 rounded-full bg-white animate-pulse" />
        <span className="truncate">{layer.code}</span>
      </TruncatedBadge>
    )
  }

  const cleanup = layer.cleanupStatus || 'none'
  if (cleanup === 'complete') {
    return (
      <TruncatedBadge
        variant="secondary"
        maxWidthClass="max-w-36"
        className="font-mono text-[10px]"
        label={`Đã dọn: ${layer.code}`}
      >
        Đã dọn: {layer.code}
      </TruncatedBadge>
    )
  }

  if (['queued', 'running'].includes(cleanup)) {
    return (
      <button
        type="button"
        onClick={() => onViewCleanup?.(layer.id)}
        className="inline-flex max-w-36 items-center gap-1 truncate rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 font-mono text-[10px] font-semibold border border-amber-500/30 hover:bg-amber-500/25 transition-colors"
        title={`Đang dọn (${layer.code})`}
      >
        <Clock className="size-2.5 shrink-0 animate-spin" />
        <span className="truncate">Đang dọn ({layer.code})</span>
      </button>
    )
  }

  if (cleanup === 'failed') {
    return (
      <button
        type="button"
        onClick={() => onViewCleanup?.(layer.id)}
        className="inline-flex max-w-36 items-center gap-1 truncate rounded bg-destructive/15 text-destructive px-1.5 py-0.5 font-mono text-[10px] font-semibold border border-destructive/30 hover:bg-destructive/25 transition-colors"
        title={`Dọn lỗi (${layer.code})`}
      >
        <AlertCircle className="size-2.5 shrink-0" />
        <span className="truncate">Dọn lỗi ({layer.code})</span>
      </button>
    )
  }

  return (
    <TruncatedBadge
      variant="outline"
      maxWidthClass="max-w-36"
      className="font-mono text-[10px]"
      label={`Đã xóa: ${layer.code}`}
    >
      Đã xóa: {layer.code}
    </TruncatedBadge>
  )
}

export function SourceImagesTable({
  items,
  loading,
  canPublish,
  canCreate,
  canDelete,
  onRepublish,
  onChangeGroup,
  onViewCleanup,
  onDelete,
}: {
  items: SatelliteImageMember[]
  loading: boolean
  canPublish: boolean
  canCreate: boolean
  canDelete: boolean
  onRepublish: (image: SatelliteImageMember) => void
  onChangeGroup: (image: SatelliteImageMember) => void
  onViewCleanup: (layerId: number | string) => void
  onDelete: (image: SatelliteImageMember) => void
}) {
  if (loading && items.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Đang tải danh sách ảnh nguồn…
      </div>
    )
  }

  if (!loading && items.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <Layers className="size-8 opacity-40" />
        <p>Không có ảnh nguồn nào khớp với bộ lọc tìm kiếm.</p>
      </div>
    )
  }

  return (
    <div className="relative w-full overflow-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-[28%] min-w-[14rem]">Thông tin ảnh & Tệp</TableHead>
            <TableHead className="w-[18%] min-w-[10rem]">Mốc thu nhận & Nền tảng</TableHead>
            <TableHead className="w-[16%] min-w-[9rem]">Nhóm chuỗi thời gian</TableHead>
            <TableHead className="w-[14%] min-w-[8rem]">Lớp độc lập</TableHead>
            <TableHead className="w-[14%] min-w-[8rem]">Lớp chuỗi thời gian</TableHead>
            <TableHead className="w-[10%] min-w-[7rem] text-right">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((image) => {
            const hasCleanupIssue =
              image.standaloneLayer?.cleanupStatus === 'failed' ||
              image.timeSeriesLayer?.cleanupStatus === 'failed'

            return (
              <TableRow key={image.id} className="hover:bg-muted/30">
                {/* 1. Ảnh & Tệp */}
                <TableCell>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-semibold text-foreground">
                        #{image.id}
                      </span>
                      <span className="font-semibold text-xs text-foreground truncate max-w-[14rem]" title={image.title || image.scene_code}>
                        {image.title || image.scene_code}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground truncate max-w-[16rem]" title={image.scene_code}>
                      {image.scene_code}
                    </div>
                    {image.original_name && (
                      <div className="text-[10px] text-muted-foreground truncate max-w-[16rem]" title={image.original_name}>
                        Tệp: {image.original_name} · {formatFileSize(image.size_bytes)}
                      </div>
                    )}
                  </div>
                </TableCell>

                {/* 2. Mốc thu nhận */}
                <TableCell>
                  <div className="space-y-1">
                    <span className="text-xs text-foreground block font-medium">
                      {formatDateTime(image.acquired_at)}
                    </span>
                    <Badge variant="outline" className="text-[10px] uppercase font-mono">
                      {image.platform}
                    </Badge>
                  </div>
                </TableCell>

                {/* 3. Khóa nhóm chuỗi */}
                <TableCell>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-xs font-semibold text-foreground truncate max-w-[10rem]">
                      {image.coverage_key}
                    </span>
                  </div>
                  {image.thematic_group && (
                    <span className="text-[10px] text-muted-foreground block truncate">
                      Chủ đề: {image.thematic_group}
                    </span>
                  )}
                </TableCell>

                {/* 4. Lớp độc lập */}
                <TableCell>
                  <LayerStatusBadge
                    layer={image.standaloneLayer}
                    type="standalone"
                    onViewCleanup={onViewCleanup}
                  />
                </TableCell>

                {/* 5. Lớp chuỗi thời gian */}
                <TableCell>
                  <LayerStatusBadge
                    layer={image.timeSeriesLayer}
                    type="timeSeries"
                    onViewCleanup={onViewCleanup}
                  />
                </TableCell>

                {/* 6. Thao tác */}
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {canPublish && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="text-primary hover:bg-primary/10 hover:text-primary"
                        tooltip="Công bố thành lớp bản đồ độc lập mới"
                        aria-label={`Công bố lại ảnh #${image.id}`}
                        onClick={() => onRepublish(image)}
                      >
                        <Layers className="size-3.5" />
                      </Button>
                    )}

                    {canCreate && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="text-muted-foreground hover:text-foreground"
                        tooltip="Đổi nhóm chuỗi thời gian"
                        aria-label={`Đổi nhóm ảnh #${image.id}`}
                        onClick={() => onChangeGroup(image)}
                      >
                        <FolderInput className="size-3.5" />
                      </Button>
                    )}

                    {hasCleanupIssue && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="text-destructive hover:bg-destructive/10"
                        tooltip="Xem chi tiết sự cố dọn dẹp lớp"
                        aria-label={`Xem dọn dẹp ảnh #${image.id}`}
                        onClick={() => {
                          const layerId =
                            image.standaloneLayer?.cleanupStatus === 'failed'
                              ? image.standaloneLayer.id
                              : image.timeSeriesLayer?.id
                          if (layerId) onViewCleanup(layerId)
                        }}
                      >
                        <ShieldAlert className="size-3.5" />
                      </Button>
                    )}

                    {canDelete && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        tooltip="Xóa ảnh nguồn"
                        aria-label={`Xóa ảnh #${image.id}`}
                        onClick={() => onDelete(image)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
