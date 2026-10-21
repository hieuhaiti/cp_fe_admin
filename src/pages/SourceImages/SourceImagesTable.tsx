import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { StatusDotBadge } from '@/components/common/StatusDotBadge'
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
import { Layers, FolderInput, Trash2, ShieldAlert } from 'lucide-react'
import type { SatelliteImageMember, LayerLifecycleInfo } from '@/types/api'

function LayerLifecycleCell({
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
    return <StatusDotBadge label={`Đang hoạt động: ${layer.code}`} tone="success" className="max-w-36" />
  }

  const cleanup = layer.cleanupStatus || 'none'
  if (cleanup === 'complete') {
    return <StatusDotBadge label={`Đã dọn lớp: ${layer.code}`} tone="neutral" className="max-w-36" />
  }

  if (['queued', 'running'].includes(cleanup)) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onViewCleanup?.(layer.id)}
        className="min-h-7 h-auto max-w-36 p-0"
        aria-label={`Đang dọn (${layer.code})`}
      >
        <StatusDotBadge label={`Đang dọn (${layer.code})`} tone="warning" tooltip={false} />
      </Button>
    )
  }

  if (cleanup === 'failed') {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onViewCleanup?.(layer.id)}
        className="min-h-7 h-auto max-w-36 p-0"
        aria-label={`Dọn dẹp thất bại (${layer.code})`}
      >
        <StatusDotBadge label={`Dọn dẹp thất bại (${layer.code})`} tone="destructive" tooltip={false} />
      </Button>
    )
  }

  return <StatusDotBadge label={`Đã xóa: ${layer.code}`} tone="neutral" className="max-w-36" />
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
                  <LayerLifecycleCell
                    layer={image.standaloneLayer}
                    type="standalone"
                    onViewCleanup={onViewCleanup}
                  />
                </TableCell>

                {/* 5. Lớp chuỗi thời gian */}
                <TableCell>
                  <LayerLifecycleCell
                    layer={image.timeSeriesLayer}
                    type="timeSeries"
                    onViewCleanup={onViewCleanup}
                  />
                </TableCell>

                {/* 6. Thao tác */}
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {canPublish && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="text-primary hover:bg-primary/10 hover:text-primary"
                            aria-label={`Công bố lại ảnh #${image.id}`}
                            onClick={() => onRepublish(image)}
                          >
                            <Layers className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Công bố thành lớp bản đồ độc lập mới</TooltipContent>
                      </Tooltip>
                    )}

                    {canCreate && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="text-muted-foreground hover:text-foreground"
                            aria-label={`Đổi nhóm ảnh #${image.id}`}
                            onClick={() => onChangeGroup(image)}
                          >
                            <FolderInput className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Đổi nhóm chuỗi thời gian</TooltipContent>
                      </Tooltip>
                    )}

                    {hasCleanupIssue && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="text-destructive hover:bg-destructive/10"
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
                        </TooltipTrigger>
                        <TooltipContent side="top">Xem chi tiết sự cố dọn dẹp lớp</TooltipContent>
                      </Tooltip>
                    )}

                    {canDelete && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`Xóa ảnh #${image.id}`}
                            onClick={() => onDelete(image)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Xóa ảnh nguồn</TooltipContent>
                      </Tooltip>
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
