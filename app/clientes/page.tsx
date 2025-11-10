"use client"

import { useState } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { ClientsPage } from "@/components/clients/clients-page"

export default function Clientes() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
            <span className="text-green-600 font-medium">Home</span>
            <span>/</span>
            <span>Clientes</span>
          </nav>

          <ClientsPage />
        </main>
      </div>
    </div>
  )
}
