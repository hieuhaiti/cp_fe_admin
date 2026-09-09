import type { FeedbackStatus } from '@/types/api'

/**
 * Bản đồ chuyển trạng thái phản ánh hiện trường.
 *
 * NGUỒN SỰ THẬT DUY NHẤT:
 *   server/src/database/migrations/023_field_reports.sql
 *   → FUNCTION community.validate_field_report_transition()
 *
 * Trigger PostgreSQL sẽ RAISE EXCEPTION với ERRCODE 23514 nếu UI gửi lên một
 * chuyển tiếp không nằm trong bản đồ này. Joi reviewSchema ở tầng server CHỈ
 * kiểm tra status thuộc enum, hoàn toàn không biết trạng thái hiện tại của bản
 * ghi, nên nó không thể chặn sai lệch thay cho chúng ta.
 *
 * Mọi thay đổi ở đây phải được đồng bộ với file SQL nói trên. Bài kiểm thử
 * `feedbackTransitions.contract.test.ts` đọc trực tiếp file SQL và sẽ báo đỏ
 * nếu hai bên lệch nhau.
 */
export const FEEDBACK_TRANSITIONS = {
  pending: ['under_review', 'approved', 'rejected'],
  under_review: ['approved', 'rejected'],
  approved: ['resolved'],
  rejected: [],
  resolved: [],
} as const satisfies Record<FeedbackStatus, readonly FeedbackStatus[]>

/** Trạng thái kết thúc: không còn chuyển tiếp hợp lệ nào. */
export const FEEDBACK_TERMINAL_STATUSES = (
  Object.keys(FEEDBACK_TRANSITIONS) as FeedbackStatus[]
).filter((status) => FEEDBACK_TRANSITIONS[status].length === 0)

/**
 * Các trạng thái mà admin được phép gán qua endpoint review.
 * Khớp với `reviewSchema` ở server: status không bao giờ là 'pending'.
 */
export type FeedbackReviewStatus = Exclude<FeedbackStatus, 'pending'>

export const FEEDBACK_REVIEW_STATUSES: readonly FeedbackReviewStatus[] = [
  'under_review',
  'approved',
  'resolved',
  'rejected',
]

/**
 * Trả về danh sách trạng thái kế tiếp hợp lệ cho một trạng thái hiện tại.
 *
 * @param currentStatus Trạng thái hiện tại của phản ánh.
 * @param canOverride   Khi true (system_admin), bỏ qua ràng buộc trigger và cho
 *                      phép chọn mọi trạng thái review khác trạng thái hiện tại.
 *                      Lưu ý: trigger DB vẫn có thể từ chối; đây chỉ là nới lỏng
 *                      ở tầng UI cho vai trò quản trị.
 */
export function getFeedbackNextStatuses(
  currentStatus?: FeedbackStatus | null,
  canOverride = false
): readonly FeedbackReviewStatus[] {
  if (!currentStatus) return []

  if (canOverride) {
    return FEEDBACK_REVIEW_STATUSES.filter((status) => status !== currentStatus)
  }

  const allowed = FEEDBACK_TRANSITIONS[currentStatus]
  // FEEDBACK_TRANSITIONS không bao giờ chứa 'pending' (endpoint review không chấp nhận giá trị này).
  return allowed ?? []
}
