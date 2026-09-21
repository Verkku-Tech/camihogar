"use client"

import { useState } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { HomeHeader } from "@/components/home/home-header"
import { BudgetsTable } from "@/components/home/budgets-table"
import { AppBreadcrumb } from "@/components/ui/app-breadcrumb"


export default function PresupuestosPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-full bg-background">
      <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <HomeHeader onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 lg:p-6">
          

          <AppBreadcrumb />
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
