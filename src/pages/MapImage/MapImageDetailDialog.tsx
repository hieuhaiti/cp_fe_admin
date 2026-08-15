import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { mapImageService, useApiQuery } from '@/service'
import type { ApiResponse, MapImage } from '@/types/api'
import { formatDateTime } from '@/lib/date'
import { CalendarClock, Download, FileImage, FileText, Globe, Info, Map as MapIcon } from 'lucide-react'
import { toast } from 'react-toastify'

interface MapImageDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mapImageId: number | null
}

const THEME_LABEL: Record<string, string> = {
  ngap_lut: 'Ngập lụt và thủy văn',
  khac: 'Khác',
  lop_phu_nhiet: 'Lớp phủ nhiệt',
  lop_phu_rung: 'Lớp phủ rừng',
}

function formatFileSize(bytes?: number | string | null): string {
  if (bytes == null || bytes === '') return '-'
  const size = Number(bytes)
  if (!Number.isFinite(size) || size <= 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = size
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
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

export default function MapImageDetailDialog({
  open,
  onOpenChange,
  mapImageId,
}: MapImageDetailDialogProps) {
  const dbQuery = useApiQuery(
    ['mapImage', mapImageId],
    () => mapImageService.getById(mapImageId!),
    { enabled: !!mapImageId && open, staleTime: 0 },
    false,
    false
  )
  const mapImage = (() => {
    const d = (dbQuery.data as ApiResponse<any>)?.data
    return (d ? (d.mapImage ?? d.pdfMap ?? d) : null) as MapImage | null
  })()

  const titleVi = mapImage?.translations?.vi?.title || mapImage?.title || mapImage?.name || '-'
  const titleEn = mapImage?.translations?.en?.title || ''
  const descriptionVi =
    mapImage?.translations?.vi?.description || mapImage?.description || ''
  const descriptionEn = mapImage?.translations?.en?.description || ''
  const fileName = mapImage?.fileName || mapImage?.file_name || mapImage?.original_name || ''
  const fileSize = mapImage?.fileSize || mapImage?.file_size || mapImage?.size_bytes
  const createdAt = mapImage?.createdAt || mapImage?.created_at
  const updatedAt = mapImage?.updatedAt || mapImage?.updated_at
  const uploader = mapImage?.uploadedByName || (mapImage?.uploadedBy ? `#${mapImage.uploadedBy}` : '-')
  const isPublic = mapImage?.isPublic ?? mapImage?.visibility === 'public'
  const scale = mapImage?.scale ?? mapImage?.scale_label
  const year = mapImage?.year ?? mapImage?.map_year
  const preparingAgency = mapImage?.region ?? mapImage?.preparing_agency

  const handleDownload = async () => {
    if (!mapImage?.id) return
    try {
      const response = await mapImageService.getDownloadUrl(mapImage.id)
      const url = response.data?.url
      if (!url) throw new Error('Máy chủ chưa trả về liên kết tải tệp.')
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (error: any) {
      toast.error(error?.message || 'Không thể mở bản đồ PDF.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <div className="shrink-0 border-b px-6 py-5 pr-12">
          <DialogTitle>Chi tiết ảnh bản đồ</DialogTitle>
          <DialogDescription className="mt-1">
            Thông tin chi tiết ảnh bản đồ đã chọn
          </DialogDescription>
        </div>

        {mapImage ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="mb-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold wrap-break-word">{titleVi}</h3>
                  {titleEn && (
                    <p className="text-muted-foreground mt-0.5 text-sm italic wrap-break-word">
                      {titleEn}
                    </p>
                  )}
                  <div className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
                    <span>ID</span>
                    <CodeValue>{mapImage.id}</CodeValue>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Badge
                    variant="outline"
                    className={
                      isPublic
                        ? 'border-info/30 bg-info/10 text-info'
                        : 'text-muted-foreground'
                    }
                  >
                    <Globe className="mr-1 size-3" />
                    {isPublic ? 'Công khai' : 'Nội bộ'}
                  </Badge>
                  {mapImage.themeCode && (
                    <Badge variant="secondary">
                      {THEME_LABEL[mapImage.themeCode] ?? mapImage.themeCode}
                    </Badge>
                  )}
                  {year && <Badge variant="outline">Năm {year}</Badge>}
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="lg:col-span-2">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileImage className="text-primary size-4" aria-hidden="true" />
                    Ảnh bản đồ
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/20 flex min-h-48 flex-col items-center justify-center gap-3 rounded-md border border-dashed p-6 text-center">
                    <FileText className="text-primary size-12" />
                    <p className="text-sm text-muted-foreground">
                      Tệp PDF được bảo vệ; liên kết tải sẽ được tạo khi mở tệp.
                    </p>
                    <Button variant="outline" size="sm" disabled={!mapImage.id} onClick={handleDownload}>
                      <Download className="size-4" /> Mở / tải tệp
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Info className="text-primary size-4" aria-hidden="true" />
                    Thông tin chung
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                    <DetailField label="Chủ đề">
                      <CodeValue>
                        {mapImage.themeCode
                          ? (THEME_LABEL[mapImage.themeCode] ?? mapImage.themeCode)
                          : '-'}
                      </CodeValue>
                    </DetailField>
                    <DetailField label="Năm">{year ?? '-'}</DetailField>
                    <DetailField label="Tỉ lệ">{scale || '-'}</DetailField>
                    <DetailField label="Đơn vị lập">{preparingAgency || '-'}</DetailField>
                    <DetailField label="Tiêu đề (VI)" wide>
                      {mapImage.translations?.vi?.title || '-'}
                    </DetailField>
                    <DetailField label="Tiêu đề (EN)" wide>
                      {mapImage.translations?.en?.title || '-'}
                    </DetailField>
                    <DetailField label="Mô tả (VI)" wide>
                      <span className="whitespace-pre-wrap">{descriptionVi || '-'}</span>
                    </DetailField>
                    <DetailField label="Mô tả (EN)" wide>
                      <span className="whitespace-pre-wrap">{descriptionEn || '-'}</span>
                    </DetailField>
                  </dl>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MapIcon className="text-primary size-4" aria-hidden="true" />
                    Tệp và nguồn
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                    <DetailField label="Tên tệp" wide>
                      <CodeValue>{fileName}</CodeValue>
                    </DetailField>
                    <DetailField label="Loại tệp">
                      <CodeValue>{mapImage.mimeType ?? mapImage.mime_type}</CodeValue>
                    </DetailField>
                    <DetailField label="Kích thước">{formatFileSize(fileSize)}</DetailField>
                    <DetailField label="Truy cập tệp" wide>
                      Liên kết ngắn hạn được tạo khi người dùng chọn mở/tải tệp.
                    </DetailField>
                    <DetailField label="Người tải lên">{uploader}</DetailField>
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
                      {createdAt ? formatDateTime(createdAt) : '-'}
                    </DetailField>
                    <DetailField label="Cập nhật gần nhất">
                      {updatedAt ? formatDateTime(updatedAt) : '-'}
                    </DetailField>
                  </dl>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground flex min-h-56 items-center justify-center px-6">
            {dbQuery.isLoading ? 'Đang tải dữ liệu...' : 'Không có dữ liệu ảnh bản đồ.'}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
