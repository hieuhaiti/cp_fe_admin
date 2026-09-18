import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'react-toastify'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Loader2, RefreshCw, AlertTriangle, Trash2, Send, Layers } from 'lucide-react'
import { mapLayerService } from '@/service'
import { formatLifecycleStatus } from '@/lib/uiTerminology'
import type { SatelliteImageMember, LayerCleanupStatus } from '@/types/api'
import {
  republishLayerFormSchema,
  changeCoverageKeyFormSchema,
  type RepublishLayerFormValues,
  type ChangeCoverageKeyFormValues,
} from './sourceImageForms'

function sanitizeLayerCode(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^[^a-z]+/, '')
      .slice(0, 62) || 'raster_layer'
  )
}

// 1. Republish Layer Dialog
export function RepublishLayerDialog({
  image,
  open,
  onOpenChange,
  onSuccess,
}: {
  image: SatelliteImageMember | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<RepublishLayerFormValues>({
    resolver: zodResolver(republishLayerFormSchema),
    defaultValues: {
      code: '',
      nameVi: '',
      category: 'raster',
      srid: 4326,
      minZoom: 0,
      maxZoom: 22,
      isPublic: false,
    },
  })

  useEffect(() => {
    if (image && open) {
      form.reset({
        code: sanitizeLayerCode(image.scene_code || image.title || 'layer'),
        nameVi: image.title || image.scene_code || 'Lớp ảnh bản đồ',
        category: image.thematic_group || 'raster',
        srid: 4326,
        minZoom: 0,
        maxZoom: 22,
        isPublic: false,
      })
    }
  }, [image, open, form])

  const onSubmit = async (values: RepublishLayerFormValues) => {
    if (!image) return
    setIsSubmitting(true)
    try {
      await import('@/service').then((m) =>
        m.remoteSensingService.publishImage(image.id, {
          code: values.code,
          nameVi: values.nameVi,
          category: values.category,
          srid: values.srid,
          minZoom: values.minZoom,
          maxZoom: values.maxZoom,
          isPublic: values.isPublic,
        })
      )
      toast.success('Công bố lớp bản đồ GeoTIFF độc lập thành công!')
      onOpenChange(false)
      onSuccess()
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (error as Error).message ||
        'Không thể công bố lớp dữ liệu'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Layers className="size-5 text-primary" />
            <DialogTitle>Công bố lớp bản đồ độc lập</DialogTitle>
          </div>
          <DialogDescription>
            Khởi tạo lớp bản đồ GeoTIFF từ tệp nguồn sẵn có, không cần tải lại tệp lên máy chủ.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 pt-2">
          <div className="space-y-1">
            <Label htmlFor="republish-name-vi" className="text-xs font-semibold">
              Tên lớp hiển thị <span className="text-destructive">*</span>
            </Label>
            <Input id="republish-name-vi" {...form.register('nameVi')} className="h-9 text-xs" />
            {form.formState.errors.nameVi && (
              <p className="text-[11px] text-destructive">{form.formState.errors.nameVi.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="republish-code" className="text-xs font-semibold">
              Mã lớp (code) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="republish-code"
              {...form.register('code')}
              className="h-9 font-mono text-xs"
              placeholder="vd: lop_phu_campha_2025"
            />
            {form.formState.errors.code ? (
              <p className="text-[11px] text-destructive">{form.formState.errors.code.message}</p>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                Định danh duy nhất của lớp bản đồ. Hãy nhập mã mới nếu mã lớp cũ đã bị xóa.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="republish-category" className="text-xs font-semibold">
                Danh mục <span className="text-destructive">*</span>
              </Label>
              <Input
                id="republish-category"
                {...form.register('category')}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="republish-srid" className="text-xs font-semibold">
                Hệ tọa độ (SRID) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="republish-srid"
                type="number"
                {...form.register('srid', { valueAsNumber: true })}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Hủy
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Send className="mr-1.5 size-4" />}
              Công bố ngay
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// 2. Change Coverage Key Dialog
export function ChangeCoverageKeyDialog({
  image,
  open,
  onOpenChange,
  onSuccess,
}: {
  image: SatelliteImageMember | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<ChangeCoverageKeyFormValues>({
    resolver: zodResolver(changeCoverageKeyFormSchema),
    defaultValues: { coverageKey: '' },
  })

  useEffect(() => {
    if (image && open) {
      form.reset({ coverageKey: image.coverage_key })
    }
  }, [image, open, form])

  const isBlockedByActiveTimeSeries =
    Boolean(image?.layer_id) && Boolean(image?.timeSeriesLayer && !image.timeSeriesLayer.deletedAt)

  const onSubmit = async (values: ChangeCoverageKeyFormValues) => {
    if (!image) return
    setIsSubmitting(true)
    try {
      await import('@/service').then((m) =>
        m.remoteSensingService.updateCoverageKey(image.id, values.coverageKey)
      )
      toast.success('Cập nhật nhóm chuỗi thời gian thành công!')
      onOpenChange(false)
      onSuccess()
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (error as Error).message ||
        'Không thể cập nhật nhóm chuỗi thời gian'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Đổi nhóm chuỗi thời gian</DialogTitle>
          <DialogDescription>
            Gán ảnh vào nhóm chuỗi thời gian khác để cùng tổng hợp thành một chuỗi dữ liệu.
          </DialogDescription>
        </DialogHeader>

        {isBlockedByActiveTimeSeries ? (
          <div className="space-y-3 pt-2">
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="size-4" />
                Ảnh đang thuộc lớp chuỗi thời gian đang hoạt động
              </div>
              <p>
                Lớp chuỗi thời gian "{image?.timeSeriesLayer?.code}" đang sử dụng ảnh này. Để đổi nhóm, bạn cần gỡ hoặc xóa lớp chuỗi thời gian trước.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Đóng
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label htmlFor="change-coverage-key" className="text-xs font-semibold">
                Nhóm chuỗi thời gian <span className="text-destructive">*</span>
              </Label>
              <Input
                id="change-coverage-key"
                {...form.register('coverageKey')}
                className="h-9 font-mono text-xs"
                placeholder="vd: cam_pha_urban_ts"
              />
              {form.formState.errors.coverageKey && (
                <p className="text-[11px] text-destructive">
                  {form.formState.errors.coverageKey.message}
                </p>
              )}
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Hủy
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
                Lưu thay đổi
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

// 3. Cleanup Detail Dialog
export function CleanupDetailDialog({
  layerId,
  open,
  onOpenChange,
  canRetryPerm,
  onSuccess,
}: {
  layerId: number | string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  canRetryPerm: boolean
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [cleanupData, setCleanupData] = useState<LayerCleanupStatus | null>(null)

  useEffect(() => {
    if (layerId && open) {
      setLoading(true)
      mapLayerService
        .getCleanupStatus(layerId)
        .then((res) => setCleanupData(res.data ?? null))
        .catch((err) => {
          toast.error((err as Error).message || 'Không thể lấy thông tin dọn dẹp lớp')
          setCleanupData(null)
        })
        .finally(() => setLoading(false))
    }
  }, [layerId, open])

  const handleRetry = async () => {
    if (!layerId) return
    setRetrying(true)
    try {
      await mapLayerService.retryCleanup(layerId)
      toast.success('Đã gửi yêu cầu thử lại quy trình dọn dẹp lớp!')
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error((err as Error).message || 'Không thể thử lại dọn dẹp')
    } finally {
      setRetrying(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Trạng thái dọn dẹp lớp dữ liệu</DialogTitle>
          <DialogDescription>
            Theo dõi tiến trình giải phóng tài nguyên hệ thống sau khi lớp bản đồ bị xóa.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Đang tải thông tin tiến trình…
          </div>
        ) : cleanupData ? (
          <div className="space-y-3 pt-2 text-xs">
            <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/20 p-3">
              <div>
                <span className="text-muted-foreground block text-[11px]">Mã lớp</span>
                <span className="font-mono font-semibold">{cleanupData.code}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Trạng thái xử lý</span>
                <Badge
                  variant={
                    cleanupData.cleanupStatus === 'complete'
                      ? 'secondary'
                      : cleanupData.cleanupStatus === 'failed'
                        ? 'destructive'
                        : 'outline'
                  }
                  className="mt-0.5 text-[10px]"
                >
                  {formatLifecycleStatus(cleanupData.cleanupStatus)}
                </Badge>
              </div>
            </div>

            {cleanupData.job && (
              <div className="rounded-lg border bg-card p-3 space-y-2">
                <span className="font-semibold block text-foreground">Chi tiết tiến trình nền:</span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-muted-foreground">Số lần thử:</span>{' '}
                    <strong className="font-mono">{cleanupData.job.attempt} / {cleanupData.job.maxAttempts}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Trạng thái tiến trình:</span>{' '}
                    <span className="font-mono font-semibold">{formatLifecycleStatus(cleanupData.job.status)}</span>
                  </div>
                  {cleanupData.job.nextAttemptAt && (
                    <div className="col-span-2 text-muted-foreground">
                      Lần thử tiếp theo: {new Date(cleanupData.job.nextAttemptAt).toLocaleString('vi')}
                    </div>
                  )}
                </div>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Đóng
              </Button>
              {cleanupData.canRetry && canRetryPerm && (
                <Button type="button" size="sm" disabled={retrying} onClick={handleRetry}>
                  {retrying ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <RefreshCw className="mr-1.5 size-4" />}
                  Thử lại dọn dẹp
                </Button>
              )}
            </DialogFooter>
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Không có thông tin tiến trình dọn dẹp cho lớp này.
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// 4. Delete Source Image Dialog
export function DeleteSourceImageDialog({
  image,
  open,
  onOpenChange,
  onSuccess,
}: {
  image: SatelliteImageMember | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const [deleteFiles, setDeleteFiles] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const isStandaloneInUse = Boolean(image?.standaloneLayer && !image.standaloneLayer.deletedAt)
  const isTimeSeriesInUse = Boolean(image?.timeSeriesLayer && !image.timeSeriesLayer.deletedAt)

  const handleDelete = async () => {
    if (!image) return
    setIsDeleting(true)
    try {
      await import('@/service').then((m) =>
        m.remoteSensingService.deleteImage(image.id, image.updated_at, deleteFiles)
      )
      if (deleteFiles) {
        toast.success(`Đã yêu cầu xóa tệp nguồn và bản ghi ảnh #${image.id}`)
      } else {
        toast.success(`Đã xóa bản ghi ảnh #${image.id}`)
      }
      onOpenChange(false)
      onSuccess()
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (error as Error).message ||
        'Không thể xóa ảnh'
      toast.error(message)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <Trash2 className="size-5" />
            <DialogTitle>Xóa ảnh nguồn GeoTIFF</DialogTitle>
          </div>
          <DialogDescription>
            Xác nhận xóa ảnh "{image?.title || image?.scene_code}" (ID: #{image?.id})
          </DialogDescription>
        </DialogHeader>

        {isStandaloneInUse || isTimeSeriesInUse ? (
          <div className="space-y-3 pt-2 text-xs">
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="size-4" />
                Ảnh đang được lớp bản đồ sử dụng
              </div>
              <p>
                Ảnh này đang được liên kết với lớp {isStandaloneInUse ? `độc lập (${image?.standaloneLayer?.code})` : ''}{' '}
                {isTimeSeriesInUse ? `chuỗi thời gian (${image?.timeSeriesLayer?.code})` : ''}. Vui lòng gỡ hoặc xóa các lớp liên quan trước khi xóa ảnh.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Đóng
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 pt-2 text-xs">
            <p className="text-muted-foreground">
              Vui lòng chọn phương thức xóa. Khi tệp vật lý bị xóa, bạn sẽ không thể công bố lại lớp từ ảnh này nữa.
            </p>

            <div className="space-y-2 rounded-lg border p-3">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="delete-mode"
                  className="mt-0.5"
                  checked={!deleteFiles}
                  onChange={() => setDeleteFiles(false)}
                />
                <div>
                  <span className="font-semibold text-foreground block">
                    Chỉ xóa bản ghi thông tin (khuyến nghị)
                  </span>
                  <span className="text-muted-foreground text-[11px] block">
                    Tệp lưu trữ GeoTIFF gốc vẫn được giữ lại an toàn trên hệ thống.
                  </span>
                </div>
              </label>

              <div className="border-t pt-2" />

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="delete-mode"
                  className="mt-0.5 text-destructive"
                  checked={deleteFiles}
                  onChange={() => setDeleteFiles(true)}
                />
                <div>
                  <span className="font-semibold text-destructive block">
                    Xóa bản ghi VÀ yêu cầu xóa tệp lưu trữ GeoTIFF
                  </span>
                  <span className="text-muted-foreground text-[11px] block">
                    Hệ thống sẽ kiểm tra các liên kết khác trước khi dọn dẹp tệp vật lý. Thao tác này không thể hoàn tác!
                  </span>
                </div>
              </label>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isDeleting}
              >
                Hủy
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={isDeleting}
                onClick={handleDelete}
              >
                {isDeleting ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-1.5 size-4" />
                )}
                Xác nhận xóa
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
