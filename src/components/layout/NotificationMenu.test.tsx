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
        body: 'cảnh báo có thể ngập nhẹ\ndự báo lượng mưa: 0.58 mm/h',
        created_at: '2026-09-27T13:54:36.000Z',
      },
    })

    expect(toast.info).toHaveBeenCalledWith(
      'Cảnh báo kịch bản thủy văn:\ncảnh báo có thể ngập nhẹ\ndự báo lượng mưa: 0.58 mm/h\n27/09/2026 20:54:36',
      expect.objectContaining({
        toastId: 'notification-99',
        style: { whiteSpace: 'pre-line' },
        onClick: expect.any(Function),
      })
    )

    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const toastCall = vi.mocked(toast.info).mock.calls[0]
    const toastOpts = toastCall[1] as { onClick?: () => void }
    toastOpts.onClick?.()

    expect(windowOpenSpy).toHaveBeenCalledWith(
      'https://admincampha.tourismpj.pro.vn/flood',
      '_blank',
      'noopener,noreferrer'
    )
    windowOpenSpy.mockRestore()
  })

  it('opens flood url when notification is hydro_scenario_triggered type in toast onClick', () => {
    renderWithProviders(<NotificationMenu />)
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    capturedWsHandler!({
      data: {
        id: 100,
        type: 'hydro_scenario_triggered',
        title: 'Cảnh báo kịch bản thủy văn:',
        body: 'Kịch bản ngập nặng\nLượng mưa 1h qua: 85 mm/h',
        data: { channel: 'flood', url: 'https://admincampha.tourismpj.pro.vn/flood' },
      },
    })

    const toastCall = vi.mocked(toast.info).mock.calls[0]
    const toastOpts = toastCall[1] as { onClick?: () => void }
    toastOpts.onClick?.()

    expect(windowOpenSpy).toHaveBeenCalledWith(
      'https://admincampha.tourismpj.pro.vn/flood',
      '_blank',
      'noopener,noreferrer'
    )
    windowOpenSpy.mockRestore()
  })
})
