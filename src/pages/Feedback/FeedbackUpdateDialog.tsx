import { useEffect, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { CitizenFeedback, FeedbackStatus } from '@/types/api'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { STATUS_CLASS, STATUS_LABEL } from '@/constant/feedbackConstant'
import {
  FEEDBACK_REVIEW_STATUSES,
  getFeedbackNextStatuses,
  type FeedbackReviewStatus,
} from '@/constant/feedbackTransitions'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export const feedbackReviewSchema = z
  .object({
    status: z.enum(['under_review', 'approved', 'rejected', 'resolved'] as const),
    reason: z.string().trim().max(1000, 'Lý do không được vượt quá 1000 ký tự').optional(),
  })
  .superRefine((value, context) => {
    if (value.status === 'rejected' && (!value.reason || value.reason.length < 5)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason'],
        message: 'Vui lòng nhập lý do từ chối có ít nhất 5 ký tự',
      })
    }
  })

export type StatusFormValues = z.infer<typeof feedbackReviewSchema>

export interface FeedbackUpdateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  feedback: CitizenFeedback | null
  onUpdateStatus: (data: StatusFormValues) => void
  isLoading?: boolean
  canOverrideTransitions?: boolean
}

export interface StatusOption {
  value: FeedbackReviewStatus
  label: string
}

export const STATUS_OPTIONS: StatusOption[] = FEEDBACK_REVIEW_STATUSES.map((value) => ({
  value,
  label: STATUS_LABEL[value] ?? value,
}))

/**
 * Danh sách trạng thái kế tiếp hợp lệ, tra cứu từ nguồn luật duy nhất
 * (`FEEDBACK_TRANSITIONS`, sao chép từ trigger PostgreSQL).
 */
export function getAllowedStatuses(
  currentStatus?: FeedbackStatus | null,
  canOverride = false
): StatusOption[] {
  return getFeedbackNextStatuses(currentStatus, canOverride).map((value) => ({
    value,
    label: STATUS_LABEL[value] ?? value,
  }))
}

/**
 * Trạng thái được chọn sẵn khi mở form.
 *
 * Luôn phải là một giá trị nằm trong `allowed`, nếu không Radix Select sẽ không
 * tìm thấy SelectItem khớp và render trigger rỗng.
 */
export function getDefaultTargetStatus(
  currentStatus: FeedbackStatus | null | undefined,
  allowed: StatusOption[]
): FeedbackReviewStatus {
  if (allowed.length === 0) return 'under_review'

  // Ưu tiên bước tiến tự nhiên của quy trình thay vì phần tử đầu danh sách.
  const preferred: Partial<Record<FeedbackStatus, FeedbackReviewStatus>> = {
    pending: 'under_review',
    under_review: 'approved',
    approved: 'resolved',
  }

  const candidate = currentStatus ? preferred[currentStatus] : undefined
  if (candidate && allowed.some((option) => option.value === candidate)) {
    return candidate
  }

  return allowed[0].value
}

export default function FeedbackUpdateDialog({
  open,
  onOpenChange,
  feedback,
  onUpdateStatus,
  isLoading = false,
  canOverrideTransitions = false,
}: FeedbackUpdateDialogProps) {
  const allowedStatuses = useMemo(
    () => getAllowedStatuses(feedback?.status, canOverrideTransitions),
    [feedback?.status, canOverrideTransitions]
  )

  const statusForm = useForm<StatusFormValues>({
    resolver: zodResolver(feedbackReviewSchema),
    defaultValues: {
      status: 'under_review',
      reason: '',
    },
  })

  useEffect(() => {
    if (feedback && open) {
      const initialStatus = getDefaultTargetStatus(feedback.status, allowedStatuses)
      const initialReason = feedback.reviewReason ?? feedback.review_reason ?? ''
      statusForm.reset({
        status: initialStatus,
        reason: initialReason,
      })
    }
  }, [feedback, open, allowedStatuses, statusForm])

  const selectedStatus = statusForm.watch('status')
  const referenceCode = feedback?.reference_code || feedback?.referenceCode
  const contentText = feedback?.title || feedback?.description || '-'
  const currentStatusLabel = feedback?.status
    ? STATUS_LABEL[feedback.status] ?? feedback.status
    : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
        <DialogTitle>Cập nhật trạng thái phản ánh</DialogTitle>
        <DialogDescription asChild>
          <div className="text-muted-foreground mt-2 space-y-2 text-sm">
            {referenceCode && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">Mã phản ánh:</span>
                <span className="bg-muted text-foreground rounded px-2 py-0.5 font-mono text-xs font-semibold">
                  {referenceCode}
                </span>
              </div>
            )}
            <div>
              <span className="font-medium text-foreground">Phản ánh: </span>
              <span className="font-medium text-foreground">{contentText}</span>
            </div>
            {feedback?.sender_name && (
              <div>
                <span className="font-medium text-foreground">Người gửi: </span>
                <span>{feedback.sender_name}</span>
                {feedback.sender_email ? ` (${feedback.sender_email})` : ''}
              </div>
            )}
            {feedback?.status && (
              <div className="flex items-center gap-2 pt-1">
                <span className="font-medium text-foreground">Trạng thái hiện tại:</span>
                <Badge variant="outline" className={STATUS_CLASS[feedback.status] ?? ''}>
                  {currentStatusLabel}
                </Badge>
              </div>
            )}
          </div>
        </DialogDescription>

        <form onSubmit={statusForm.handleSubmit(onUpdateStatus)} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label>Trạng thái xử lý</Label>
            {allowedStatuses.length > 0 ? (
              <Controller
                name="status"
                control={statusForm.control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={isLoading}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Chọn trạng thái tiếp theo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allowedStatuses.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            ) : (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                Phản ánh hiện đang ở trạng thái{' '}
                <span className="font-semibold">{currentStatusLabel}</span>, không có trạng thái tiếp
                theo khả dụng.
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-reason">
              {selectedStatus === 'rejected' ? 'Lý do từ chối' : 'Lý do xử lý'}
              {selectedStatus === 'rejected' && <span className="text-destructive"> *</span>}
            </Label>
            <Textarea
              id="feedback-reason"
              {...statusForm.register('reason')}
              rows={4}
              placeholder={
                selectedStatus === 'rejected'
                  ? 'Nhập lý do từ chối phản ánh...'
                  : 'Nhập lý do hoặc ghi chú xử lý...'
              }
              disabled={isLoading || allowedStatuses.length === 0}
            />
            {statusForm.formState.errors.reason && (
              <p className="text-destructive text-xs">
                {statusForm.formState.errors.reason.message}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={isLoading || allowedStatuses.length === 0}>
              {isLoading ? 'Đang lưu...' : 'Cập nhật trạng thái'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
