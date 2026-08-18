import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { documentService, useApiQuery } from '@/service'
import type { ApiResponse, Document } from '@/types/api'
import { formatDateTime } from '@/lib/date'
import { CalendarClock, Download, FileText, Globe, Info } from 'lucide-react'
import { toast } from 'react-toastify'

interface DocumentDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentId: number | null
}

function formatFileSize(bytes?: number | string | null): string {
  if (bytes == null || bytes === '') return '-'
  const size = Number(bytes)
  if (!Number.isFinite(size) || size <= 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = size
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1 }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`
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
      <dd className="text-sm wrap-break-word">{children ?? '-'}</dd>
    </div>
  )
}

function CodeValue({ children }: { children?: ReactNode }) {
  if (children === null || children === undefined || children === '') return <>-</>
  return (
    <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs break-all">{children}</code>
  )
}

export default function DocumentDetailDialog({
  open,
  onOpenChange,
  documentId,
}: DocumentDetailDialogProps) {
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

  const isPublic = doc?.visibility === 'public'

  const handleDownload = async () => {
    if (!doc?.id) return
    try {
      const response = await documentService.getDownloadUrl(doc.id)
      const url = (response as any)?.data?.url
      if (!url) throw new Error('Máy chủ chưa trả về liên kết tải tệp.')
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (error: any) {
      toast.error(error?.message || 'Không thể mở văn bản.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <div className="shrink-0 border-b px-6 py-5 pr-12">
          <DialogTitle>Chi tiết văn bản</DialogTitle>
          <DialogDescription className="mt-1">Thông tin chi tiết văn bản đã chọn</DialogDescription>
        </div>

        {doc ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="mb-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold wrap-break-word">{doc.title}</h3>
                  <div className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
                    <span>Mã</span>
                    <CodeValue>{doc.document_code}</CodeValue>
                    <span className="mx-1">·</span>
                    <span>ID</span>
                    <CodeValue>{doc.id}</CodeValue>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    isPublic ? 'border-info/30 bg-info/10 text-info' : 'text-muted-foreground'
                  }
                >
                  <Globe className="mr-1 size-3" />
                  {isPublic ? 'Công khai' : 'Nội bộ'}
                </Badge>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="lg:col-span-2">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="text-primary size-4" aria-hidden="true" />
                    Tệp văn bản
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/20 flex min-h-32 flex-col items-center justify-center gap-3 rounded-md border border-dashed p-6 text-center">
                    <FileText className="text-primary size-10" />
                    <p className="text-sm text-muted-foreground">
                      Tệp được bảo vệ; liên kết tải sẽ được tạo khi mở tệp.
                    </p>
                    <Button variant="outline" size="sm" disabled={!doc.id} onClick={handleDownload}>
                      <Download className="size-4" /> Mở / tải tệp
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Info className="text-primary size-4" aria-hidden="true" />
                    Thông tin văn bản
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                    <DetailField label="Cơ quan ban hành" wide>
                      {doc.issuing_agency || '-'}
                    </DetailField>
                    <DetailField label="Ngày ban hành">
                      {doc.issued_at ? formatDateTime(doc.issued_at) : '-'}
                    </DetailField>
                    <DetailField label="Trạng thái">
                      {isPublic ? 'Công khai' : 'Nội bộ'}
                    </DetailField>
                    {doc.description && (
                      <DetailField label="Mô tả" wide>
                        <span className="whitespace-pre-wrap">{doc.description}</span>
                      </DetailField>
                    )}
                  </dl>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="text-primary size-4" aria-hidden="true" />
                    Tệp và nguồn
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                    <DetailField label="Tên tệp" wide>
                      <CodeValue>{doc.original_name}</CodeValue>
                    </DetailField>
                    <DetailField label="Kích thước">{formatFileSize(doc.size_bytes)}</DetailField>
                    <DetailField label="Truy cập tệp" wide>
                      Liên kết ngắn hạn được tạo khi người dùng chọn mở/tải tệp.
                    </DetailField>
                  </dl>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CalendarClock className="text-primary size-4" aria-hidden="true" />
                    Thời gian
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                    <DetailField label="Ngày tạo">
                      {doc.created_at ? formatDateTime(doc.created_at) : '-'}
                    </DetailField>
                    <DetailField label="Cập nhật gần nhất">
                      {doc.updated_at ? formatDateTime(doc.updated_at) : '-'}
                    </DetailField>
                  </dl>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground flex min-h-56 items-center justify-center px-6">
            {dbQuery.isLoading ? 'Đang tải dữ liệu...' : 'Không có dữ liệu văn bản.'}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
