"use client"

import { Sidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { useState } from "react"
import { CommissionsReport } from "@/components/reports/commissions-report"

export default function ComisionesReportPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-background">
      <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-7xl mx-auto w-full">
            {/* Breadcrumb */}
            <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
              <span className="text-green-600 font-medium">Home</span>
              <span>/</span>
              <span className="text-green-600 font-medium">Reportes</span>
              <span>/</span>
              <span>Comisiones de Ventas</span>
            </nav>

            {/* Page Title */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground">Reporte de Comisiones de Ventas</h1>
              <p className="text-muted-foreground mt-1">
                Visualiza las comisiones por factura. Las fechas son obligatorias debido a los diferentes cortes de pago por equipo.
              </p>
            </div>

            {/* Report Component */}
            <CommissionsReport />
          </div>
        </main>
      </div>
    </div>
  )
}

