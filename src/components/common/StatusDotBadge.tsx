import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { STATUS_DOT_BADGE_STYLES, type StatusDotBadgeTone } from '@/lib/statusBadgeStyles'
export type { StatusDotBadgeTone } from '@/lib/statusBadgeStyles'

interface StatusDotBadgeProps {
  /** Nhãn hiển thị đầy đủ (cũng hiện trong tooltip) */
  label: string
  tone?: StatusDotBadgeTone
  /** Tailwind classes cho container badge (bg + border + text) */
  badgeClass?: string
  /** Tailwind bg-* class cho chấm tròn chỉ thị màu */
  dotClass?: string
  className?: string
  id?: string
  'aria-describedby'?: string
  /** Tắt tooltip/focus riêng khi nhãn nằm trong một nút có tên truy cập đầy đủ. */
  tooltip?: boolean
}

/**
 * Badge gọn nhẹ: chấm màu + nhãn văn bản có thể truncate.
 * - Khi cell đủ rộng → hiện đầy đủ chấm + chữ
 * - Khi cell hẹp    → chữ tự truncate, chấm luôn hiển thị
 * - Tooltip hiện nhãn đầy đủ khi hover hoặc focus (trừ khi nằm trong nút).
 */
export function StatusDotBadge({
  label, tone = 'neutral', badgeClass, dotClass, className, tooltip = true, ...props
}: StatusDotBadgeProps) {
  const colors = STATUS_DOT_BADGE_STYLES[tone]
  const badge = (
    <span
      {...props}
      data-status-dot-badge=""
      aria-label={label}
      tabIndex={tooltip ? 0 : undefined}
      className={cn(
        'inline-flex min-w-0 max-w-full cursor-default items-center gap-1.5 overflow-hidden rounded-full border px-2 py-0.5 align-middle text-xs font-semibold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        badgeClass ?? colors.badge,
        className
      )}
    >
      <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', dotClass ?? colors.dot)} />
      <span className="min-w-0 truncate">{label}</span>
    </span>
  )
  if (!tooltip) return badge
  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent side="top"><p>{label}</p></TooltipContent>
    </Tooltip>
  )
}
