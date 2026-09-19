import { formatDateTime } from '@/lib/date'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Layers, Clock, ShieldCheck, Copy } from 'lucide-react'
import { toast } from 'react-toastify'
import type { TimeSeriesCatalogLayer } from '@/types/api'

interface TimeSeriesDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  layer: TimeSeriesCatalogLayer | null
}

export default function TimeSeriesDetailDialog({
  open,
  onOpenChange,
  layer,
}: TimeSeriesDetailDialogProps) {
  const values = layer?.timeSeries?.values ?? []
  const members = layer?.timeSeries?.members ?? []
  const defaultTime = layer?.timeSeries?.defaultTime

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-7xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
              <Layers className="size-4" />
            </div>
            <DialogTitle>Chi tiết lớp dữ liệu chuỗi thời gian</DialogTitle>
          </div>
          <DialogDescription>
            Thông tin chi tiết lớp dữ liệu và các mốc thời gian hiện có.
          </DialogDescription>
        </DialogHeader>

        {layer && (
          <div className="space-y-5">
            {/* Thuộc tính lớp */}
            <div className="grid grid-cols-2 gap-3.5 rounded-lg border bg-card p-4 text-sm md:grid-cols-4">
              <div>
                <span className="text-muted-foreground block text-xs">Mã lớp:</span>
                <span className="font-mono font-semibold">{layer.code}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">Mã nhóm chuỗi:</span>
                {layer.timeSeries?.coverageKey ? (
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span className="font-mono text-xs font-semibold text-primary">
                      {layer.timeSeries.coverageKey}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-5 text-muted-foreground hover:text-foreground"
                          aria-label={`Sao chép mã nhóm ${layer.timeSeries.coverageKey}`}
                          onClick={() => {
                            navigator.clipboard.writeText(layer.timeSeries.coverageKey || '')
                            toast.success(`Đã sao chép mã nhóm: ${layer.timeSeries.coverageKey}`)
                          }}
                        >
                          <Copy className="size-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Sao chép mã nhóm</TooltipContent>
                    </Tooltip>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-xs">-</span>
                )}
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground block text-xs">Tên hiển thị:</span>
                <span className="font-medium text-foreground">{layer.nameVi}</span>
              </div>

              <div>
                <span className="text-muted-foreground block text-xs">Nhóm dữ liệu:</span>
                <span>{layer.categoryName || layer.category || '-'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">Số mốc thời gian:</span>
                <Badge variant="secondary" className="font-medium">
                  <Clock className="mr-1 size-3" /> {values.length} mốc
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">Hệ tọa độ:</span>
                <span className="font-mono text-xs">{layer.srid || '-'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">Quyền truy cập:</span>
                <Badge variant={layer.isPublic ? 'default' : 'outline'}>
                  <ShieldCheck className="mr-1 size-3" /> {layer.isPublic ? 'Công khai' : 'Nội bộ'}
                </Badge>
              </div>

              <div>
                <span className="text-muted-foreground block text-xs">Mức thu phóng:</span>
                <span className="text-xs">{layer.minZoom ?? 0} - {layer.maxZoom ?? 22}</span>
              </div>
            </div>

            {/* Bảng danh sách mốc thời gian */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold flex items-center gap-1.5">
                  <Clock className="size-4 text-primary" />
                  Danh mục các mốc thời gian ({values.length})
                </h4>
                {defaultTime && (
                  <span className="text-xs text-muted-foreground">
                    Mặc định (mốc thu nhận mới nhất): <strong>{formatDateTime(defaultTime)}</strong>
                  </span>
                )}
              </div>
              <div className="rounded-md border max-h-[52vh] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-xs">
                    <TableRow>
                      <TableHead className="w-12">STT</TableHead>
                      <TableHead>Thời điểm thu nhận</TableHead>

                      <TableHead>Mã ảnh</TableHead>
                      <TableHead>Mã cảnh</TableHead>
                      <TableHead className="text-right">Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {values.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-6 text-center text-xs text-muted-foreground">
                          Chưa có mốc thời gian nào.
                        </TableCell>
                      </TableRow>
                    ) : (
                      values.map((value, index) => {
                        const member = members.find(
                          (item) =>
                            item.acquiredAt === value ||
                            (item.acquiredAt &&
                              new Date(item.acquiredAt).getTime() === new Date(value).getTime())
                        )
                        const isDefault = value === defaultTime
                        return (
                          <TableRow key={value}>
                            <TableCell className="text-xs text-muted-foreground">{index + 1}</TableCell>
                            <TableCell className="font-medium text-xs">
                              {formatDateTime(value)}
                            </TableCell>

                            <TableCell className="font-mono text-xs">{member?.imageId ?? '-'}</TableCell>
                            <TableCell className="text-xs">{member?.sceneCode ?? '-'}</TableCell>
                            <TableCell className="text-right">
                              {isDefault ? (
                                <Badge variant="default" className="text-[10px]">Mặc định</Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">Mốc chuỗi</span>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
