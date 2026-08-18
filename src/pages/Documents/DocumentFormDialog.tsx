import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FileText, Save } from 'lucide-react'
import { toast } from 'react-toastify'
import { documentService, useApiQuery } from '@/service'
import type { ApiResponse, Document, UpdateDocumentBody } from '@/types/api'
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

const documentSchema = z.object({
  title: z.string().trim().min(1, 'Tiêu đề là bắt buộc').max(300),
  documentCode: z.string().trim().min(1, 'Mã văn bản là bắt buộc').max(100),
  issuingAgency: z.string().trim().min(1, 'Cơ quan ban hành là bắt buộc').max(300),
  issuedAt: z.string().trim().optional().or(z.literal('')),
  description: z.string().trim().max(5000).optional().or(z.literal('')),
  isPublic: z.boolean(),
})

type DocumentFormValues = z.infer<typeof documentSchema>

interface DocumentFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentId: number | null
  onSubmit: (data: FormData | UpdateDocumentBody) => void
  isLoading?: boolean
}

const ACCEPTED_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/xml',
  'application/xml',
]
const MAX_FILE_SIZE = 50 * 1024 * 1024

function toFormValues(doc: Document | null): DocumentFormValues {
  return {
    title: doc?.title ?? '',
    documentCode: doc?.document_code ?? '',
    issuingAgency: doc?.issuing_agency ?? '',
    issuedAt: doc?.issued_at ? doc.issued_at.slice(0, 10) : '',
    description: doc?.description ?? '',
    isPublic: doc ? doc.visibility === 'public' : true,
  }
}

const DEFAULT_VALUES: DocumentFormValues = {
  title: '',
  documentCode: '',
  issuingAgency: '',
  issuedAt: '',
  description: '',
  isPublic: true,
}

export default function DocumentFormDialog({
  open,
  onOpenChange,
  documentId,
  onSubmit,
  isLoading = false,
}: DocumentFormDialogProps) {
  const dbQuery = useApiQuery(
    ['document', documentId],
    () => documentService.getById(documentId!),
    { enabled: !!documentId && open, staleTime: 0 },
    false,
    false,
  )
  const doc = (() => {
    const d = (dbQuery.data as ApiResponse<any>)?.data
    return (d ? (d.document ?? d) : null) as Document | null
  })()
  const isEdit = !!documentId
  const detailLoading = isEdit && dbQuery.isLoading

  const [docFiles, setDocFiles] = useState<File[]>([])

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<DocumentFormValues>({
    resolver: zodResolver(documentSchema) as any,
    defaultValues: DEFAULT_VALUES,
  })

  const originalValues = useMemo(() => toFormValues(doc), [doc])

  useEffect(() => {
    if (!open) return
    if (isEdit && doc) reset(toFormValues(doc))
    else if (!isEdit) reset(DEFAULT_VALUES)
    setDocFiles([])
  }, [open, isEdit, doc, reset])

  const values = watch()
  const changedFields = useMemo(() => {
    if (!isEdit) return new Set<keyof DocumentFormValues>()
    const changed = new Set<keyof DocumentFormValues>()
    ;(Object.keys(DEFAULT_VALUES) as Array<keyof DocumentFormValues>).forEach((key) => {
      if (String(values[key] ?? '') !== String(originalValues[key] ?? '')) changed.add(key)
    })
    return changed
  }, [isEdit, values, originalValues])

  const changedCount = changedFields.size
  const submitDisabled = isLoading || detailLoading || (isEdit && changedCount === 0)

  const onFileValidate = useCallback((file: File): string | null => {
    if (!ACCEPTED_MIME.includes(file.type)) return 'Chỉ chấp nhận PDF, DOC, DOCX hoặc XML'
    if (file.size > MAX_FILE_SIZE) return 'Kích thước file không được quá 50MB'
    return null
  }, [])

  const onFileReject = useCallback((file: File, message: string) => {
    const short = file.name.length > 24 ? `${file.name.slice(0, 24)}...` : file.name
    toast.error(`${message}: "${short}"`)
  }, [])

  const buildUpdatePayload = (data: DocumentFormValues): UpdateDocumentBody => {
    const payload: UpdateDocumentBody = {
      expectedUpdatedAt: doc?.updated_at ?? '',
    }
    if (changedFields.has('title')) payload.title = data.title.trim()
    if (changedFields.has('documentCode')) payload.documentCode = data.documentCode.trim()
    if (changedFields.has('issuingAgency')) payload.issuingAgency = data.issuingAgency.trim()
    if (changedFields.has('issuedAt')) payload.issuedAt = data.issuedAt || null
    if (changedFields.has('description')) payload.description = data.description || null
    if (changedFields.has('isPublic')) payload.visibility = data.isPublic ? 'public' : 'internal'
    return payload
  }

  const buildCreateFormData = (data: DocumentFormValues): FormData => {
    const fd = new FormData()
    fd.append('title', data.title.trim())
    fd.append('documentCode', data.documentCode.trim())
    fd.append('issuingAgency', data.issuingAgency.trim())
    if (data.issuedAt) fd.append('issuedAt', data.issuedAt)
    if (data.description?.trim()) fd.append('description', data.description.trim())
    fd.append('visibility', data.isPublic ? 'public' : 'internal')
    if (docFiles[0]) fd.append('file', docFiles[0])
    return fd
  }

  const handleFormSubmit = (data: DocumentFormValues) => {
    if (isEdit) {
      if (changedCount === 0) { toast.info('Chưa có thay đổi nào để lưu'); return }
      onSubmit(buildUpdatePayload(data))
      return
    }
    if (docFiles.length === 0) { toast.error('Vui lòng chọn file văn bản để tải lên'); return }
    onSubmit(buildCreateFormData(data))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <div className="shrink-0 border-b px-6 py-5 pr-12">
          <DialogTitle>{isEdit ? 'Chỉnh sửa văn bản' : 'Thêm văn bản mới'}</DialogTitle>
          <DialogDescription className="mt-1">
            {isEdit
              ? 'Cập nhật thông tin văn bản. File gốc không thể thay đổi sau khi tạo.'
              : 'Điền đầy đủ thông tin và tải lên file văn bản.'}
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
              {isEdit && doc && (
                <div className="space-y-1">
                  <Label>File hiện tại</Label>
                  <div className="bg-muted/40 flex items-center gap-3 rounded-md border p-3">
                    <FileText className="text-primary size-8 shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{doc.original_name || 'Văn bản'}</p>
                      <p className="text-muted-foreground text-xs">
                        File không thay đổi được sau khi tạo.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!isEdit && (
                <div className="space-y-2">
                  <Label>
                    File văn bản <span className="text-destructive">*</span>
                  </Label>
                  <FileUpload
                    value={docFiles}
                    onValueChange={setDocFiles}
                    onFileValidate={onFileValidate}
                    onFileReject={onFileReject}
                    accept=".pdf,.doc,.docx,.xml,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    maxFiles={1}
                    maxSize={MAX_FILE_SIZE}
                  >
                    <FileUploadDropzone className="border-dashed">
                      <div className="flex flex-col items-center gap-1 text-center">
                        <FileText className="text-muted-foreground size-6" />
                        <p className="text-sm font-medium">Kéo thả file vào đây</p>
                        <FileUploadTrigger asChild>
                          <Button type="button" variant="outline" size="sm">Chọn file</Button>
                        </FileUploadTrigger>
                        <p className="text-muted-foreground text-xs">PDF, DOC, DOCX, XML · tối đa 50MB</p>
                      </div>
                    </FileUploadDropzone>
                    <FileUploadList>
                      {docFiles.map((file) => (
                        <FileUploadItem key={file.name} value={file}>
                          <FileUploadItemPreview />
                          <FileUploadItemMetadata />
                          <FileUploadItemDelete asChild>
                            <Button type="button" variant="ghost" size="sm">Xóa</Button>
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
                <Input id="title" {...register('title')} placeholder="Quyết định số 01/QĐ-UBND..." />
                {errors.title && <p className="text-destructive text-xs">{errors.title.message}</p>}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="documentCode">
                    Mã văn bản <span className="text-destructive">*</span>
                  </Label>
                  <Input id="documentCode" {...register('documentCode')} placeholder="01/QĐ-UBND" />
                  {errors.documentCode && (
                    <p className="text-destructive text-xs">{errors.documentCode.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="issuedAt">Ngày ban hành</Label>
                  <Input id="issuedAt" type="date" {...register('issuedAt')} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="issuingAgency">
                  Cơ quan ban hành <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="issuingAgency"
                  {...register('issuingAgency')}
                  placeholder="UBND TP Cẩm Phả"
                />
                {errors.issuingAgency && (
                  <p className="text-destructive text-xs">{errors.issuingAgency.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Mô tả</Label>
                <Textarea
                  id="description"
                  rows={3}
                  {...register('description')}
                  placeholder="Nội dung tóm tắt văn bản..."
                />
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
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
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
