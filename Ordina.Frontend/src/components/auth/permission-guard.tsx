"use client"

import { useAuth } from "@/contexts/auth-context"
import { type ReactNode } from "react"

interface PermissionGuardProps {
    permission: string
    children: ReactNode
    fallback?: ReactNode
}

export function PermissionGuard({ permission, children, fallback = null }: PermissionGuardProps) {
    const { hasPermission, isLoading } = useAuth()

    if (isLoading) {
        return null
    }

    if (!hasPermission(permission)) {
        return <>{fallback}</>
    }

    return <>{children}</>
}
