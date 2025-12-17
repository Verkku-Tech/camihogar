"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getOrders, Order, OrderProduct } from "@/lib/storage"
import { CheckCircle2, AlertCircle, Clock, Package, Eye } from "lucide-react"

interface ManufacturingProduct {
  orderId: string
  orderNumber: string
  clientName: string
  product: OrderProduct
  status: "debe_fabricar" | "fabricando" | "fabricado"
}

export function ManufacturingProductsTable() {
  const router = useRouter()
  const [products, setProducts] = useState<ManufacturingProduct[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const orders = await getOrders()
        const manufacturingProducts: ManufacturingProduct[] = []

        orders.forEach((order) => {
          order.products.forEach((product) => {
            // SOLO procesar productos que deben mandarse a fabricar
            if (product.locationStatus !== "mandar_a_fabricar") {
              return
            }

            // Determinar estado del producto
            let status: "debe_fabricar" | "fabricando" | "fabricado"

            if (product.manufacturingStatus === "fabricado") {
              status = "fabricado"
            } else if (product.manufacturingStatus === "fabricando") {
              status = "fabricando"
            } else if (product.manufacturingStatus === "debe_fabricar") {
              status = "debe_fabricar"
            } else {
              status = "debe_fabricar"
            }

            // Solo mostrar los que no estén completamente fabricados
            if (status !== "fabricado") {
              manufacturingProducts.push({
                orderId: order.id,
                orderNumber: order.orderNumber,
                clientName: order.clientName,
                product,
                status,
              })
            }
          })
        })

        // Ordenar por estado (debe_fabricar primero, luego fabricando)
        manufacturingProducts.sort((a, b) => {
          const statusOrder = { debe_fabricar: 0, fabricando: 1, fabricado: 2 }
          if (statusOrder[a.status] !== statusOrder[b.status]) {
            return statusOrder[a.status] - statusOrder[b.status]
          }
          return a.orderNumber.localeCompare(b.orderNumber)
        })

        setProducts(manufacturingProducts)
      } catch (error) {
        console.error("Error loading manufacturing products:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadProducts()
  }, [])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "debe_fabricar":
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
            <AlertCircle className="w-3 h-3 mr-1" />
            Debe Fabricar
          </Badge>
        )
      case "fabricando":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
            <Clock className="w-3 h-3 mr-1" />
            Fabricando
          </Badge>
        )
      case "fabricado":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Fabricado
          </Badge>
        )
      default:
        return null
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-medium text-muted-foreground">Pedido</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Producto</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Cliente</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Cantidad</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Estado</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Proveedor</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[1, 2, 3, 4, 5].map((index) => (
                  <TableRow key={index}>
                    <TableCell className="h-12 animate-pulse bg-muted" />
                    <TableCell className="h-12 animate-pulse bg-muted" />
                    <TableCell className="h-12 animate-pulse bg-muted" />
                    <TableCell className="h-12 animate-pulse bg-muted" />
                    <TableCell className="h-12 animate-pulse bg-muted" />
                    <TableCell className="h-12 animate-pulse bg-muted" />
                    <TableCell className="h-12 animate-pulse bg-muted" />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center space-y-2">
            <Package className="w-12 h-12 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">No hay productos en fabricación</p>
            <p className="text-sm text-muted-foreground">
              Los productos marcados como "Mandar a Fabricar" aparecerán aquí
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-medium text-muted-foreground">Pedido</TableHead>
                <TableHead className="font-medium text-muted-foreground">Producto</TableHead>
                <TableHead className="font-medium text-muted-foreground">Cliente</TableHead>
                <TableHead className="font-medium text-muted-foreground">Cantidad</TableHead>
                <TableHead className="font-medium text-muted-foreground">Estado</TableHead>
                <TableHead className="font-medium text-muted-foreground">Proveedor</TableHead>
                <TableHead className="font-medium text-muted-foreground">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((item) => (
                <TableRow key={`${item.orderId}-${item.product.id}`} className="hover:bg-muted/50">
                  <TableCell className="font-medium text-green-600">{item.orderNumber}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      <span>{item.product.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.clientName}</TableCell>
                  <TableCell className="font-medium">{item.product.quantity}</TableCell>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.product.manufacturingProviderName || "-"}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => router.push(`/inventario/fabricacion/${item.orderNumber}`)}
                      className="text-green-600 hover:text-green-700 font-medium text-sm flex items-center gap-1"
                    >
                      <Eye className="w-4 h-4" />
                      Ver
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

