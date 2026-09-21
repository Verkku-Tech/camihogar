"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { apiClient, getAuthToken, type NotificationDto } from "@/lib/api-client"
import { useAuth } from "@/contexts/auth-context"
import { toast } from "sonner"

export function useNotifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<NotificationDto[]>([])
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const eventSourceRef = useRef<EventSource | null>(null)

  const loadNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([])
      setUnreadCount(0)
      setIsLoading(false)
      return
    }

    try {
      const [list, count] = await Promise.all([
        apiClient.getNotifications(30).catch(() => []),
        apiClient.getUnreadNotificationCount().catch(() => 0)
      ])
      setNotifications(list)
      setUnreadCount(count)
    } catch {
      // ponytail: graceful degradation if offline
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  // Setup EventSource (SSE)
  useEffect(() => {
    if (typeof window === "undefined" || !user) return

    const token = getAuthToken()
    if (!token) return

    const streamUrl = `/api/notifications/stream?token=${encodeURIComponent(token)}`
    const es = new EventSource(streamUrl)
    eventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const newNotif: NotificationDto = JSON.parse(event.data)
        
        setNotifications((prev) => {
          if (prev.some((n) => n.id === newNotif.id)) {
            return prev.map((n) => (n.id === newNotif.id ? newNotif : n))
          }
          return [newNotif, ...prev]
        })

        setUnreadCount((c) => c + 1)

        // Show immediate visual toast
        if (newNotif.severity === "error") {
          toast.error(newNotif.title, { description: newNotif.message })
        } else if (newNotif.severity === "warning") {
          toast.warning(newNotif.title, { description: newNotif.message })
        } else if (newNotif.severity === "success") {
          toast.success(newNotif.title, { description: newNotif.message })
        } else {
          toast.info(newNotif.title, { description: newNotif.message })
        }
      } catch (err) {
        console.error("Error parsing notification event", err)
      }
    }

    es.onerror = () => {
      // Browser EventSource automatically attempts reconnection
    }

    return () => {
      es.close()
      eventSourceRef.current = null
    }
  }, [user])

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    )
    setUnreadCount((prev) => Math.max(0, prev - 1))
    await apiClient.markNotificationAsRead(id).catch(() => {})
  }, [])

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    setUnreadCount(0)
    await apiClient.markAllNotificationsAsRead().catch(() => {})
  }, [])

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    refetch: loadNotifications
  }
}
