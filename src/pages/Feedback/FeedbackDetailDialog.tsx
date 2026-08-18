import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { citizenFeedbackService, useApiQuery } from '@/service'
import type { ApiResponse } from '@/types/api'
import { MapPin, User } from 'lucide-react'
import { formatDateTime } from '@/lib/date'
import { STATUS_CLASS, STATUS_LABEL } from '@/constant/feedbackConstant'

// Real API response from GET /admin/field-reports/:id
interface FieldReportPhoto {
  id: string | number
  originalName?: string
  sizeBytes?: string | number
  url: string
  expiresAt?: string
}

interface FieldReportHistory {
  previous_status: string | null
  new_status: string
  reason: string | null
  actor_user_id: string | number
  created_at: string
}

interface FieldReportDetail {
  id: string | number
  reference_code?: string | null
  description?: string | null
  status: string
  longitude?: number | null
  latitude?: number | null
  created_at?: string | null
  updated_at?: string | null
  photo_count?: number
  sender_user_id?: string | number | null
  org_id?: number
  review_reason?: string | null
  reviewed_by?: string | number | null
  reviewed_at?: string | null
  sender_name?: string | null
  sender_email?: string | null
  photos?: FieldReportPhoto[]
  history?: FieldReportHistory[]
}

// Maps raw API status (pending, under_review, approved, resolved, rejected) to UI status keys
function mapApiStatus(raw: string): string {
  switch (raw.toLowerCase()) {
    case 'pending':
      return 'new'
    case 'under_review':
      return 'in_progress'
    case 'approved':
    case 'resolved':
      return 'resolved'
    default:
      return raw
  }
}

interface FeedbackDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  feedbackId: number | string | null
}

export default function FeedbackDetailDialog({
  open,
  onOpenChange,
  feedbackId,
}: FeedbackDetailDialogProps) {
  const dbQuery = useApiQuery(
    ['feedback', feedbackId],
    () => citizenFeedbackService.getAdminById(feedbackId!),
    { enabled: !!feedbackId && open, staleTime: 0 },
    false,
    false
  )

  const feedback = ((dbQuery.data as ApiResponse<FieldReportDetail> | undefined)?.data ??
    null) as FieldReportDetail | null
  const uiStatus = feedback ? mapApiStatus(feedback.status) : ''

  const Row = ({ label, children }: { label: string; children: ReactNode }) => (
    <div className="grid grid-cols-3 gap-2">
      <span className="font-semibold">{label}:</span>
      <div className="col-span-2">{children}</div>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
        <DialogTitle>Chi tiết phản ánh</DialogTitle>
        <DialogDescription>
          Thông tin phản ánh hiện trường gửi từ thiết bị di động
        </DialogDescription>

        {dbQuery.isLoading ? (
          <div className="text-muted-foreground py-8 text-center">Đang tải dữ liệu...</div>
        ) : dbQuery.isError ? (
          <div className="text-destructive py-8 text-center">Không thể tải thông tin phản ánh.</div>
        ) : feedback ? (
          <div className="mt-4 space-y-3">
            <Row label="ID">{feedback.id}</Row>

            {feedback.reference_code && (
              <Row label="Mã tham chiếu">
                <span className="font-mono text-sm">{feedback.reference_code}</span>
              </Row>
            )}

            {feedback.description && (
              <Row label="Nội dung">
                <p className="whitespace-pre-wrap text-sm">{feedback.description}</p>
              </Row>
            )}

            <Row label="Trạng thái xử lý">
              <Badge variant="outline" className={STATUS_CLASS[uiStatus] ?? ''}>
                {STATUS_LABEL[uiStatus] ?? feedback.status}
              </Badge>
            </Row>

            <Row label="Người gửi">
              <div className="flex items-center gap-2">
                <div className="bg-muted flex size-8 items-center justify-center rounded-full">
                  <User className="size-4" />
                </div>
                <div>
                  {feedback.sender_name && (
                    <p className="text-sm font-medium">{feedback.sender_name}</p>
                  )}
                  {feedback.sender_email && (
                    <p className="text-muted-foreground text-xs">{feedback.sender_email}</p>
                  )}
                </div>
              </div>
            </Row>

            {feedback.longitude != null && feedback.latitude != null && (
              <Row label="Vị trí">
                <div className="flex items-start gap-1">
                  <MapPin className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${feedback.latitude}&mlon=${feedback.longitude}#map=16/${feedback.latitude}/${feedback.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-xs hover:underline"
                  >
                    {feedback.latitude.toFixed(6)}, {feedback.longitude.toFixed(6)}
                  </a>
                </div>
              </Row>
            )}

            {feedback.review_reason && (
              <Row label="Lý do xét duyệt">
                <p className="bg-muted rounded-md p-2 text-sm">{feedback.review_reason}</p>
              </Row>
            )}

            {feedback.reviewed_at && (
              <Row label="Thời gian xét duyệt">{formatDateTime(feedback.reviewed_at)}</Row>
            )}

            {feedback.photos && feedback.photos.length > 0 && (
              <Row label="Ảnh đính kèm">
                <div className="grid grid-cols-3 gap-2">
                  {feedback.photos.map((photo) => (
                    <a
                      key={photo.id}
                      href={photo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative"
                    >
                      <img
                        src={photo.url}
                        alt={photo.originalName ?? ''}
                        className="h-24 w-full rounded border object-cover transition group-hover:opacity-80"
                      />
                    </a>
                  ))}
                </div>
              </Row>
            )}

            {feedback.history && feedback.history.length > 0 && (
              <Row label="Lịch sử xử lý">
                <div className="space-y-2">
                  {feedback.history.map((entry, index) => {
                    const fromUi = entry.previous_status
                      ? mapApiStatus(entry.previous_status)
                      : null
                    const toUi = mapApiStatus(entry.new_status)
                    return (
                      <div key={index} className="rounded border p-2 text-sm">
                        <p className="font-medium">
                          {fromUi ? `${STATUS_LABEL[fromUi] ?? fromUi} → ` : ''}
                          {STATUS_LABEL[toUi] ?? entry.new_status}
                        </p>
                        {entry.reason && (
                          <p className="text-muted-foreground mt-1">{entry.reason}</p>
                        )}
                        <p className="text-muted-foreground mt-1 text-xs">
                          {formatDateTime(entry.created_at)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </Row>
            )}

            <Row label="Ngày tạo">
              {feedback.created_at ? formatDateTime(feedback.created_at) : '-'}
            </Row>
            <Row label="Cập nhật lúc">
              {feedback.updated_at ? formatDateTime(feedback.updated_at) : '-'}
            </Row>
          </div>
        ) : (
          <div className="text-muted-foreground py-8 text-center">Không có dữ liệu</div>
        )}
      </DialogContent>
    </Dialog>
  )
}
