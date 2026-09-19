import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'react-toastify'
import { Pen, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import CategorySelect from '@/components/common/CategorySelect'
import { getMapLayerCategoryLabel, toCategorySlug } from '@/constant/mapLayerConstant'
import { mapLayerService } from '@/service'
import type { TimeSeriesCatalogLayer } from '@/types/api'
import {
  editTimeSeriesLayerFormSchema,
  type EditTimeSeriesLayerFormInput,
  type EditTimeSeriesLayerFormValues,
} from './timeSeriesSchema'

interface TimeSeriesEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  layer: TimeSeriesCatalogLayer | null
  onSuccess: () => void
}

export default function TimeSeriesEditDialog({
  open,
  onOpenChange,
  layer,
  onSuccess,
}: TimeSeriesEditDialogProps) {
  const form = useForm<
    EditTimeSeriesLayerFormInput,
    unknown,
    EditTimeSeriesLayerFormValues
  >({
    resolver: zodResolver(editTimeSeriesLayerFormSchema),
    defaultValues: {
      nameVi: '',
      category: 'remote_sensing',
      categoryName: 'Ảnh viễn thám',
      minZoom: 0,
      maxZoom: 22,
      isPublic: false,
    },
  })

  useEffect(() => {
    if (layer) {
      form.reset({
        nameVi: layer.nameVi,
        category: layer.category || 'remote_sensing',
        categoryName: layer.categoryName || getMapLayerCategoryLabel(layer.category),
        minZoom: layer.minZoom ?? 0,
        maxZoom: layer.maxZoom ?? 22,
        isPublic: Boolean(layer.isPublic),
      })
    }
  }, [layer, form])

  const onSubmit = async (values: EditTimeSeriesLayerFormValues) => {
    if (!layer?.id) {
      toast.error('Lớp dữ liệu chuỗi thời gian không có mã định danh để chỉnh sửa')
      return
    }

    const finalCategory = (values.category === 'other' || !values.category)
      ? (toCategorySlug(values.categoryName || '') || 'other')
      : values.category

    try {
      const detail = await mapLayerService.getById(layer.id)
      const expectedUpdatedAt = detail.data?.updatedAt ?? detail.data?.updated_at
      if (!expectedUpdatedAt) {
        throw new Error('Không lấy được thời điểm cập nhật mới nhất của lớp bản đồ.')
      }

      await mapLayerService.update(layer.id, {
        nameVi: values.nameVi,
        category: finalCategory,
        categoryName: values.categoryName?.trim() || getMapLayerCategoryLabel(finalCategory),
        minZoom: values.minZoom,
        maxZoom: values.maxZoom,
        isPublic: values.isPublic,
        expectedUpdatedAt,
      })

      toast.success('Cập nhật thông tin lớp dữ liệu chuỗi thời gian thành công!')
      onOpenChange(false)
      onSuccess()
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error)?.message ||
        'Có lỗi xảy ra khi cập nhật'
      toast.error(errorMsg)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-7xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
              <Pen className="size-4" />
            </div>
            <DialogTitle>Chỉnh sửa lớp dữ liệu chuỗi thời gian</DialogTitle>
          </div>
          <DialogDescription>
            Cập nhật tên hiển thị, nhóm dữ liệu và cấu hình hiển thị của lớp bản đồ.
          </DialogDescription>
        </DialogHeader>

        {/* Note chỉ dẫn Admin */}
        <div className="bg-muted/50 border-border/80 flex items-start gap-2.5 rounded-lg border p-3 text-xs text-muted-foreground">
          <Info className="text-primary mt-0.5 size-4 shrink-0" />
          <div className="space-y-0.5 leading-relaxed">
            <p className="font-semibold text-foreground">Ghi chú chỉnh sửa:</p>
            <p>• Mã lớp (<code>{layer?.code}</code>) được giữ nguyên.</p>
            <p>• Việc đổi nhóm chỉ thay đổi cách phân loại hiển thị, không di chuyển ảnh sang chuỗi khác.</p>
            <p>• Bạn có thể đổi tên hiển thị, mức thu phóng và quyền công khai.</p>
          </div>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-ts-nameVi">
              Tên hiển thị lớp <span className="text-destructive">*</span>
            </Label>
            <Input id="edit-ts-nameVi" {...form.register('nameVi')} />
            {form.formState.errors.nameVi && (
              <p className="text-destructive text-xs">{form.formState.errors.nameVi.message}</p>
            )}
          </div>

          <CategorySelect
            category={form.watch('category')}
            categoryName={form.watch('categoryName')}
            onCategoryChange={(val) => form.setValue('category', val, { shouldValidate: true })}
            onCategoryNameChange={(val) => form.setValue('categoryName', val, { shouldValidate: true })}
            label="Nhóm dữ liệu"
            required
            id="edit-ts-category"
            className="space-y-1.5"
            error={form.formState.errors.category?.message}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-ts-minZoom">Mức thu phóng nhỏ nhất</Label>
              <Input
                id="edit-ts-minZoom"
                type="number"
                min={0}
                max={24}
                {...form.register('minZoom', {
                  setValueAs: (value) => (value === '' ? undefined : Number(value)),
                })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-ts-maxZoom">Mức thu phóng lớn nhất</Label>
              <Input
                id="edit-ts-maxZoom"
                type="number"
                min={0}
                max={24}
                {...form.register('maxZoom', {
                  setValueAs: (value) => (value === '' ? undefined : Number(value)),
                })}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 lg:col-span-2">
            <Checkbox
              id="edit-ts-isPublic"
              checked={form.watch('isPublic')}
              onCheckedChange={(checked) => form.setValue('isPublic', Boolean(checked))}
            />
            <Label htmlFor="edit-ts-isPublic" className="cursor-pointer text-sm font-normal">
              Công khai cho người dân và khách truy cập (Không yêu cầu vé xem)
            </Label>
          </div>

          <DialogFooter className="lg:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
