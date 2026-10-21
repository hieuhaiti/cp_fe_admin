import { STATUS_DOT_BADGE_STYLES } from '@/lib/statusBadgeStyles'
// ── Approval status ───────────────────────────────────────────────
export const APPROVED_LABEL: Record<string, string> = {
  true: 'Đã duyệt',
  false: 'Chờ duyệt',
}
export const APPROVED_CLASS: Record<string, string> = {
  true: STATUS_DOT_BADGE_STYLES.success.badge,
  false: STATUS_DOT_BADGE_STYLES.warning.badge,
}
export const APPROVED_DOT: Record<string, string> = {
  true: STATUS_DOT_BADGE_STYLES.success.dot,
  false: STATUS_DOT_BADGE_STYLES.warning.dot,
}
