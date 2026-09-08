import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FileImage, FileText, Save } from 'lucide-react'
import { toast } from 'react-toastify'
import { mapImageService, useApiQuery } from '@/service'
import type { ApiResponse, PdfMap, UpdatePdfMapBody } from '@/types/api'
import { isPdf } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemMetadata,
  FileUploadItemPreview,
  FileUploadList,
  FileUploadTrigger,
} from '@/components/ui/file-upload'

const pdfMapSchema = z.object({
  title: z.string().trim().min(2, 'Tiêu đề phải có ít nhất 2 ký tự').max(300),
  description: z.string().trim().max(5000).optional().or(z.literal('')),
  mapYear: z
    .string()
    .trim()
    .refine((v) => /^\d+$/.test(v) && Number(v) >= 1900 && Number(v) <= 2200, {
      message: 'Năm phải từ 1900 đến 2200',
    }),
  scaleLabel: z.string().trim().min(1, 'Vui lòng nhập tỉ lệ bản đồ').max(100),
  preparingAgency: z.string().trim().min(1, 'Cơ quan lập bản đồ là bắt buộc').max(300),
  isPublic: z.boolean(),
})

type PdfMapFormValues = z.infer<typeof pdfMapSchema>

interface MapImageFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mapImageId: number | null
  onSubmit: (data: FormData | UpdatePdfMapBody) => void
  isLoading?: boolean
}

const ACCEPTED_MIME = ['application/pdf']
const MAX_FILE_SIZE = 20 * 1024 * 1024

function toFormValues(pdfMap: PdfMap | null): PdfMapFormValues {
  return {
    title: pdfMap?.translations?.vi?.title ?? pdfMap?.title ?? '',
    description: pdfMap?.translations?.vi?.description ?? pdfMap?.description ?? '',
    mapYear: pdfMap?.map_year != null ? String(pdfMap.map_year) : pdfMap?.mapYear != null ? String(pdfMap.mapYear) : '',
    scaleLabel: pdfMap?.scale_label ?? pdfMap?.scaleLabel ?? '',
    preparingAgency: pdfMap?.preparing_agency ?? pdfMap?.preparingAgency ?? '',
    isPublic: (pdfMap?.visibility ?? 'public') === 'public',
  }
}

const DEFAULT_VALUES: PdfMapFormValues = {
  title: '',
  description: '',
  mapYear: '',
  scaleLabel: '',
  preparingAgency: '',
  isPublic: true,
}

export default function MapImageFormDialog({
  open,
  onOpenChange,
  mapImageId,
  onSubmit,
  isLoading = false,
}: MapImageFormDialogProps) {
  const dbQuery = useApiQuery(
    ['mapImage', mapImageId],
    () => mapImageService.getById(mapImageId!),
    { enabled: !!mapImageId && open, staleTime: 0 },
    false,
    false
  )
  const pdfMap = (() => {
    const d = (dbQuery.data as ApiResponse<any>)?.data
    return (d ? (d.pdfMap ?? d.mapImage ?? d) : null) as PdfMap | null
  })()
  const isEdit = !!mapImageId
  const detailLoading = isEdit && dbQuery.isLoading

  const [pdfFiles, setPdfFiles] = useState<File[]>([])

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PdfMapFormValues>({
    resolver: zodResolver(pdfMapSchema),
    defaultValues: DEFAULT_VALUES,
  })

  const originalValues = useMemo(() => toFormValues(pdfMap), [pdfMap])

  useEffect(() => {
    if (!open) return
    if (isEdit && pdfMap) reset(toFormValues(pdfMap))
    else if (!isEdit) reset(DEFAULT_VALUES)
    setPdfFiles([])
  }, [open, isEdit, pdfMap, reset])

  const values = watch()
  const changedFields = useMemo(() => {
    if (!isEdit) return new Set<keyof PdfMapFormValues>()
    const changed = new Set<keyof PdfMapFormValues>()
    ;(Object.keys(DEFAULT_VALUES) as Array<keyof PdfMapFormValues>).forEach((key) => {
      if ((values[key] ?? '') !== (originalValues[key] ?? '')) changed.add(key)
    })
    return changed
  }, [isEdit, values, originalValues])

  const changedCount = changedFields.size
  const submitDisabled = isLoading || detailLoading || (isEdit && changedCount === 0)

  const onPdfValidate = useCallback((file: File): string | null => {
    if (!ACCEPTED_MIME.includes(file.type)) return 'Chỉ chấp nhận tệp PDF'
    if (file.size > MAX_FILE_SIZE) return 'Kích thước file không được quá 20MB'
    return null
  }, [])

  const onPdfReject = useCallback((file: File, message: string) => {
    const short = file.name.length > 20 ? `${file.name.slice(0, 20)}...` : file.name
    toast.error(`${message}: "${short}"`)
  }, [])

  const buildUpdatePayload = (data: PdfMapFormValues): UpdatePdfMapBody => {
    const payload: UpdatePdfMapBody = {
      expectedUpdatedAt: pdfMap?.updatedAt ?? pdfMap?.updated_at ?? '',
    }
    if (changedFields.has('title')) payload.title = data.title.trim()
    if (changedFields.has('description')) payload.description = data.description?.trim() || ''
    if (changedFields.has('mapYear')) payload.mapYear = Number(data.mapYear)
    if (changedFields.has('scaleLabel')) payload.scaleLabel = data.scaleLabel.trim()
    if (changedFields.has('preparingAgency')) payload.preparingAgency = data.preparingAgency.trim()
    if (changedFields.has('isPublic')) payload.visibility = data.isPublic ? 'public' : 'internal'
    return payload
  }

  const buildCreateFormData = (data: PdfMapFormValues): FormData => {
    const fd = new FormData()
    fd.append('title', data.title.trim())
    if (data.description?.trim()) fd.append('description', data.description.trim())
    fd.append('mapYear', data.mapYear)
    fd.append('scaleLabel', data.scaleLabel.trim())
    fd.append('preparingAgency', data.preparingAgency.trim())
    fd.append('visibility', data.isPublic ? 'public' : 'internal')
    if (pdfFiles[0]) fd.append('file', pdfFiles[0])
    return fd
  }

  const handleFormSubmit = (data: PdfMapFormValues) => {
    if (isEdit) {
      if (changedCount === 0) {
        toast.info('Chưa có thay đổi nào để lưu')
        return
      }
      onSubmit(buildUpdatePayload(data))
      return
    }
    if (pdfFiles.length === 0) {
      toast.error('Vui lòng chọn tệp PDF bản đồ')
      return
    }
    onSubmit(buildCreateFormData(data))
  }

  const existingFileName = pdfMap?.original_name || pdfMap?.fileName || ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <div className="shrink-0 border-b px-6 py-5 pr-12">
          <DialogTitle>{isEdit ? 'Chỉnh sửa bản đồ PDF' : 'Thêm bản đồ PDF mới'}</DialogTitle>
          <DialogDescription className="mt-1">
            {isEdit
              ? 'Cập nhật thông tin bản đồ PDF. Các trường không đổi sẽ không được gửi lên.'
              : 'Điền đầy đủ thông tin và tải lên tệp PDF bản đồ.'}
          </DialogDescription>
        </div>

        {detailLoading ? (
          <div className="text-muted-foreground flex min-h-60 items-center justify-center px-6">
            Đang tải dữ liệu...
          </div>
        ) : (
          <form
            onSubmit={handleSubmit(handleFormSubmit)}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              {isEdit && existingFileName && (
                <div className="space-y-2">
                  <Label>Tệp hiện tại</Label>
                  <div className="bg-muted/40 flex min-h-24 items-center gap-3 rounded-md border p-4">
                    {isPdf(existingFileName) ? (
                      <FileText className="text-primary size-8 shrink-0" />
                    ) : (
                      <FileImage className="text-primary size-8 shrink-0" />
                    )}
                    <span className="text-sm font-medium truncate">{existingFileName}</span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Tệp bản đồ hiện không thể thay đổi từ đây. Chỉ có thể cập nhật thông tin mô tả.
                  </p>
                </div>
              )}

              {!isEdit && (
                <div className="space-y-2">
                  <Label>
                    Tệp PDF bản đồ <span className="text-destructive">*</span>
                  </Label>
                  <FileUpload
                    value={pdfFiles}
                    onValueChange={setPdfFiles}
                    onFileValidate={onPdfValidate}
                    onFileReject={onPdfReject}
                    accept=".pdf,application/pdf"
                    maxFiles={1}
                    maxSize={MAX_FILE_SIZE}
                  >
                    <FileUploadDropzone className="border-dashed">
                      <div className="flex flex-col items-center gap-1 text-center">
                        <FileText className="text-muted-foreground size-6" />
                        <p className="text-sm font-medium">Kéo thả file PDF vào đây</p>
                        <FileUploadTrigger asChild>
                          <Button type="button" variant="outline" size="sm">
                            Chọn file
                          </Button>
                        </FileUploadTrigger>
                        <p className="text-muted-foreground text-xs">Chỉ nhận PDF · tối đa 20MB</p>
                      </div>
                    </FileUploadDropzone>
                    <FileUploadList>
                      {pdfFiles.map((file) => (
                        <FileUploadItem key={file.name} value={file}>
                          <FileUploadItemPreview />
                          <FileUploadItemMetadata />
                          <FileUploadItemDelete asChild>
                            <Button type="button" variant="ghost" size="sm">
                              Xóa
                            </Button>
                          </FileUploadItemDelete>
                        </FileUploadItem>
                      ))}
                    </FileUploadList>
                  </FileUpload>
                </div>
              )}

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="title">
                  Tiêu đề <span className="text-destructive">*</span>
                </Label>
                <Input id="title" {...register('title')} placeholder="Bản đồ thoát nước..." />
                {errors.title && <p className="text-destructive text-xs">{errors.title.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Mô tả</Label>
                <Textarea
                  id="description"
                  rows={3}
                  {...register('description')}
                  placeholder="Nội dung mô tả bản đồ"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="mapYear">
                    Năm <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="mapYear"
                    type="number"
                    min={1900}
                    max={2200}
                    {...register('mapYear')}
                    placeholder="2026"
                  />
                  {errors.mapYear && (
                    <p className="text-destructive text-xs">{errors.mapYear.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scaleLabel">
                    Tỉ lệ <span className="text-destructive">*</span>
                  </Label>
                  <Input id="scaleLabel" {...register('scaleLabel')} placeholder="1:25.000" />
                  {errors.scaleLabel && (
                    <p className="text-destructive text-xs">{errors.scaleLabel.message}</p>
                  )}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="preparingAgency">
                    Cơ quan lập bản đồ <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="preparingAgency"
                    {...register('preparingAgency')}
                    placeholder="UBND thành phố Cẩm Phả"
                  />
                  {errors.preparingAgency && (
                    <p className="text-destructive text-xs">{errors.preparingAgency.message}</p>
                  )}
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={watch('isPublic')}
                  onCheckedChange={(checked) =>
                    setValue('isPublic', checked === true, { shouldDirty: true })
                  }
                />
                Công khai trên cổng thông tin
              </label>
            </div>

            <div className="flex shrink-0 flex-col-reverse items-stretch justify-between gap-3 border-t px-6 py-4 sm:flex-row sm:items-center">
              <p className="text-muted-foreground text-xs">
                {isEdit ? (
                  changedCount === 0 ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="bg-muted-foreground/40 size-1.5 rounded-full" />
                      Chưa có thay đổi nào để lưu
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="bg-primary size-1.5 rounded-full" />
                      {changedCount} trường đã thay đổi
                    </span>
                  )
                ) : (
                  <span>Các trường có dấu (*) là bắt buộc</span>
                )}
              </p>
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isLoading}
                >
                  Hủy
                </Button>
                <Button type="submit" disabled={submitDisabled} className="min-w-32">
                  {isLoading ? (
                    'Đang xử lý...'
                  ) : (
                    <span className="flex items-center gap-2">
                      <Save className="size-4" />
                      {isEdit ? 'Cập nhật' : 'Tạo mới'}
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
