"use client"

import { useState, useEffect } from "react"
import { Timer, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

interface ReservationCountdownPillProps {
  expiresAt: string
  initialSeconds?: number
  isOwnReservation?: boolean
  vendorName?: string
  onExpired?: () => void
  className?: string
}

export function ReservationCountdownPill({
  expiresAt,
  initialSeconds,
  isOwnReservation = false,
  vendorName,
  onExpired,
  className
}: ReservationCountdownPillProps) {
  const computeSeconds = () => {
    const diff = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
    return Math.max(0, diff)
  }

  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    return initialSeconds !== undefined ? initialSeconds : computeSeconds()
  })

  useEffect(() => {
    // Sync with wall clock
    setSecondsLeft(computeSeconds())

    const interval = setInterval(() => {
      const remaining = computeSeconds()
      setSecondsLeft(remaining)
      if (remaining <= 0) {
        clearInterval(interval)
        onExpired?.()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [expiresAt])

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const formatted = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`

  const isUrgent = secondsLeft < 120 // less than 2 minutes

  if (secondsLeft <= 0) {
    return (
      <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground", className)}>
        <Timer className="w-3.5 h-3.5" />
        Expirado
      </span>
    )
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wider transition-colors",
        isUrgent
          ? "bg-red-100 text-red-800 border border-red-300 dark:bg-red-950/80 dark:text-red-300 dark:border-red-800 animate-pulse"
          : isOwnReservation
            ? "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800"
            : "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800",
        className
      )}
      title={`Reserva temporal anti-duplicidad. Expira a las ${new Date(expiresAt).toLocaleTimeString()}`}
    >
      {isUrgent ? (
        <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
      ) : (
        <Timer className="w-3.5 h-3.5" />
      )}
      <span>
        {isOwnReservation ? "Tu reserva: " : vendorName ? `${vendorName}: ` : "Apartado: "}
        <strong className="font-mono">{formatted}</strong>
      </span>
    </span>
  )
}
