import { useEffect, useRef } from 'react'
import { tokenManager } from '@/lib/tokenManager'

type UseNotificationWebSocketOptions = {
    enabled?: boolean
    roleCode?: string
    onMessage: (message: NotificationSocketMessage) => void
}

export type NotificationSocketMessage = {
    event?: string
    data?: {
        id?: number | string
        title?: string | null
        body?: string | null
        [key: string]: unknown
    }
    timestamp?: string
}

const WS_BASE_URL = import.meta.env.VITE_WS_URL || ''

function buildNotificationSocketUrl(token?: string) {
    if (!WS_BASE_URL) return ''
    // If .env already includes /ws suffix (VITE_WS_URL=wss://.../ws) don't double it.
    const base = WS_BASE_URL.replace(/^http/, 'ws').replace(/\/+$/, '')
    const rawUrl = /\/ws$/.test(base) ? base : `${base}/ws`

    let url: URL
    try {
        url = new URL(rawUrl)
    } catch {
        return ''
    }

    if (token) {
        url.searchParams.set('token', token)
    }


    return url.toString()
}

export function useNotificationWebSocket(options: UseNotificationWebSocketOptions) {
    const { enabled = true, roleCode, onMessage } = options
    const onMessageRef = useRef(onMessage)
    onMessageRef.current = onMessage

    const reconnectTimeoutRef = useRef<number | null>(null)
    const reconnectAttemptRef = useRef(0)
    const socketRef = useRef<WebSocket | null>(null)
    const lastRefetchAtRef = useRef(0)

    useEffect(() => {
        if (!enabled) return

        let disposed = false

        const clearReconnectTimer = () => {
            if (reconnectTimeoutRef.current !== null) {
                window.clearTimeout(reconnectTimeoutRef.current)
                reconnectTimeoutRef.current = null
            }
        }

        const scheduleReconnect = () => {
            if (disposed) return
            clearReconnectTimer()

            // Backoff: 3s, 6s, 12s, 24s, capped at 60s. After 5 failures, wait 60s
            const attempt = reconnectAttemptRef.current
            const delay = attempt > 5 ? 60000 : Math.min(60000, 3000 * 2 ** attempt)

            reconnectTimeoutRef.current = window.setTimeout(() => {
                if (disposed) return
                reconnectAttemptRef.current += 1
                connect()
            }, delay)
        }

        const handleMessage = (message: NotificationSocketMessage) => {
            const now = Date.now()
            if (now - lastRefetchAtRef.current < 500) return
            lastRefetchAtRef.current = now
            onMessageRef.current(message)
        }

        const connect = () => {
            if (disposed) return

            const token = tokenManager.getAccessToken()
            if (!token) return

            const socketUrl = buildNotificationSocketUrl(token)
            if (!socketUrl) return

            try {
                const socket = new WebSocket(socketUrl)
                socketRef.current = socket

                socket.onopen = () => {
                    reconnectAttemptRef.current = 0
                    if (roleCode) {
                        socket.send(JSON.stringify({
                            action: 'subscribe',
                            channels: [`role:${roleCode}`],
                        }))
                    }
                }

                socket.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data) as NotificationSocketMessage
                        if (message.event === 'notification') handleMessage(message)
                    } catch {
                        // Bỏ qua payload không thuộc giao thức notification.
                    }
                }

                socket.onerror = () => {
                    // onerror triggers onclose automatically in standard browser WebSocket
                    if (socket.readyState === WebSocket.OPEN) {
                        socket.close()
                    }
                }

                socket.onclose = () => {
                    if (!disposed) scheduleReconnect()
                }
            } catch {
                if (!disposed) scheduleReconnect()
            }
        }

        connect()

        return () => {
            disposed = true
            clearReconnectTimer()

            if (socketRef.current) {
                socketRef.current.onclose = null
                socketRef.current.onerror = null
                socketRef.current.close()
                socketRef.current = null
            }
        }
    }, [enabled, roleCode])
}
