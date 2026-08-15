import apiClient from './common/apiClient'
import type {
  Notification,
  NotificationListData,
  NotificationListParams,
  RegisterDeviceBody,
  UnregisterDeviceBody,
  SendNotificationBody,
  SendNotificationResult,
} from '@/types/api'
import { serviceNotificationPath } from '@/constant/serviceConstant'
const pushTokenPath = '/devices/push-token'

function normalizeListParams(params: NotificationListParams = {}) {
  const {
    onlyUnread,
    unread_only: unreadOnlyLegacy,
    isRead,
    user_id: _userId,
    ...supported
  } = params
  void _userId
  const unreadOnly =
    supported.unreadOnly ??
    onlyUnread ??
    unreadOnlyLegacy ??
    (typeof isRead === 'boolean' ? !isRead : undefined)

  return {
    page: supported.page ?? 1,
    limit: supported.limit ?? 20,
    ...(unreadOnly !== undefined && { unreadOnly }),
  }
}

export default {
  /** GET /notifications/mine (the server only exposes the current user's inbox). */
  getAll: (params?: NotificationListParams) =>
    apiClient.get<NotificationListData>(`${serviceNotificationPath}/mine`, {
      params: normalizeListParams(params),
    }),

  getMy: (params?: NotificationListParams) =>
    apiClient.get<NotificationListData>(`${serviceNotificationPath}/mine`, {
      params: normalizeListParams(params),
    }),

  /** GET /notifications/unread-count */
  getUnreadCount: () => apiClient.get<{ count: number }>(`${serviceNotificationPath}/unread-count`),

  /** PATCH /notifications/read-all */
  markAllAsRead: () => apiClient.patch<{ updated: number }>(`${serviceNotificationPath}/read-all`),

  /** PATCH /notifications/:notificationId/read */
  markAsRead: (notificationId: number | string) =>
    apiClient.patch<Pick<Notification, 'id' | 'read_at'>>(
      `${serviceNotificationPath}/${notificationId}/read`
    ),

  /** DELETE /notifications/:notificationId */
  delete: (notificationId: number | string) =>
    apiClient.del<{ id: number | string }>(`${serviceNotificationPath}/${notificationId}`),

  /** PUT /devices/push-token */
  registerDevice: (data: RegisterDeviceBody) =>
    apiClient.put<Record<string, never>>(pushTokenPath, data),

  /** DELETE /devices/push-token */
  unregisterDevice: (data: UnregisterDeviceBody) =>
    apiClient.del<Record<string, never>>(pushTokenPath, data),

  /** POST /notifications/send — requires notifications.send permission. */
  send: (data: SendNotificationBody) =>
    apiClient.post<SendNotificationResult>(`${serviceNotificationPath}/send`, data),
}
