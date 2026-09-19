import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotificationMenu } from './NotificationMenu'
import { renderWithProviders } from '@/test/renderWithProviders'
import { toast } from 'react-toastify'

let capturedWsHandler: ((message: any) => void) | null = null

vi.mock('@/hooks/useNotificationWebSocket', () => ({
  useNotificationWebSocket: ({ onMessage }: { onMessage: (message: any) => void }) => {
    capturedWsHandler = onMessage
  },
}))

vi.mock('react-toastify', () => ({
  toast: {
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}))

const getMy = vi.hoisted(() => vi.fn())
const getUnreadCount = vi.hoisted(() => vi.fn())

vi.mock('@/service', () => ({
  notificationService: {
    getMy,
    getUnreadCount,
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    delete: vi.fn(),
  },
  useApiQuery: vi.fn(() => ({
    data: undefined,
    isFetching: false,
    isLoading: false,
  })),
  useApiMutation: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}))

describe('NotificationMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedWsHandler = null
  })

  it('triggers toast with multi-line title and body when receiving WebSocket message', () => {
    renderWithProviders(<NotificationMenu />)
    expect(capturedWsHandler).toBeTypeOf('function')

    capturedWsHandler!({
      data: {
        id: 99,
        title: 'Cảnh báo kịch bản thủy văn:',
        body: 'Kịch bản ngập nhẹ\nLượng mưa 1h qua: 33 mm/h',
      },
    })

    expect(toast.info).toHaveBeenCalledWith(
      'Cảnh báo kịch bản thủy văn:\nKịch bản ngập nhẹ\nLượng mưa 1h qua: 33 mm/h',
      expect.objectContaining({
        toastId: 'notification-99',
        style: { whiteSpace: 'pre-line' },
      })
    )
  })
})
