"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Sidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Package, User, Calendar, FileText } from "lucide-react"
import { getOrders, getCategories, type Order, type Category, type AttributeValue } from "@/lib/storage"

export default function FabricacionOrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const orderNumber = params.orderNumber as string

  const [order, setOrder] = useState<Order | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [loadedOrders, loadedCategories] = await Promise.all([
          getOrders(),
          getCategories()
        ])

        const foundOrder = loadedOrders.find(o => o.orderNumber === orderNumber)
        setOrder(foundOrder || null)
        setCategories(loadedCategories)
      } catch (error) {
        console.error("Error loading order:", error)
      } finally {
        setLoading(false)
      }
    }

    if (orderNumber) {
      loadData()
    }
  }, [orderNumber])

  if (loading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="max-w-4xl mx-auto">Cargando...</div>
          </main>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="max-w-4xl mx-auto">
              <Card>
                <CardContent className="p-8 text-center">
                  <p>Pedido no encontrado</p>
                  <Button onClick={() => router.push("/inventario/fabricacion")} className="mt-4">
                    Volver a Fabricación
                  </Button>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    )
  }

  // Obtener categoría para cada producto
  const getCategoryForProduct = (productCategory: string) => {
    return categories.find(c => c.name === productCategory)
  }

  // Función helper para obtener el label de un valor de atributo
  const getValueLabel = (value: string | AttributeValue): string => {
    if (typeof value === "string") return value
    return value.label || value.id || String(value)
  }

  // Función para procesar y obtener el label del valor de un atributo
  const getAttributeValueLabel = (
    selectedValue: any,
    categoryAttribute: Category["attributes"][0] | undefined
  ): string => {
    if (!categoryAttribute) {
      return String(selectedValue)
    }

    // Si es un atributo numérico, mostrar el valor directamente
    if (categoryAttribute.valueType === "Number") {
      return selectedValue !== undefined && selectedValue !== null && selectedValue !== ""
        ? selectedValue.toString()
        : ""
    }

    // Si no tiene values, mostrar el valor tal cual
    if (!categoryAttribute.values || categoryAttribute.values.length === 0) {
      return String(selectedValue)
    }

    // Buscar el valor en los values del atributo
    if (Array.isArray(selectedValue)) {
      const labels: string[] = []
      selectedValue.forEach((valStr) => {
        const attributeValue = categoryAttribute.values!.find(
          (val: string | AttributeValue) => {
            if (typeof val === "string") {
              return val === valStr
            }
            return val.id === valStr || val.label === valStr
          }
        )
        if (attributeValue) {
          labels.push(getValueLabel(attributeValue))
        } else {
          labels.push(String(valStr))
        }
      })
      return labels.join(", ")
    } else {
      const selectedValueStr = selectedValue?.toString()
      if (selectedValueStr) {
        const attributeValue = categoryAttribute.values.find(
          (val: string | AttributeValue) => {
            if (typeof val === "string") {
              return val === selectedValueStr
            }
            return val.id === selectedValueStr || val.label === selectedValueStr
          }
        )
        if (attributeValue) {
          return getValueLabel(attributeValue)
        }
      }
      return String(selectedValue)
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-4xl mx-auto w-full">
            {/* Breadcrumb */}
            <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
              <span className="text-green-600 font-medium">Home</span>
              <span>/</span>
              <span>Inventario</span>
              <span>/</span>
              <span>Fabricación</span>
              <span>/</span>
              <span>Pedido #{orderNumber}</span>
            </nav>

            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <Button
                variant="ghost"
                onClick={() => router.push("/inventario/fabricacion")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver
              </Button>
              <div className="flex-1">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                  Pedido #{orderNumber}
                </h1>
                <p className="text-muted-foreground">
                  Detalle de productos para fabricación
                </p>
              </div>
            </div>

            {/* Información General */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Información General</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Cliente</p>
                      <p className="font-medium">{order.clientName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Fecha</p>
                      <p className="font-medium">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {order.vendorName && (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Vendedor</p>
                        <p className="font-medium">{order.vendorName}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Lista de Productos */}
            <Card>
              <CardHeader>
                <CardTitle>Productos</CardTitle>
                <CardDescription>
                  {order.products.length} producto(s) en este pedido
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {order.products.map((product, index) => {
                    const category = getCategoryForProduct(product.category)
                    
                    return (
                      <div key={product.id}>
                        {index > 0 && <Separator className="my-6" />}
                        
                        <div className="space-y-4">
                          {/* Nombre y Categoría */}
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Package className="w-5 h-5 text-primary" />
                                <h3 className="text-lg font-semibold">{product.name}</h3>
                              </div>
                              <Badge variant="outline">{product.category}</Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Cantidad: <span className="font-medium text-foreground">{product.quantity}</span>
                            </div>
                          </div>

                          {/* Observaciones */}
                          {product.observations && (
                            <div className="bg-muted/50 p-3 rounded-md">
                              <div className="flex items-start gap-2">
                                <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
                                <div className="flex-1">
                                  <p className="text-sm font-medium mb-1">Observaciones</p>
                                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                    {product.observations}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Atributos */}
                          {product.attributes && Object.keys(product.attributes).length > 0 && (
                            <div>
                              <p className="text-sm font-medium mb-3">Atributos</p>
                              <div className="space-y-3">
                                {Object.entries(product.attributes).map(([key, value]) => {
                                  // Buscar información del atributo en la categoría
                                  const categoryAttribute = category?.attributes?.find(
                                    attr => attr.id?.toString() === key || attr.title === key
                                  )

                                  // Obtener el label del valor
                                  const valueLabel = getAttributeValueLabel(value, categoryAttribute)

                                  return (
                                    <div key={key} className="border rounded-md p-3">
                                      <p className="text-sm font-medium mb-2">
                                        {categoryAttribute?.title || key}
                                      </p>
                                      {categoryAttribute?.description && (
                                        <p className="text-xs text-muted-foreground mb-2">
                                          {categoryAttribute.description}
                                        </p>
                                      )}
                                      <div className="flex flex-wrap gap-2">
                                        <Badge variant="secondary">
                                          {valueLabel || "-"}
                                        </Badge>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {(!product.attributes || Object.keys(product.attributes).length === 0) && !product.observations && (
                            <p className="text-sm text-muted-foreground italic">
                              Sin observaciones ni atributos personalizados
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}

