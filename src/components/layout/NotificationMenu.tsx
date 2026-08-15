import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { Bell, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { notificationService, useApiMutation, useApiQuery } from '@/service'
import type {
  ApiResponse,
  Notification,
  NotificationListData,
  NotificationListParams,
} from '@/types/api'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/date'
import { useNotificationWebSocket } from '@/hooks/useNotificationWebSocket'
import { useAuthStore } from '@/stores/common/useAuthStore'

const defaultParams: NotificationListParams = {
  page: 1,
  limit: 10,
}

function getPrimaryText(n: Notification) {
  return n.title || n.body || n.message || 'Thông báo'
}

function getSecondaryText(n: Notification) {
  const secondary = n.body || n.message
  if (n.title && secondary) return secondary
  return ''
}

function isReadFlag(n: Notification) {
  return Boolean(n.isRead ?? n.is_read ?? n.readAt ?? n.read_at)
}

function createdAtOf(n: Notification) {
  return n.createdAt ?? n.created_at ?? ''
}

/**
 * Kênh & type notification server phát ra (xem admin/src/pages/NotificationSend
 * và server/src/realtime/field-report-listener). Bấm vào thông báo phải mở
 * đúng trang chuyên đề, kèm `?highlight=<id>` (hoặc query cụ thể) khi payload
 * có ID để trang đó có thể cuộn/tô sáng entity tương ứng sau này.
 *
 * Ưu tiên đọc:
 * 1. `data.path` — override tường minh từ server (nội bộ, phải bắt đầu `/`)
 * 2. `data.url` — link ngoài (http/https), trả về nguyên URL để mở tab mới
 * 3. Channel + type để suy ra trang + ID để deep-link
 */
function getNotificationPath(n: Notification): string | null {
  const data = (n.data ?? n.payload ?? {}) as Record<string, unknown>
  const channel = (n.channel ?? (data.channel as string | undefined)) || ''
  const type = n.type || ''

  // 1. explicit internal path override
  const explicitPath = data.path
  if (
    typeof explicitPath === 'string' &&
    explicitPath.startsWith('/') &&
    !explicitPath.startsWith('//')
  ) {
    return explicitPath
  }
  // 2. explicit external URL override
  const explicitUrl = data.url
  if (typeof explicitUrl === 'string' && /^https?:\/\//.test(explicitUrl)) {
    return explicitUrl
  }

  // 3. channel/type → route + optional entity id
  const asId = (value: unknown): string | null => {
    if (value === null || value === undefined || value === '') return null
    const n = Number(value)
    return Number.isFinite(n) && n > 0 ? String(n) : null
  }
  const withQuery = (base: string, key: string, value: unknown) => {
    const id = asId(value)
    return id ? `${base}?${key}=${id}` : base
  }

  // Feedback / field reports — server sends `data.reportId`
  if (
    channel === 'feedback' ||
    type.startsWith('feedback_') ||
    type.startsWith('field_report_')
  ) {
    return withQuery('/feedbacks', 'highlight', data.reportId ?? data.feedbackId ?? data.id)
  }

  // News comments — server sends `data.commentId` (or newsId for filter)
  if (channel === 'comment' || type.startsWith('comment_')) {
    return withQuery('/news-comments', 'highlight', data.commentId ?? data.id)
  }

  // News articles
  if (channel === 'news' || type.startsWith('news_')) {
    return withQuery('/news', 'highlight', data.newsId ?? data.id)
  }

  // Forest classification
  if (channel === 'forest' || type.startsWith('forest_')) {
    return withQuery(
      '/forest-classification',
      'snapshot',
      data.snapshotId ?? data.forestSnapshotId ?? data.id
    )
  }

  // Flood — runId cho lượt chạy, artifactId cho lớp đã công bố
  if (channel === 'flood' || type.startsWith('flood_')) {
    const runId = asId(data.runId ?? data.floodRunId)
    const artifactId = asId(data.artifactId ?? data.floodArtifactId ?? data.id)
    if (runId) return `/flood?run=${runId}`
    if (artifactId) return `/flood?artifact=${artifactId}`
    return '/flood'
  }

  // System channel (announcement / maintenance / backup / system_alert) —
  // không có trang chuyên đề, không điều hướng để tránh mở page rỗng.
  if (channel === 'system' || type === 'announcement' || type === 'system_alert') {
    return null
  }

  return null
}

export function NotificationMenu() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const roleCode = useAuthStore((state) => state.user?.roleCode ?? state.user?.role?.code)

  const params = defaultParams
  const query = useApiQuery(
    ['notifications', 'me', params.page, params.limit],
    () => notificationService.getMy(params),
    { refetchOnWindowFocus: false },
    false,
    false
  )
  const unreadQuery = useApiQuery(
    ['notifications', 'unread-count'],
    () => notificationService.getUnreadCount(),
    { refetchOnWindowFocus: false },
    false,
    false
  )

  const refreshNotifications = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }, [queryClient])

  const handleWsMessage = useCallback(
    (message: { data?: { id?: number | string; title?: string | null; body?: string | null } }) => {
      refreshNotifications()
      if (!open) {
        toast.info(message.data?.title || message.data?.body || 'Bạn có thông báo mới', {
          toastId: `notification-${message.data?.id ?? 'new'}`,
        })
      }
    },
    [open, refreshNotifications]
  )

  useNotificationWebSocket({
    roleCode,
    onMessage: handleWsMessage,
  })

  const raw = query.data as ApiResponse<NotificationListData> | undefined
  const data = raw?.data
  const notifications: Notification[] = data?.items ?? data?.notifications ?? []
  const unreadData = (unreadQuery.data as ApiResponse<{ count: number }> | undefined)?.data
  const unreadCountRaw = unreadData?.count ?? data?.unreadCount ?? data?.unread_count
  const unreadCount = Number.isFinite(Number(unreadCountRaw))
    ? Math.max(0, Number(unreadCountRaw))
    : Math.max(0, notifications.filter((n) => !isReadFlag(n)).length)
  const showBadge = unreadCount > 0

  const markAsReadMutation = useApiMutation(
    (id: number | string) => notificationService.markAsRead(id),
    {
      onSuccess: () => {
        refreshNotifications()
      },
    },
    false
  )

  const markAllAsReadMutation = useApiMutation(
    () => notificationService.markAllAsRead(),
    {
      onSuccess: () => {
        refreshNotifications()
      },
    },
    false
  )

  const deleteMutation = useApiMutation(
    (id: number | string) => notificationService.delete(id),
    {
      onSuccess: () => {
        refreshNotifications()
        toast.success('Đã xoá thông báo')
      },
      onError: () => toast.error('Không thể xoá thông báo.'),
    },
    false
  )

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) refreshNotifications()
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Thông báo"
          className="hover:bg-muted relative h-8 w-8 p-0 shadow-sm"
        >
          <Bell className="text-foreground h-4 w-4" />
          {showBadge && (
            <Badge
              className="bg-destructive text-destructive-foreground absolute -top-1 -left-1 h-4 min-w-4 justify-center px-1"
              aria-label={`${unreadCount} thông báo chưa đọc`}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <div className="flex items-center justify-between px-2">
          <DropdownMenuLabel>Thông báo</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={markAllAsReadMutation.isPending}
              onClick={() => markAllAsReadMutation.mutate(undefined)}
            >
              Đánh dấu đã đọc tất cả
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />

        {query.isFetching && notifications.length === 0 && (
          <div className="text-muted-foreground px-3 py-6 text-center text-xs">
            Đang tải thông báo...
          </div>
        )}

        {!query.isFetching && notifications.length === 0 && (
          <div className="text-muted-foreground px-3 py-6 text-center text-xs">
            Không có thông báo
          </div>
        )}

        {notifications.length > 0 && (
          <div className="max-h-96 overflow-auto py-1">
            {notifications.map((n) => {
              const primary = getPrimaryText(n)
              const secondary = getSecondaryText(n)
              const read = isReadFlag(n)
              return (
                <DropdownMenuItem
                  key={n.id}
                  className={cn(
                    'flex cursor-pointer flex-col items-start gap-1 whitespace-normal',
                    !read && 'bg-muted/60'
                  )}
                  onSelect={() => {
                    if (!read && !markAsReadMutation.isPending) {
                      markAsReadMutation.mutate(n.id)
                    }
                    const path = getNotificationPath(n)
                    if (!path) return
                    if (/^https?:\/\//.test(path)) {
                      window.open(path, '_blank', 'noopener,noreferrer')
                    } else {
                      navigate(path)
                    }
                  }}
                >
                  <div className="flex w-full items-start gap-2">
                    <span className={cn('min-w-0 flex-1 text-sm', !read && 'font-medium')}>
                      {primary}
                    </span>
                    {!read && <span className="bg-primary h-2 w-2 rounded-full" />}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="text-muted-foreground hover:text-destructive -mt-1 -mr-1 shrink-0"
                      aria-label="Xoá thông báo"
                      disabled={
                        deleteMutation.isPending &&
                        String(deleteMutation.variables) === String(n.id)
                      }
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        deleteMutation.mutate(n.id)
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  {secondary && <span className="text-muted-foreground text-xs">{secondary}</span>}
                  <span className="text-muted-foreground text-[11px]">
                    {formatDateTime(createdAtOf(n))}
                  </span>
                </DropdownMenuItem>
              )
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default NotificationMenu
