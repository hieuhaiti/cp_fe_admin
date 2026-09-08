import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { CitizenFeedback, FeedbackStatus } from '@/types/api'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const feedbackReviewSchema = z
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
type StatusFormValues = z.infer<typeof feedbackReviewSchema>

interface FeedbackUpdateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  feedback: CitizenFeedback | null
  onUpdateStatus: (data: StatusFormValues) => void
  isLoading?: boolean
  canOverrideTransitions?: boolean
}

const STATUS_LABELS: { value: FeedbackStatus; label: string }[] = [
  { value: 'pending', label: 'Chờ tiếp nhận' },
  { value: 'under_review', label: 'Đang xem xét' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'resolved', label: 'Đã xử lý' },
  { value: 'rejected', label: 'Từ chối' },
]

export default function FeedbackUpdateDialog({
  open,
  onOpenChange,
  feedback,
  onUpdateStatus,
  isLoading = false,
  canOverrideTransitions = false,
}: FeedbackUpdateDialogProps) {
  const statusForm = useForm<StatusFormValues>({
    resolver: zodResolver(feedbackReviewSchema),
    defaultValues: {
      status: 'under_review',
      reason: '',
    },
  })

  useEffect(() => {
    if (feedback) {
      const currentStatus: StatusFormValues['status'] =
        feedback.status === 'approved' ||
        feedback.status === 'rejected' ||
        feedback.status === 'resolved' ||
        feedback.status === 'under_review'
          ? feedback.status
          : 'under_review'
      statusForm.reset({ status: currentStatus, reason: '' })
    }
  }, [feedback, open, statusForm])

  const selectedStatus = statusForm.watch('status')
  const allowedStatuses = canOverrideTransitions
    ? STATUS_LABELS.filter(({ value }) => value !== feedback?.status && value !== 'pending')
    : STATUS_LABELS.filter(({ value }) => {
        if (feedback?.status === 'pending') return value === 'under_review' || value === 'rejected'
        if (feedback?.status === 'under_review') {
          return value === 'approved' || value === 'resolved' || value === 'rejected'
        }
        if (feedback?.status === 'approved') return value === 'resolved'
        return false
      })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
        <DialogTitle>Cập nhật phản ánh</DialogTitle>
        <DialogDescription>
          Phản ánh: <span className="font-medium">{feedback?.title}</span>
        </DialogDescription>

        <form onSubmit={statusForm.handleSubmit(onUpdateStatus)} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label>Trạng thái xử lý</Label>
            <Controller
              name="status"
              control={statusForm.control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
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
