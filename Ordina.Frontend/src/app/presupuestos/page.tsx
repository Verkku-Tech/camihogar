"use client"

import { useState } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { BudgetsTable } from "@/components/dashboard/budgets-table"

export default function PresupuestosPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-background">
      <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
            <span className="text-green-600 font-medium">Home</span>
            <span>/</span>
            <span>Presupuestos</span>
          </nav>

          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Presupuestos</h1>
              <p className="text-muted-foreground mt-1">
                Visualización y seguimiento de cotizaciones y presupuestos emitidos.
              </p>
            </div>

            <BudgetsTable />
          </div>
        </main>
      </div>
    </div>
  )
}
