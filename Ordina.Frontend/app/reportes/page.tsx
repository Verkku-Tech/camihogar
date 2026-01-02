"use client"

import { useState } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Package, CreditCard, Percent, Truck } from "lucide-react"
import { useRouter } from "next/navigation"

interface ReportCard {
  id: string
  title: string
  description: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  available: boolean
}

const reports: ReportCard[] = [
  {
    id: "fabricacion",
    title: "Reporte de Fabricación",
    description: "Productos que deben fabricarse, en fabricación o fabricados. Filtrable por fabricante.",
    href: "/reportes/fabricacion",
    icon: Package,
    color: "bg-blue-500",
    available: true,
  },
  {
    id: "pagos",
    title: "Reporte de Pagos Detallados",
    description: "Análisis detallado de pagos con filtros por fecha y método de pago. Editable para validación.",
    href: "/reportes/pagos",
    icon: CreditCard,
    color: "bg-green-500",
    available: true,
  },
  {
    id: "comisiones",
    title: "Reporte de Comisiones de Ventas",
    description: "Comisiones por factura con división automática para ventas compartidas. Filtros obligatorios por fecha.",
    href: "/reportes/comisiones",
    icon: Percent,
    color: "bg-purple-500",
    available: true,
  },
  {
    id: "despacho",
    title: "Reporte de Despacho",
    description: "Pedidos listos para despacho agrupados por pedido. Filtro principal por Zona para organizar por ruta.",
    href: "/reportes/despacho",
    icon: Truck,
    color: "bg-orange-500",
    available: true,
  },
]

export default function ReportesPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const router = useRouter()

  const handleReportClick = (href: string, available: boolean) => {
    if (available) {
      router.push(href)
    }
  }

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
              <span>Reportes</span>
            </nav>

            {/* Page Title */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground">Reportes</h1>
              <p className="text-muted-foreground mt-1">
                Genera y descarga reportes en formato Excel para análisis y seguimiento
              </p>
            </div>

            {/* Reports Grid - Solo mostrar reportes disponibles */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {reports
                .filter((report) => report.available)
                .map((report) => {
                  const Icon = report.icon
                  return (
                    <Card
                      key={report.id}
                      className="cursor-pointer transition-all hover:shadow-lg hover:border-primary"
                      onClick={() => handleReportClick(report.href, report.available)}
                    >
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className={`p-3 rounded-lg ${report.color} text-white`}>
                            <Icon className="h-6 w-6" />
                          </div>
                        </div>
                        <CardTitle className="mt-4">{report.title}</CardTitle>
                        <CardDescription>{report.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button
                          variant="default"
                          className="w-full"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (report.available) {
                              router.push(report.href)
                            }
                          }}
                        >
                          Abrir Reporte
                        </Button>
                      </CardContent>
                    </Card>
                  )
                })}
            </div>

            {/* Info Section */}
            <Card className="mt-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Información sobre los Reportes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    • Los reportes se generan desde el servidor y se descargan en formato Excel (.xlsx)
                  </p>
                  <p>
                    • Puedes filtrar los datos según los criterios disponibles en cada reporte
                  </p>
                  <p>
                    • Los archivos Excel incluyen auto-filtros para facilitar el análisis
                  </p>
                  <p>
                    • Los reportes requieren conexión a internet para su generación
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}

