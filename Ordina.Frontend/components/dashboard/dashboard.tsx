"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "./sidebar"
import { DashboardHeader } from "./dashboard-header"
import { MetricsCards } from "./metrics-cards"
import { OrdersTable } from "./orders-table"
import { ManufacturingProductsTable } from "./manufacturing-products-table"
import { BudgetsTable } from "./budgets-table"
import { DispatchesTable } from "./dispatches-table"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { calculateDashboardMetrics, DashboardMetrics } from "@/lib/storage"
import { Card, CardContent } from "@/components/ui/card"
import { NewOrderDialog } from "@/components/orders/new-order-dialog"

type Period = "week" | "month" | "year"
type Tab = "presupuestos" | "pedidos" | "fabricacion" | "despachos"

export function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [period, setPeriod] = useState<Period>("week")
  const [activeTab, setActiveTab] = useState<Tab>("pedidos")
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true)
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false)

  useEffect(() => {
    const loadMetrics = async () => {
      setIsLoadingMetrics(true)
      try {
        const calculatedMetrics = await calculateDashboardMetrics(period)
        setMetrics(calculatedMetrics)
      } catch (error) {
        console.error("Error loading dashboard metrics:", error)
      } finally {
        setIsLoadingMetrics(false)
      }
    }

    loadMetrics()
  }, [period])

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as Period
    setPeriod(value)
  }

  const EmptyState = ({ message }: { message: string }) => (
    <Card>
      <CardContent className="p-6">
        <p className="text-center text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  )

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
              <select
                value={period}
                onChange={handlePeriodChange}
                className="px-3 py-2 border border-border rounded-md bg-background text-foreground"
              >
                <option value="week">Última Semana</option>
                <option value="month">Último Mes</option>
                <option value="year">Último Año</option>
              </select>
            </div>
          </div>

          {/* Metrics Cards */}
          {metrics && <MetricsCards metrics={metrics} isLoading={isLoadingMetrics} />}

          {/* Orders Section */}
          <div className="mt-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
              <div className="flex items-center space-x-1 mb-4 sm:mb-0">
                <button
                  onClick={() => setActiveTab("presupuestos")}
                  className={`px-4 py-2 text-sm rounded-md transition-colors ${
                    activeTab === "presupuestos"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  Presupuestos
                </button>
                <button
                  onClick={() => setActiveTab("pedidos")}
                  className={`px-4 py-2 text-sm rounded-md transition-colors ${
                    activeTab === "pedidos"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  Pedidos
                </button>
                <button
                  onClick={() => setActiveTab("fabricacion")}
                  className={`px-4 py-2 text-sm rounded-md transition-colors ${
                    activeTab === "fabricacion"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  Fabricación
                </button>
                <button
                  onClick={() => setActiveTab("despachos")}
                  className={`px-4 py-2 text-sm rounded-md transition-colors ${
                    activeTab === "despachos"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  Notas de Despacho
                </button>
              </div>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => setIsNewOrderOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Pedido
              </Button>
            </div>

            {/* Tab Content */}
            {activeTab === "pedidos" && <OrdersTable />}
            {activeTab === "presupuestos" && <BudgetsTable />}
            {activeTab === "fabricacion" && <ManufacturingProductsTable />}
            {activeTab === "despachos" && <DispatchesTable />}
          </div>
        </main>
      </div>

      {/* New Order Dialog */}
      <NewOrderDialog open={isNewOrderOpen} onOpenChange={setIsNewOrderOpen} />
    </div>
  )
}
