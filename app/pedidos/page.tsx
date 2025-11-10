"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { NewOrderDialog } from "@/components/orders/new-order-dialog"
import { Search, Plus, Eye, Edit, Trash2 } from "lucide-react"
import { getOrders, type Order } from "@/lib/storage"

const getStatusColor = (status: string) => {
  switch (status) {
    case "Completado":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
    case "Apartado":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
    case "Pendiente":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
  }
}

export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadOrders = async () => {
      try {
        setIsLoading(true)
        const loadedOrders = await getOrders()
        setOrders(loadedOrders)
      } catch (error) {
        console.error("Error loading orders:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadOrders()
  }, [])

  // Función para refrescar después de crear un pedido
  const handleOrderCreated = async () => {
    const loadedOrders = await getOrders()
    setOrders(loadedOrders)
    setIsNewOrderOpen(false)
  }

  const filteredOrders = orders.filter(
    (order) =>
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.vendorName.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-background">
        <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />

        <div className="flex-1 flex flex-col overflow-hidden">
          <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />

          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
              <span className="text-green-600 font-medium">Home</span>
              <span>/</span>
              <span>Pedidos</span>
            </nav>

            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4 justify-between">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Buscar pedidos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button onClick={() => setIsNewOrderOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Pedido
                </Button>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Lista de Pedidos</CardTitle>
                  <CardDescription>Gestiona todos los pedidos del sistema</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-8">Cargando pedidos...</div>
                  ) : filteredOrders.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {searchTerm ? "No se encontraron pedidos" : "No hay pedidos registrados"}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>N° Pedido</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Vendedor</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Método de Pago</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Productos</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell className="font-medium">{order.orderNumber}</TableCell>
                            <TableCell>{order.clientName}</TableCell>
                            <TableCell>{order.vendorName}</TableCell>
                            <TableCell>${order.total.toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                            </TableCell>
                            <TableCell>{order.paymentMethod}</TableCell>
                            <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                            <TableCell>{order.products.length}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm">
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="sm">
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>

      <NewOrderDialog 
        open={isNewOrderOpen} 
        onOpenChange={(open) => {
          setIsNewOrderOpen(open)
          if (!open) {
            // Refrescar cuando se cierra el diálogo
            handleOrderCreated()
          }
        }}
      />
    </ProtectedRoute>
  )
}
