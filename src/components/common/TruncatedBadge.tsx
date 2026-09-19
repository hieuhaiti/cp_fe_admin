import React from 'react'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface TruncatedBadgeProps extends BadgeProps {
  /** Text nhãn đầy đủ hiển thị trong Tooltip khi bị cắt ngắn */
  label?: string
  /** Chiều rộng tối đa của badge, mặc định max-w-48 (12rem) */
  maxWidthClass?: string
  children?: React.ReactNode
}

/**
 * Badge thông minh có giới hạn chiều rộng tối đa và tự động hiển thị tooltip:
 * - Tránh làm vỡ hàng hoặc kéo dài bảng dữ liệu một cách xấu xí
 * - Tự động truncate khi quá dài, hỗ trợ tooltip đọc toàn bộ nội dung
 */
export function TruncatedBadge({
  label,
  maxWidthClass = 'max-w-48',
  className,
  children,
  ...props
}: TruncatedBadgeProps) {
  const textContent =
    label ?? (typeof children === 'string' ? children : undefined)

  const badgeElement = (
    <Badge
      className={cn(
        'inline-flex min-w-0 items-center overflow-hidden font-medium',
        maxWidthClass,
        className
      )}
      {...props}
    >
      <span className="truncate">{children ?? label}</span>
    </Badge>
  )

  if (!textContent) {
    return badgeElement
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badgeElement}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs break-words text-xs">
        <p>{textContent}</p>
      </TooltipContent>
    </Tooltip>
  )
}

export default TruncatedBadge
