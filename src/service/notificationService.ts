import apiClient from './common/apiClient'
import type {
  Notification,
  NotificationListData,
  NotificationListParams,
  RegisterDeviceBody,
  UnregisterDeviceBody,
  SendNotificationBody,
} from '@/types/api'
import { serviceNotificationPath } from '@/constant/serviceConstant'

const pushTokenPath = '/devices/push-token'

export default {
  /** GET /notifications */
  getAll: (params?: NotificationListParams) =>
    apiClient.get<NotificationListData>(serviceNotificationPath, { params }),

  /** Legacy alias - same as getAll */
  getMy: (params?: NotificationListParams) =>
    apiClient.get<NotificationListData>(serviceNotificationPath, { params }),

  /** GET /notifications/unread-count */
  getUnreadCount: () =>
    apiClient.get<{ unread: number }>(`${serviceNotificationPath}/unread-count`),

  /** PATCH /notifications/read-all */
  markAllAsRead: () =>
    apiClient.patch<{ updatedCount: number }>(`${serviceNotificationPath}/read-all`),

  /** PATCH /notifications/:notificationId/read */
  markAsRead: (notificationId: number | string) =>
    apiClient.patch<Notification>(`${serviceNotificationPath}/${notificationId}/read`),

  /** DELETE /notifications/:notificationId */
  delete: (notificationId: number | string) =>
    apiClient.del<Record<string, never>>(`${serviceNotificationPath}/${notificationId}`),

  /** PUT /devices/push-token */
  registerDevice: (data: RegisterDeviceBody) =>
    apiClient.put<Record<string, never>>(pushTokenPath, data),

  /** DELETE /devices/push-token */
  unregisterDevice: (data: UnregisterDeviceBody) =>
    apiClient.del<Record<string, never>>(pushTokenPath, data),

  /** POST /notifications/send (admin/so_nnmt) */
  send: (data: SendNotificationBody) =>
    apiClient.post<{ id: number }>(`${serviceNotificationPath}/send`, data),
}
