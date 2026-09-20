"use client"

import { Sidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { ManufacturingReport } from "@/components/reports/manufacturing-report"
import { useState } from "react"
import { AppBreadcrumb } from "@/components/ui/app-breadcrumb"


export default function ManufacturingReportPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-background">
      <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-7xl mx-auto w-full">
            

            
            <AppBreadcrumb />
<ManufacturingReport />
          </div>
        </main>
      </div>
    </div>
  )
}

