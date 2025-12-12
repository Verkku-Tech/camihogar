"use client"

import { useState } from "react"
import { Sidebar } from "./sidebar"
import { DashboardHeader } from "./dashboard-header"
import { MetricsCards } from "./metrics-cards"
import { OrdersTable } from "./orders-table"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {/* Breadcrumb */}
          <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
            <span className="text-green-600 font-medium">Home</span>
            <span>/</span>
            <span>Dashboard</span>
          </nav>

          {/* Dashboard Title */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
              <p className="text-muted-foreground mt-1">Últimos Pedidos</p>
            </div>
            <div className="flex items-center gap-4 mt-4 sm:mt-0">
              <select className="px-3 py-2 border border-border rounded-md bg-background text-foreground">
                <option>Última Semana</option>
                <option>Último Mes</option>
                <option>Último Año</option>
              </select>
            </div>
          </div>

          {/* Metrics Cards */}
          <MetricsCards />

          {/* Orders Section */}
          <div className="mt-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
              <div className="flex items-center space-x-1 mb-4 sm:mb-0">
                <button className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Presupuestos</button>
                <button className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md">Pedidos</button>
                <button className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Fabricación</button>
                <button className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
                  Notas de Despacho
                </button>
              </div>
              <Button className="bg-green-600 hover:bg-green-700 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Pedido
              </Button>
            </div>

            <OrdersTable />
          </div>
        </main>
      </div>
    </div>
  )
}
