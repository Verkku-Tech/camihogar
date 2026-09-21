"use client"

import { Sidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { useState } from "react"
import { DispatchReport } from "@/components/reports/dispatch-report"
import { AppBreadcrumb } from "@/components/ui/app-breadcrumb"


export default function DespachoReportPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-full bg-background">
      <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          <div className="max-w-7xl mx-auto w-full min-w-0">
            

            
            <AppBreadcrumb />
{/* Page Title */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground">Reporte de Despacho</h1>
              <p className="text-muted-foreground mt-1">
                Pedidos con productos en ruta (salieron de tienda). Filtrado principal por zona para organizar por ruta.
              </p>
            </div>

            {/* Report Component */}
            <DispatchReport />
          </div>
        </main>
      </div>
    </div>
  )
}

