import { useState } from 'react'
import { toast } from 'react-toastify'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { mapLayerService } from '@/service'
import type { TimeSeriesCatalogLayer } from '@/types/api'

interface TimeSeriesDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  layer: TimeSeriesCatalogLayer | null
  onSuccess: () => void
}

export default function TimeSeriesDeleteDialog({
  open,
  onOpenChange,
  layer,
  onSuccess,
}: TimeSeriesDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!layer?.id) {
      toast.error('Lớp dữ liệu chuỗi thời gian không có mã định danh để xóa')
      return
    }

    setIsDeleting(true)
    try {
      const detail = await mapLayerService.getById(layer.id)
      const expectedUpdatedAt = detail.data?.updatedAt ?? detail.data?.updated_at
      if (!expectedUpdatedAt) {
        throw new Error('Không lấy được thời điểm cập nhật mới nhất của lớp bản đồ.')
      }

      await mapLayerService.delete(layer.id, expectedUpdatedAt)

      toast.success('Đã xóa lớp dữ liệu chuỗi thời gian thành công!')
      onOpenChange(false)
      onSuccess()
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error)?.message ||
        'Có lỗi xảy ra khi xóa lớp dữ liệu'
      toast.error(errorMsg)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-7xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5" />
            <DialogTitle>Xóa lớp dữ liệu chuỗi thời gian</DialogTitle>
          </div>
          <DialogDescription className="pt-2 text-sm">
            Bạn có chắc chắn muốn xóa lớp dữ liệu chuỗi thời gian{' '}
            <strong className="text-foreground">{layer?.nameVi || layer?.code}</strong>{' '}
            (Mã lớp: <code className="font-mono">{layer?.code}</code>, ID: <code className="font-mono">{layer?.id}</code>)?
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive lg:grid-cols-2">
          <div className="space-y-1.5">
            <p className="font-semibold">Hệ quả trên lớp dữ liệu theo thời gian</p>
            <p>• Lớp dữ liệu sẽ được gỡ khỏi hệ thống bản đồ.</p>
            <p>• Lớp sẽ ngừng hiển thị trên web và ứng dụng di động.</p>
          </div>
          <div className="space-y-1.5">
            <p className="font-semibold">Dữ liệu ảnh nguồn</p>
            <p>• Các ảnh gốc trong Kho ảnh viễn thám vẫn được giữ nguyên.</p>
            <p>• Mã lớp <code>{layer?.code}</code> đã dùng không thể tái sử dụng; nếu tổng hợp lại cần một mã lớp mới.</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Hủy
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              'Đang xóa...'
            ) : (
              <span className="flex items-center gap-1.5">
                <Trash2 className="size-4" />
                Xác nhận xóa
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
