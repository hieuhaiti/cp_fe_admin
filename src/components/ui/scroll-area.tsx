import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  viewportClassName?: string
}

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, viewportClassName, children, onWheel, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('relative overflow-hidden', className)}
        {...props}
      >
        <div
          className={cn(
            'h-full w-full overflow-y-auto overscroll-contain pr-1',
            viewportClassName
          )}
          onWheel={(e) => {
            e.stopPropagation()
            onWheel?.(e)
          }}
        >
          {children}
        </div>
      </div>
    )
  }
)
ScrollArea.displayName = 'ScrollArea'

const ScrollBar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('hidden', className)} {...props} />
))
ScrollBar.displayName = 'ScrollBar'

export { ScrollArea, ScrollBar }
