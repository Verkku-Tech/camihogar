"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { apiClient, getAuthToken, resolveApiUrl, type NotificationDto } from "@/lib/api-client"
import { useAuth } from "@/contexts/auth-context"
import { toast } from "sonner"

export function playNotificationChime() {
  try {
    if (typeof window === "undefined") return
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {})
    }
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5 note
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12) // A5 note
    gain.gain.setValueAtTime(0.12, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.35)
  } catch {
    // ponytail: ignore audio autoplay restrictions gracefully
  }
}

export function useNotifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<NotificationDto[]>([])
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false)
  const [hasMore, setHasMore] = useState<boolean>(true)
  const eventSourceRef = useRef<EventSource | null>(null)

  const PAGE_SIZE = 10

  const loadNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([])
      setUnreadCount(0)
      setIsLoading(false)
      setHasMore(false)
      return
    }

    try {
      const [list, count] = await Promise.all([
        apiClient.getNotifications(0, PAGE_SIZE).catch(() => []),
        apiClient.getUnreadNotificationCount().catch(() => 0)
      ])
      setNotifications(list)
      setUnreadCount(count)
      setHasMore(list.length === PAGE_SIZE)
    } catch {
      // ponytail: graceful degradation if offline
    } finally {
      setIsLoading(false)
    }
  }, [user])

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !user) return
    setIsLoadingMore(true)
    try {
      const more = await apiClient.getNotifications(notifications.length, PAGE_SIZE)
      if (more.length < PAGE_SIZE) {
        setHasMore(false)
      }
      setNotifications((prev) => {
        const existingIds = new Set(prev.map((n) => n.id))
        const uniqueMore = more.filter((n) => !existingIds.has(n.id))
        return [...prev, ...uniqueMore]
      })
    } catch {
      // ponytail: ignore network hiccups
    } finally {
      setIsLoadingMore(false)
    }
  }, [isLoadingMore, hasMore, user, notifications.length])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  // Setup EventSource (SSE)
  useEffect(() => {
    if (typeof window === "undefined" || !user) return

    const token = getAuthToken()
    if (!token) return

    const streamUrl = resolveApiUrl(`/api/notifications/stream?token=${encodeURIComponent(token)}`)
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

        // Native audio chime
        playNotificationChime()

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

  const deleteNotification = useCallback(async (id: string) => {
    setNotifications((prev) => {
      const target = prev.find((n) => n.id === id)
      if (target && !target.isRead) {
        setUnreadCount((c) => Math.max(0, c - 1))
      }
      return prev.filter((n) => n.id !== id)
    })
    await apiClient.deleteNotification(id).catch(() => {})
  }, [])

  const deleteAllNotifications = useCallback(async () => {
    setNotifications([])
    setUnreadCount(0)
    setHasMore(false)
    await apiClient.deleteAllNotifications().catch(() => {})
  }, [])

  return {
    notifications,
    unreadCount,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    refetch: loadNotifications
  }
}
