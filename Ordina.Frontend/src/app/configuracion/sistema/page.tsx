"use client"

import { useState } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { SystemPage } from "@/components/configuracion/system-page"
import { AppBreadcrumb } from "@/components/ui/app-breadcrumb"


export default function ConfiguracionSistemaPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-full bg-background">
      <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 lg:p-6">
          <AppBreadcrumb />

<SystemPage />
        </main>
      </div>
    </div>
  )
}
