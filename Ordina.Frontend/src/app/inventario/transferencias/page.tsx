"use client"

import { useState } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { AppBreadcrumb } from "@/components/ui/app-breadcrumb"
import { StockTransfersPage } from "@/components/inventory/stock-transfers-page"

export default function TransferenciasPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-full bg-background">
      <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          <AppBreadcrumb />
          <StockTransfersPage />
        </main>
      </div>
    </div>
  )
}
